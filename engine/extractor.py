"""PDF trade advice extraction router for City Bank PLC."""

from pathlib import Path
from typing import Any, Callable, Dict, Optional

from engine.config import BANK_DISPLAY_NAMES
from engine.dedup import compute_file_hash
from engine.utils import _extract_text_from_pdf
from parsers.city import parse_city_advice

# Active bank parsers: City Bank PLC
BANK_PARSERS: Dict[str, Callable[[str], Optional[Dict[str, Any]]]] = {
    "CITY": parse_city_advice,
}


def detect_bank_from_path(pdf_path: Path) -> str:
    """Default to City Bank PLC."""
    return "CITY"


def extract_advice_from_pdf(path: Path, bank: str = "CITY") -> Optional[Dict[str, Any]]:
    """Extract trade advice from City Bank PDF using parse_city_advice."""
    try:
        text = _extract_text_from_pdf(path, first_page_only=True)
        if ("STATEMENT ON DEMAND" in text.upper() or "Statement details" in text
                or "Transaction History" in text
                or all(label in text for label in ("TRANSACTION DATE", "WITHDRAW", "BALANCE"))):
            return None
        text = _extract_text_from_pdf(path)
    except Exception as e:
        raise RuntimeError(f"Failed to read PDF '{path.name}': {e}")

    record = parse_city_advice(text)
    if record:
        record["source_file"] = f"CITY/{path.name}"
        record["source_sha256"] = compute_file_hash(path)
    return record
