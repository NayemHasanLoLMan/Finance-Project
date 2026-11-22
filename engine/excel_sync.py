"""Synchronize City Bank advices into the matching sheets of one workbook."""

from pathlib import Path
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Set, Tuple

import openpyxl
from openpyxl.cell.cell import Cell
from openpyxl.utils import get_column_letter

from engine.config import (
    ALIGN_CENTER,
    ALIGN_HEADER,
    BORDER_THIN,
    CITY_DOCUMENT_KEYS,
    CITY_LEGACY_SHEET_HEADERS,
    CITY_SHEET_COLUMNS,
    CITY_SHEET_HEADERS,
    CITY_TOTAL_COMPONENTS,
    CITY_USD_EQUIVALENT_COLUMNS,
    FILL_HEADER,
    FMT_CURRENCY,
    FMT_DATE,
    FMT_RATE,
    FMT_TEXT,
    FONT_DATA,
    FONT_HEADER,
    SHEET_NAME,
    TARGET_EXCEL,
    log,
)
from engine.utils import parse_date
from parsers.city import classify_city_advice


def last_data_row(sheet: openpyxl.worksheet.worksheet.Worksheet) -> int:
    """Find the last row containing values or formulas."""
    row = sheet.max_row
    while row > 1 and all(cell.value in (None, "") for cell in sheet[row]):
        row -= 1
    return row


def _create_sheet(wb: openpyxl.Workbook, sheet_name: str) -> None:
    ws = wb.create_sheet(sheet_name)
    for column, (letter, header, width) in enumerate(CITY_SHEET_COLUMNS[sheet_name], 1):
        cell = ws.cell(1, column, header)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = ALIGN_HEADER
        cell.border = BORDER_THIN
        ws.column_dimensions[letter].width = width
    ws.row_dimensions[1].height = 28.0
    ws.freeze_panes = "A2"


def create_acceptance_workbook(excel_path: Path) -> openpyxl.Workbook:
    """Create the single City Bank workbook with all three advice sheets."""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for sheet_name in CITY_SHEET_COLUMNS:
        _create_sheet(wb, sheet_name)
    return wb


def validate_template_headers(
    sheet: openpyxl.worksheet.worksheet.Worksheet, sheet_name: str
) -> None:
    """Reject header changes instead of adding, deleting, or reordering columns."""
    headers = [
        cell.value
        for cell in sheet[1]
        if cell.value is not None and str(cell.value).strip()
    ]
    if headers != CITY_SHEET_HEADERS[sheet_name]:
        raise ValueError(f"Headers in '{sheet_name}' do not match the workbook template.")


