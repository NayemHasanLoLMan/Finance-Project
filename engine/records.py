"""Record persistence and batch processing logic."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from engine.config import BANK_DISPLAY_NAMES, OUTPUT_JSON, REGISTRY_PATH, log
from engine.dedup import (
    compute_file_hash,
    get_transaction_fingerprint,
    load_registry,
    save_registry,
)
from engine.extractor import extract_advice_from_pdf


def load_records(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Load extracted trade records from JSON database."""
    target_path = path or OUTPUT_JSON
    if target_path.exists():
        data = json.loads(target_path.read_text(encoding="utf-8"))
        if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
            raise ValueError(f"Invalid record database: {target_path}")
        return data
    return []


def save_records(records: List[Dict[str, Any]], path: Optional[Path] = None) -> None:
    """Save extracted trade records to JSON database atomically."""
    target_path = path or OUTPUT_JSON
    target_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = target_path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(records, indent=2, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(target_path)


def process_advice_files(paths: List[Tuple[Path, str]]) -> List[Dict[str, Any]]:
    """Process PDF files with bank routing, update registry and JSON database.

    Args:
        paths: List of (pdf_path, bank_code) tuples.
    """
    registry = load_registry(REGISTRY_PATH)
    existing_records = load_records(OUTPUT_JSON)
    known_fingerprints: Set[str] = {get_transaction_fingerprint(r) for r in existing_records}

    new_records: List[Dict[str, Any]] = []

    for f, bank in paths:
        file_hash = compute_file_hash(f)

        # Tier 1: Check file hash
        if file_hash in registry:
            entry = registry[file_hash]
            if entry.get("status") in ("success", "duplicate", "non_advice"):
                log(f"[SKIPPED duplicate file] '{f.name}' (already recorded as {entry.get('status')})")
                continue

        try:
            record = extract_advice_from_pdf(f, bank)
        except Exception as e:
            log(f"[FAILED] [{bank}] '{f.name}': {e}")
            registry[file_hash] = {
                "filename": f.name, "bank": bank, "status": "failed",
                "error": str(e), "timestamp": datetime.now().isoformat()
            }
            continue

        if record is None:
            display = BANK_DISPLAY_NAMES.get(bank, bank)
            log(f"[SKIPPED non-advice] '{f.name}' (not a {display} trade advice)")
            registry[file_hash] = {
                "filename": f.name, "bank": bank, "status": "non_advice",
                "timestamp": datetime.now().isoformat()
            }
            continue

        fingerprint = get_transaction_fingerprint(record)

        # Tier 2: Check transaction fingerprint
        if fingerprint in known_fingerprints:
            log(f"[SKIPPED duplicate transaction] [{bank}] '{f.name}'")
            registry[file_hash] = {
                "filename": f.name, "bank": bank, "status": "duplicate",
                "fingerprint": fingerprint, "timestamp": datetime.now().isoformat()
            }
            continue

        known_fingerprints.add(fingerprint)
        new_records.append(record)
        existing_records.append(record)

        registry[file_hash] = {
            "filename": f.name, "bank": bank, "status": "success",
            "fingerprint": fingerprint,
            "document_type": record.get("document_type"),
            "sheet_name": record.get("sheet_name"),
            "timestamp": datetime.now().isoformat()
        }
        ref_num = (
            record.get("details", {}).get("lc_number")
            or record.get("details", {}).get("iwlc_number")
            or record.get("details", {}).get("bill_id")
            or ""
        )
        log(
            f"[EXTRACTED] [{bank}] '{f.name}' -> "
            f"{record.get('sheet_name', record.get('document_type'))} ({ref_num})"
        )

    if new_records:
        save_records(existing_records, OUTPUT_JSON)
    save_registry(registry, REGISTRY_PATH)

    return new_records

