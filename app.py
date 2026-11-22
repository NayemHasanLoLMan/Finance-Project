#!/usr/bin/env python3
"""City Bank auto-sync pipeline with a read-only monitoring dashboard."""

import argparse
import json
import mimetypes
import os
import sys
import threading
import urllib.parse
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict

import openpyxl

from engine.config import (
    BASE_DIR,
    CITY_DOCUMENT_KEYS,
    CITY_SHEET_HEADERS,
    CITY_TOTAL_COMPONENTS,
    CITY_USD_EQUIVALENT_COLUMNS,
    INPUT_DIR,
    POLL_INTERVAL,
    REGISTRY_PATH,
    TARGET_EXCEL,
    log,
)
from engine.dedup import load_registry
from engine.excel_sync import convert_bdt_to_usd, record_to_sheet_row
from engine.records import load_records
from engine.utils import parse_date
from engine.validation import validate_city_record
from engine.watcher import scan_and_process
from parsers.city import classify_city_advice

TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

_pipeline_lock = threading.Lock()
_state_lock = threading.Lock()
_pipeline_state: Dict[str, Any] = {
    "status": "starting",
    "last_sync": None,
    "last_error": None,
    "new_records": 0,
}


def background_auto_sync_loop(stop_event: threading.Event) -> None:
    """Scan input PDFs continuously and expose the latest worker status."""
    log(f"Auto-sync started; polling {INPUT_DIR / 'CITY'} every {POLL_INTERVAL:g}s.")
    while not stop_event.is_set():
        try:
            with _pipeline_lock:
                new_records = scan_and_process()
            with _state_lock:
                _pipeline_state.update(
                    status="running",
                    last_sync=datetime.now().isoformat(timespec="seconds"),
                    last_error=None,
                    new_records=new_records,
                )
        except Exception as exc:
            log(f"[AUTO-SYNC ERROR] {exc}")
            with _state_lock:
                _pipeline_state.update(status="error", last_error=str(exc))
        stop_event.wait(POLL_INTERVAL)


def _is_city_record(record: Dict[str, Any]) -> bool:
    bank = record.get("bank") or {}
    return (
        "CITY" in str(record.get("source_file") or "").upper()
        or "CITY" in str(bank.get("name") or "").upper()
    )


def _record_sheet(record: Dict[str, Any]) -> str:
    sheet_name = record.get("sheet_name")
    if sheet_name in CITY_SHEET_HEADERS:
        return sheet_name
    return classify_city_advice(
        record.get("document_type"),
        record.get("details") or {},
        record.get("charges") or [],
    )


def _record_key_value(header: str, value: Any) -> str:
    if value is None:
        return ""
    if "Date" in header:
        parsed = parse_date(value)
        return parsed.strftime("%Y-%m-%d") if parsed else str(value).strip()
    if header.endswith("(USD)") or header.endswith("(BDT)"):
        try:
            return f"{float(value):.2f}"
        except (TypeError, ValueError):
            pass
    return str(value).strip().upper()


def _workbook_record_key(sheet_name: str, row: Dict[str, Any]) -> tuple:
    return tuple(
        _record_key_value(header, row.get(header))
        for header in CITY_DOCUMENT_KEYS[sheet_name]
    )


def _resolve_workbook_formulas(
    sheet_name: str,
    row: Dict[str, Any],
    row_index: int,
) -> Dict[str, Any]:
    columns = {
        header: index
        for index, header in enumerate(CITY_SHEET_HEADERS[sheet_name], 1)
    }

    total_header = "Total Debited (BDT)"
    first, second = CITY_TOTAL_COMPONENTS[sheet_name]
    expected_total_formula = (
        f"={openpyxl.utils.get_column_letter(columns[first])}{row_index}"
        f"+{openpyxl.utils.get_column_letter(columns[second])}{row_index}"
    )
    if row.get(total_header) == expected_total_formula:
        row[total_header] = sum(float(row.get(header) or 0) for header in (first, second))

    for header, (bdt_header, rate_header) in CITY_USD_EQUIVALENT_COLUMNS[sheet_name].items():
        bdt_cell = f"{openpyxl.utils.get_column_letter(columns[bdt_header])}{row_index}"
        rate_cell = f"{openpyxl.utils.get_column_letter(columns[rate_header])}{row_index}"
        expected_formula = (
            f'=IF(OR({bdt_cell}="",{rate_cell}=""),"",'
            f'IFERROR(ROUND({bdt_cell}/{rate_cell},2),""))'
        )
        if row.get(header) == expected_formula:
            row[header] = convert_bdt_to_usd(row.get(bdt_header), row.get(rate_header))

    return {
        header: value.strftime("%Y-%m-%d") if isinstance(value, (datetime, date)) else value
        for header, value in row.items()
    }