def convert_bdt_to_usd(amount: Any, conversion_rate: Any) -> Optional[float]:
    if amount in (None, "") or conversion_rate in (None, ""):
        return None
    try:
        bdt = Decimal(str(amount))
        rate = Decimal(str(conversion_rate))
    except InvalidOperation as exc:
        raise ValueError("BDT amount and conversion rate must be numeric.") from exc
    if not bdt.is_finite() or not rate.is_finite() or rate <= 0:
        raise ValueError("BDT amount must be finite and conversion rate must be positive.")
    return float((bdt / rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _usd_formula(
    sheet_name: str,
    header: str,
    columns: Dict[str, int],
    row_index: int,
) -> str:
    bdt_header, rate_header = CITY_USD_EQUIVALENT_COLUMNS[sheet_name][header]
    bdt_cell = f"{get_column_letter(columns[bdt_header])}{row_index}"
    rate_cell = f"{get_column_letter(columns[rate_header])}{row_index}"
    return f'=IF(OR({bdt_cell}="",{rate_cell}=""),"",IFERROR(ROUND({bdt_cell}/{rate_cell},2),""))'


def _write_usd_formula(cell: Cell, formula: str) -> None:
    cell.font = FONT_DATA
    cell.alignment = ALIGN_CENTER
    cell.border = BORDER_THIN
    cell.value = formula
    cell.number_format = FMT_CURRENCY


def _migrate_usd_equivalent_columns(
    sheet: openpyxl.worksheet.worksheet.Worksheet,
    sheet_name: str,
) -> None:
    headers = [
        cell.value
        for cell in sheet[1]
        if cell.value is not None and str(cell.value).strip()
    ]
    if headers != CITY_LEGACY_SHEET_HEADERS[sheet_name]:
        return

    legacy_column_count = len(headers)
    if sheet.max_column > legacy_column_count:
        extra_values = [
            cell.value
            for row in sheet.iter_rows(min_col=legacy_column_count + 1)
            for cell in row
            if cell.value not in (None, "")
        ]
        if extra_values:
            raise ValueError(
                f"Cannot add USD equivalent columns to '{sheet_name}': "
                "unexpected data exists beyond the legacy template."
            )

    conversion_headers = list(CITY_USD_EQUIVALENT_COLUMNS[sheet_name])
    template_columns = CITY_SHEET_COLUMNS[sheet_name]
    for column_index, header in enumerate(conversion_headers, legacy_column_count + 1):
        cell = sheet.cell(1, column_index, header)
        cell.font = FONT_HEADER
        cell.fill = FILL_HEADER
        cell.alignment = ALIGN_HEADER
        cell.border = BORDER_THIN
        sheet.column_dimensions[template_columns[column_index - 1][0]].width = (
            template_columns[column_index - 1][2]
        )
    sheet.row_dimensions[1].height = 28.0

    columns = {
        header: index
        for index, header in enumerate(CITY_SHEET_HEADERS[sheet_name], 1)
    }
    for row_index in range(2, last_data_row(sheet) + 1):
        for header in conversion_headers:
            cell = sheet.cell(row_index, columns[header])
            _write_usd_formula(
                cell,
                _usd_formula(sheet_name, header, columns, row_index),
            )


def _first_value(*values: Any) -> Any:
    return next((value for value in values if value is not None and value != ""), None)


def _charge_amount(record: Dict[str, Any], label: str) -> Any:
    details = record.get("details") or {}
    if details.get(label) is not None:
        return details[label]
    for charge in record.get("charges") or []:
        if str(charge.get("description", "")).strip().casefold() == label.casefold():
            return charge.get("amount")
    return None


def record_to_sheet_row(record: Dict[str, Any], sheet_name: str) -> Dict[str, Any]:
    """Map extracted fields to the exact headers in the corresponding sheet."""
    details = record.get("details") or {}
    bank = record.get("bank") or {}
    lc_value = details.get("lc_value") or {}
    iwlc_value = details.get("iwlc_value") or {}
    increases = details.get("value_increase") or {}
    decreases = details.get("value_decrease") or {}
    bill_value = details.get("bill_value") or {}

    common = {
        "Bank Name": _first_value(record.get("bank_name"), bank.get("name"), "CITY BANK PLC."),
        "Bank Deduction Date": _first_value(record.get("bank_deduction_date"), bank.get("date")),
        "Unit Name": _first_value(record.get("unit_name"), record.get("customer"), ""),
        "Vendor Name": _first_value(record.get("vendor_name"), record.get("beneficiary"), ""),
        "LC Number": _first_value(details.get("lc_number"), details.get("iwlc_number"), record.get("lc_number")),
        "LC Issue Date": _first_value(record.get("lc_issue_date"), details.get("lc_issue_date")),
        "LC Value (USD)": _first_value(record.get("lc_value_usd"), lc_value.get("USD")),
        "Conversion Rate": _first_value(record.get("conversion_rate"), details.get("conversion_rate")),
    }

    if sheet_name == SHEET_NAME:
        row = {
            **common,
            "Bill Value (USD)": _first_value(record.get("bill_value_usd"), bill_value.get("USD")),
            "Acceptance Commission (BDT)": _first_value(
                record.get("acceptance_commission_bdt"),
                details.get("acceptance_commission"),
                _charge_amount(record, "Acceptance Commission"),
            ),
            "SWIFT Charge Import Bills (BDT)": _first_value(
                record.get("swift_charge_bdt"),
                details.get("swift_charge"),
                _charge_amount(record, "SWIFT Charge Import Bills"),
            ),
        }
    elif sheet_name == "LC Amendment":
        row = {
            **common,
            "LC Value (BDT)": lc_value.get("BDT"),
            "No of Amendment": details.get("no_of_amendment"),
            "Value Increase (USD)": increases.get("USD"),
            "Value Decrease (USD)": decreases.get("USD"),
            "New Shipment Date": details.get("new_shipment_date"),
            "New Expiry Date": details.get("new_expiry_date"),
            "Commission on Amendment (BDT)": _first_value(
                details.get("commission_on_amendment"),
                _charge_amount(record, "Commission on Amendment"),
            ),
            "SWIFT Charge LC Amendment (BDT)": _first_value(
                details.get("swift_charge"),
                _charge_amount(record, "SWIFT Charge LC Amendment"),
            ),
        }
    elif sheet_name == "IWLC Issuance":
        row = {
            "Bank Name": common["Bank Name"],
            "Bank Deduction Date": common["Bank Deduction Date"],
            "Unit Name": common["Unit Name"],
            "Vendor Name": common["Vendor Name"],
            "IWLC Number": _first_value(details.get("iwlc_number"), record.get("lc_number")),
            "Conversion Rate": common["Conversion Rate"],
            "IWLC Value (USD)": _first_value(iwlc_value.get("USD"), lc_value.get("USD")),
            "IWLC Value (BDT)": _first_value(iwlc_value.get("BDT"), lc_value.get("BDT")),
            "Contract Registration Fee (BDT)": _first_value(
                details.get("contract_registration_fee"),
                _charge_amount(record, "Contract Registration Fee"),
            ),
            "Certificate Charge (BDT)": _first_value(
                details.get("certificate_charge"),
                _charge_amount(record, "Certificate Charge"),
            ),
        }
    else:
        raise ValueError(f"Unsupported workbook sheet: {sheet_name}")

    total = record.get("total_debited") or {}
    total_amount = _first_value(record.get("total_debited_bdt"), total.get("amount"))
    if total_amount is None:
        first, second = CITY_TOTAL_COMPONENTS[sheet_name]
        if row.get(first) is not None and row.get(second) is not None:
            total_amount = float(row[first]) + float(row[second])
    row["Total Debited (BDT)"] = total_amount
    row = {header: row.get(header) for header in CITY_SHEET_HEADERS[sheet_name]}
    for usd_header, (bdt_header, rate_header) in CITY_USD_EQUIVALENT_COLUMNS[sheet_name].items():
        row[usd_header] = convert_bdt_to_usd(row.get(bdt_header), row.get(rate_header))
    return row


def _normalize_key(value: Any, header: str) -> str:
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


def _fingerprint(sheet_name: str, row: Dict[str, Any]) -> Tuple[str, ...]:
    return tuple(
        _normalize_key(row.get(header), header)
        for header in CITY_DOCUMENT_KEYS[sheet_name]
    )


def _sheet_for_record(record: Dict[str, Any]) -> Optional[str]:
    sheet_name = record.get("sheet_name")
    if sheet_name in CITY_SHEET_HEADERS:
        return sheet_name
    return classify_city_advice(
        record.get("document_type"),
        record.get("details") or {},
        record.get("charges") or [],
    )


def _write_cell(cell: Cell, header: str, value: Any) -> None:
    cell.font = FONT_DATA
    cell.alignment = ALIGN_CENTER
    cell.border = BORDER_THIN

    if "Date" in header:
        cell.value = parse_date(value) if value is not None else None
        if cell.value:
            cell.number_format = FMT_DATE
    elif header in ("LC Number", "IWLC Number"):
        cell.value = str(value or "")
        cell.number_format = FMT_TEXT
    elif header == "Conversion Rate":
        cell.value = float(value) if value is not None else None
        cell.number_format = FMT_RATE
    elif header == "No of Amendment":
        cell.value = int(value) if value is not None else None
        cell.number_format = "0"
    elif "USD" in header or "BDT" in header:
        cell.value = float(value) if value is not None else None
        cell.number_format = FMT_CURRENCY
    else:
        cell.value = value


def sync_records_to_excel(
    records: List[Dict[str, Any]],
    excel_path: Optional[Path] = None,
) -> Tuple[int, int]:
    """Append records to the single workbook, routed by their advice type."""
    target = Path(excel_path or TARGET_EXCEL)
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists():
        wb = openpyxl.load_workbook(target)
    else:
        log(f"Creating City Bank summary workbook at '{target}'")
        wb = create_acceptance_workbook(target)

    try:
        for sheet_name in CITY_SHEET_HEADERS:
            if sheet_name not in wb.sheetnames:
                _create_sheet(wb, sheet_name)
            else:
                _migrate_usd_equivalent_columns(wb[sheet_name], sheet_name)
            validate_template_headers(wb[sheet_name], sheet_name)

        column_maps = {
            sheet: {header: index for index, header in enumerate(headers, 1)}
            for sheet, headers in CITY_SHEET_HEADERS.items()
        }
        next_rows = {
            sheet: last_data_row(wb[sheet])
            for sheet in CITY_SHEET_HEADERS
        }
        existing_keys: Dict[str, Set[Tuple[str, ...]]] = {
            sheet: set() for sheet in CITY_SHEET_HEADERS
        }

        for sheet_name, headers in CITY_SHEET_HEADERS.items():
            for row_index in range(2, next_rows[sheet_name] + 1):
                row = {
                    header: wb[sheet_name].cell(row_index, col).value
                    for header, col in column_maps[sheet_name].items()
                }
                if row.get(CITY_DOCUMENT_KEYS[sheet_name][0]):
                    existing_keys[sheet_name].add(_fingerprint(sheet_name, row))

        added = skipped = 0
        for record in records:
            sheet_name = _sheet_for_record(record)
            if sheet_name is None:
                log(f"[SKIPPED] Unclassified City Bank advice: {record.get('document_type', 'unknown')}")
                continue

            row = record_to_sheet_row(record, sheet_name)
            reference = CITY_DOCUMENT_KEYS[sheet_name][0]
            if not row.get(reference):
                log(f"[SKIPPED] {record.get('document_type', 'Advice')} has no {reference}")
                continue

            key = _fingerprint(sheet_name, row)
            if key in existing_keys[sheet_name]:
                skipped += 1
                continue

            ws = wb[sheet_name]
            next_rows[sheet_name] += 1
            row_index = next_rows[sheet_name]
            ws.row_dimensions[row_index].height = 20.0
            columns = column_maps[sheet_name]

            for header in CITY_SHEET_HEADERS[sheet_name]:
                cell = ws.cell(row_index, columns[header])
                if header == "Total Debited (BDT)":
                    first, second = CITY_TOTAL_COMPONENTS[sheet_name]
                    cell.font = FONT_DATA
                    cell.alignment = ALIGN_CENTER
                    cell.border = BORDER_THIN
                    cell.value = (
                        f"={get_column_letter(columns[first])}{row_index}"
                        f"+{get_column_letter(columns[second])}{row_index}"
                    )
                    cell.number_format = FMT_CURRENCY
                elif header in CITY_USD_EQUIVALENT_COLUMNS[sheet_name]:
                    _write_usd_formula(
                        cell,
                        _usd_formula(sheet_name, header, columns, row_index),
                    )
                else:
                    _write_cell(cell, header, row.get(header))

            existing_keys[sheet_name].add(key)
            added += 1

        wb.calculation.fullCalcOnLoad = True
        wb.calculation.forceFullCalc = True
        wb.calculation.calcMode = "auto"
        wb.save(target)
    finally:
        wb.close()

    return added, skipped
