"""Deduplication & Hashing Engine."""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict

from engine.utils import format_date_str


def compute_file_hash(path: Path) -> str:
    """Compute SHA-256 hash for Tier 1 file-level deduplication."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_transaction_fingerprint(record: Dict[str, Any]) -> str:
    """Construct deterministic key for Tier 2 JSON transaction deduplication."""
    doc_type = (record.get("document_type") or "").strip().upper()
    bank_name = (record.get("bank", {}).get("name") or "").strip().upper()
    bank_date = (record.get("bank", {}).get("date") or "").strip()
    details = record.get("details", {})
    num = (
        details.get("lc_number")
        or details.get("iwlc_number")
        or details.get("bill_id")
        or ""
    ).strip()
    bill_id = str(details.get("bill_id") or details.get("invoice_number") or "").strip()
    amendment = str(details.get("no_of_amendment") or "").strip()
    amount = ""
    if isinstance(record.get("total_debited"), dict):
        total_val = record["total_debited"].get("amount")
        if total_val is not None:
            try:
                amount = f"{float(total_val):.2f}"
            except (ValueError, TypeError):
                amount = str(total_val).strip()
    return f"{doc_type}|{bank_name}|{num}|{bank_date}|{bill_id}|{amendment}|{amount}".upper()


def make_excel_transaction_fingerprint(
    doc_type: Any, bank_name: Any, lc_iwlc_num: Any, bank_date: Any,
    bill_id: Any, amendment: Any, total_amount: Any
) -> str:
    """Construct key for Tier 3 Excel row deduplication in Unified_Data."""
    dt = str(doc_type or "").strip().upper()
    bn = str(bank_name or "").strip().upper()
    num = str(lc_iwlc_num or "").strip()
    bdate = format_date_str(bank_date)
    bid = str(bill_id or "").strip()
    amd = str(amendment or "").strip()
    amt = ""
    if total_amount is not None and str(total_amount).strip() != "":
        try:
            amt = f"{float(total_amount):.2f}"
        except (ValueError, TypeError):
            amt = str(total_amount).strip()
    return f"{dt}|{bn}|{num}|{bdate}|{bid}|{amd}|{amt}".upper()


def make_excel_charge_fingerprint(doc_type: Any, lc_iwlc_num: Any, seq: Any, desc: Any, amount: Any) -> str:
    """Construct key for Tier 3 Excel row deduplication in Charges."""
    dt = str(doc_type or "").strip().upper()
    num = str(lc_iwlc_num or "").strip()
    s = str(seq or "").strip()
    d = str(desc or "").strip().upper()
    amt = ""
    if amount is not None and str(amount).strip() != "":
        try:
            amt = f"{float(amount):.2f}"
        except (ValueError, TypeError):
            amt = str(amount).strip()
    return f"{dt}|{num}|{s}|{d}|{amt}"


def load_registry(path: Path) -> Dict[str, Any]:
    """Load the file registry dictionary."""
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not all(isinstance(v, dict) for v in data.values()):
            raise ValueError(f"Invalid registry: {path}")
        return data
    return {}


def save_registry(registry: Dict[str, Any], path: Path) -> None:
    """Atomically save the file registry dictionary."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(path)

