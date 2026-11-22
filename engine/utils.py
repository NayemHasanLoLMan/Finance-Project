"""Common text, numeric, date, and PDF utilities."""

import re
import sys
from datetime import date, datetime
from itertools import groupby
from pathlib import Path
from typing import Any, Dict, List, Optional

# PDF Library imports
try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

if fitz is None and pdfplumber is None:
    print("Error: Neither 'pymupdf' nor 'pdfplumber' is installed.", file=sys.stderr)
    print("Run: pip install -r requirements.txt", file=sys.stderr)
    sys.exit(1)


def _num(text: str) -> float:
    """Parse a number string like '1,234.56' or '1,23,456.78' to float."""
    return float(text.replace(",", ""))


def _clean_text(text: str) -> str:
    """Normalize PDF text — replace replacement chars and excess whitespace."""
    text = text.replace("\ufffd", " ")     # HSBC PDFs use replacement chars
    text = text.replace("\u00a0", " ")     # non-breaking spaces
    text = re.sub(r"[ \t]+", " ", text)    # collapse horizontal whitespace
    return text


def _parse_date_flexible(s: str) -> Optional[str]:
    """Parse various date formats to YYYY-MM-DD string. Returns None on failure."""
    if not s or not isinstance(s, str):
        return None
    s = s.strip().rstrip(".")

    formats = [
        "%d-%b-%Y",        # 29-SEP-2026
        "%d-%b-%y",        # 29-SEP-26
        "%d-%m-%Y",        # 29-09-2026
        "%d-%m-%y",        # 09-JUL-26
        "%B %d, %Y",       # September 28, 2026
        "%b %d, %Y",       # Sep 28, 2026
        "%d%b%y",          # 01SEP26  (SCB format)
        "%d.%m.%Y",        # 05.10.2026
        "%Y-%m-%d",        # 2026-09-29
    ]

    # Handle SCB's compact date: "1SEP26" -> "01SEP26"
    m = re.match(r"^(\d{1,2})([A-Za-z]{3})(\d{2,4})$", s)
    if m:
        day, mon, yr = m.groups()
        s = f"{int(day):02d}{mon.upper()}{yr}"
        if len(yr) == 2:
            formats.insert(0, "%d%b%y")
        else:
            formats.insert(0, "%d%b%Y")

    for fmt in formats:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_date(date_val: Any) -> Optional[datetime]:
    """Parse string or datetime object into datetime."""
    if not date_val:
        return None
    if isinstance(date_val, (datetime, date)):
        if isinstance(date_val, datetime):
            return date_val
        return datetime(date_val.year, date_val.month, date_val.day)
    if isinstance(date_val, str):
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(date_val.strip(), fmt)
            except ValueError:
                pass
    return None


def format_date_str(val: Any) -> str:
    """Standardize date as YYYY-MM-DD string."""
    if not val:
        return ""
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    val_str = str(val).strip()
    d = parse_date(val_str)
    return d.strftime("%Y-%m-%d") if d else val_str


def _extract_text_from_pdf(path: Path, first_page_only: bool = False) -> str:
    """Extract text from a PDF file using PyMuPDF or pdfplumber."""
    if fitz is not None:
        doc = fitz.open(path)
        lines = []
        for page_number in range(min(1, len(doc)) if first_page_only else len(doc)):
            page = doc[page_number]
            words = page.get_text("words")
            words.sort(key=lambda w: (round(w[1] / 3) * 3, w[0]))
            for _, group in groupby(words, key=lambda w: round(w[1] / 3) * 3):
                line = " ".join(w[4] for w in sorted(group, key=lambda w: w[0]))
                lines.append(line)
        doc.close()
        return "\n".join(lines)
    elif pdfplumber is not None:
        with pdfplumber.open(path) as pdf:
            return "\n".join(page.extract_text() or "" for page in (pdf.pages[:1] if first_page_only else pdf.pages))
    raise RuntimeError("No PDF library available.")


def _build_unified_record(
    document_type: str,
    bank_name: str,
    bank_date: Optional[str],
    customer: str,
    customer_address: str,
    beneficiary: str,
    lc_number: Optional[str] = None,
    iwlc_number: Optional[str] = None,
    tenor: Optional[int] = None,
    conversion_rate: Optional[float] = None,
    lc_value_usd: Optional[float] = None,
    lc_value_bdt: Optional[float] = None,
    accpt_booked_usd: Optional[float] = None,
    bill_id: Optional[str] = None,
    bill_value_usd: Optional[float] = None,
    no_of_amendment: Optional[int] = None,
    value_increase_usd: Optional[float] = None,
    value_decrease_usd: Optional[float] = None,
    new_shipment_date: Optional[str] = None,
    new_expiry_date: Optional[str] = None,
    charges: Optional[List[Dict[str, Any]]] = None,
    debit_account: str = "",
    debit_currency: str = "BDT",
    total_debited_amount: Optional[float] = None,
    extra_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a standardized record dict that all bank parsers output."""
    details = {}
    if lc_number:
        details["lc_number"] = lc_number
    if iwlc_number:
        details["iwlc_number"] = iwlc_number
    if tenor is not None:
        details["tenor"] = tenor
    if conversion_rate is not None:
        details["conversion_rate"] = conversion_rate

    lc_val = {}
    if lc_value_usd is not None:
        lc_val["USD"] = lc_value_usd
    if lc_value_bdt is not None:
        lc_val["BDT"] = lc_value_bdt
    if lc_val:
        details["lc_value"] = lc_val

    if accpt_booked_usd is not None:
        details["accpt_booked_for"] = {"USD": accpt_booked_usd}
    if bill_id:
        details["bill_id"] = bill_id
    if bill_value_usd is not None:
        details["bill_value"] = {"USD": bill_value_usd}
    if no_of_amendment is not None:
        details["no_of_amendment"] = no_of_amendment
    if value_increase_usd is not None:
        details["value_increase"] = {"USD": value_increase_usd}
    if value_decrease_usd is not None:
        details["value_decrease"] = {"USD": value_decrease_usd}
    if new_shipment_date:
        details["new_shipment_date"] = new_shipment_date
    if new_expiry_date:
        details["new_expiry_date"] = new_expiry_date

    details.update({k: v for k, v in (extra_details or {}).items() if v is not None and v != ""})

    total = None
    if total_debited_amount is not None:
        total = {
            "account": debit_account,
            "currency": debit_currency,
            "amount": total_debited_amount,
        }

    return {
        "document_type": document_type,
        "bank": {"name": bank_name, "date": bank_date},
        "customer": customer,
        "customer_address": customer_address,
        "beneficiary": beneficiary,
        "details": details,
        "charges": charges or [],
        "total_debited": total,
    }