class MonitoringDashboardHandler(BaseHTTPRequestHandler):
    """Serve the monitoring dashboard and read-only pipeline data APIs."""

    def log_message(self, format: str, *args: Any) -> None:
        message = format % args
        sys.stdout.write(f"[{self.log_date_time_string()}] {self.command} {self.path} - {message}\n")
        sys.stdout.flush()

    def send_json(self, data: Any, status: int = 200) -> None:
        content = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.send_file(TEMPLATES_DIR / "index.html", "text/html; charset=utf-8")
        elif path.startswith("/static/"):
            relative_path = path[len("/static/"):]
            static_root = STATIC_DIR.resolve()
            file_path = (static_root / relative_path).resolve()
            if static_root not in file_path.parents or not file_path.is_file():
                self.send_error(404, "File not found")
                return
            content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
            self.send_file(file_path, content_type)
        elif path == "/api/stats":
            self.handle_api_stats()
        elif path == "/api/records":
            self.handle_api_records()
        elif path == "/api/registry":
            self.handle_api_registry()
        elif path == "/api/download":
            self.handle_api_download()
        else:
            self.send_error(404, "Endpoint not found")

    def send_file(self, file_path: Path, content_type: str) -> None:
        if not file_path.is_file():
            self.send_error(404, "File not found")
            return
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def handle_api_stats(self) -> None:
        records = [record for record in load_records() if _is_city_record(record)]
        records_by_sheet = {sheet_name: 0 for sheet_name in CITY_SHEET_HEADERS}
        for record in records:
            sheet_name = _record_sheet(record)
            if sheet_name in records_by_sheet:
                records_by_sheet[sheet_name] += 1
        records = [
            record for record in records
            if _record_sheet(record) in CITY_SHEET_HEADERS
        ]
        checks = [validate_city_record(record) for record in records]
        registry = load_registry(REGISTRY_PATH)
        received_statuses = {"success", "duplicate", "failed"}
        total_received = sum(
            1 for entry in registry.values()
            if entry.get("status") in received_statuses
        )

        with _state_lock:
            state = dict(_pipeline_state)

        self.send_json({
            "total_received": total_received,
            "total_records": sum(records_by_sheet.values()),
            "records_by_sheet": records_by_sheet,
            "verified_records": sum(1 for check in checks if check["status"] == "verified"),
            "records_needing_review": sum(
                1 for check in checks if check["status"] == "needs_review"
            ),
            "excel_exists": TARGET_EXCEL.exists(),
            "excel_filename": TARGET_EXCEL.name,
            "pipeline": state,
        })

    def handle_api_records(self) -> None:
        records_by_key = {}
        for record in load_records():
            if not _is_city_record(record):
                continue
            sheet_name = _record_sheet(record)
            if sheet_name not in CITY_SHEET_HEADERS:
                continue
            records_by_key[(sheet_name, _workbook_record_key(
                sheet_name,
                record_to_sheet_row(record, sheet_name),
            ))] = record

        if not TARGET_EXCEL.exists():
            self.send_json({"records": []})
            return

        records = []
        with _pipeline_lock:
            workbook = openpyxl.load_workbook(TARGET_EXCEL, read_only=True, data_only=False)
            try:
                for sheet_name in CITY_SHEET_HEADERS:
                    if sheet_name not in workbook.sheetnames:
                        continue
                    worksheet = workbook[sheet_name]
                    rows = worksheet.iter_rows(values_only=True)
                    headers = next(rows, ())
                    headers = [header for header in headers if header is not None]
                    for row_index, values in enumerate(rows, start=2):
                        if not any(value not in (None, "") for value in values):
                            continue
                        row = {
                            header: value
                            for header, value in zip(headers, values)
                        }
                        row = _resolve_workbook_formulas(sheet_name, row, row_index)
                        record = records_by_key.get(
                            (sheet_name, _workbook_record_key(sheet_name, row))
                        )
                        check = validate_city_record(record) if record else {
                            "status": "not_checked",
                            "issues": [],
                        }
                        records.append({
                            "advice_type": sheet_name,
                            "advice_date": row.get("Bank Deduction Date"),
                            "reference": row.get(CITY_DOCUMENT_KEYS[sheet_name][0]),
                            "unit_name": row.get("Unit Name"),
                            "vendor_name": row.get("Vendor Name"),
                            "data_check": check["status"],
                            "data_check_details": check["issues"],
                            "values": row,
                        })
            finally:
                workbook.close()

        records.sort(key=lambda item: str(item.get("advice_date") or ""), reverse=True)
        self.send_json({"records": records})

    def handle_api_registry(self) -> None:
        entries = []
        records_by_hash = {
            record.get("source_sha256"): record
            for record in load_records()
            if record.get("source_sha256")
        }
        for file_hash, entry in load_registry(REGISTRY_PATH).items():
            item = dict(entry)
            record = records_by_hash.get(file_hash)
            if record:
                check = validate_city_record(record)
                item["data_check"] = check["status"]
                item["data_check_details"] = check["issues"]
            else:
                item["data_check"] = "not_checked"
                item["data_check_details"] = []
            item["hash"] = file_hash[:12]
            entries.append(item)
        entries.sort(key=lambda item: item.get("timestamp", ""), reverse=True)
        self.send_json(entries[:100])

    def handle_api_download(self) -> None:
        if not TARGET_EXCEL.exists():
            self.send_json({"error": f"Workbook '{TARGET_EXCEL.name}' not found."}, status=404)
            return
        try:
            with _pipeline_lock:
                data = TARGET_EXCEL.read_bytes()
        except OSError as exc:
            self.send_json({"error": f"Could not read workbook: {exc}"}, status=500)
            return

        self.send_response(200)
        self.send_header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.send_header("Content-Disposition", f'attachment; filename="{TARGET_EXCEL.name}"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_server(host: str = "0.0.0.0", port: int = 5000) -> None:
    address = (host, port)
    try:
        httpd = ThreadingHTTPServer(address, MonitoringDashboardHandler)
    except OSError:
        port += 1
        address = (host, port)
        httpd = ThreadingHTTPServer(address, MonitoringDashboardHandler)

    stop_event = threading.Event()
    sync_thread = threading.Thread(
        target=background_auto_sync_loop,
        args=(stop_event,),
        name="city-bank-auto-sync",
        daemon=True,
    )
    sync_thread.start()

    print("=" * 72)
    print("   CITY BANK PLC — AUTO-SYNC PIPELINE & MONITORING DASHBOARD   ")
    print("=" * 72)
    print(f" Dashboard URL : http://localhost:{port}")
    print(f" Auto-sync     : every {POLL_INTERVAL:g} seconds")
    print(f" Input folder  : {INPUT_DIR / 'CITY'}")
    print(f" Master Excel  : {TARGET_EXCEL}")
    print(" Dashboard is read-only; add advice PDFs to the input folder.")
    print("=" * 72 + "\n", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[STOPPED] Dashboard and auto-sync stopped.")
    finally:
        stop_event.set()
        httpd.server_close()
        sync_thread.join(timeout=POLL_INTERVAL + 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="City Bank Auto-Sync Monitoring Dashboard")
    parser.add_argument("--host", default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "5000")), help="Port (default: 5000)")
    args = parser.parse_args()
    run_server(host=args.host, port=args.port)
