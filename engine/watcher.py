"""Folder watcher and scan workflow engine for City Bank LC Acceptance."""

import time
from pathlib import Path
from typing import Dict, List, Set, Tuple

from engine.config import INPUT_DIR, REGISTRY_PATH, TARGET_EXCEL, log
from engine.dedup import compute_file_hash, load_registry
from engine.excel_sync import sync_records_to_excel
from engine.records import load_records, process_advice_files


def is_file_ready(path: Path, wait_sec: float = 1.0, max_attempts: int = 5) -> bool:
    """Ensure incoming file has finished downloading/writing."""
    if not path.exists():
        return False
    prev_size = -1
    for _ in range(max_attempts):
        try:
            curr_size = path.stat().st_size
            if curr_size == prev_size and curr_size > 0:
                with open(path, "rb") as f:
                    f.read(1024)
                return True
            prev_size = curr_size
        except (OSError, PermissionError):
            pass
        time.sleep(wait_sec)
    return False


def scan_and_process() -> int:
    """Scan City Bank PDFs and sync records into the master workbook."""
    registry = load_registry(REGISTRY_PATH)
    unprocessed: List[Tuple[Path, str]] = []
    seen_files: Set[Path] = set()

    # Search paths: inputs/ and inputs/CITY
    search_dirs = [INPUT_DIR / "CITY", INPUT_DIR]

    for watch_dir in search_dirs:
        if not watch_dir.exists():
            continue

        pdf_files = sorted(watch_dir.glob("*.pdf"))
        for f in pdf_files:
            if f in seen_files or f.name.startswith("~") or f.name.startswith("."):
                continue
            seen_files.add(f)
            try:
                file_hash = compute_file_hash(f)
                if file_hash in registry and registry[file_hash].get("status") in ("success", "duplicate", "non_advice"):
                    entry = registry[file_hash]
                    if entry.get("filename") != f.name:
                        log(f"[SKIPPED duplicate content] '{f.name}' matches "
                            f"'{entry.get('filename')}' ({entry.get('status')})")
                    continue
                if is_file_ready(f):
                    unprocessed.append((f, "CITY"))
            except (OSError, PermissionError) as e:
                log(f"Warning: Cannot access '{f.name}': {e}")
                continue

    if unprocessed:
        names = [f.name for f, _ in unprocessed]
        log(f"Found {len(names)} new/pending City Bank PDF(s): {names}")

    new_records = process_advice_files(unprocessed) if unprocessed else []

    # Sync the complete record store so existing records are included after migration.
    all_records = load_records()
    if all_records:
        added, skipped = sync_records_to_excel(all_records)
        if added:
            log(f"Auto-sync complete: {added} new row(s) synchronized to '{TARGET_EXCEL.name}'.")

    return len(new_records)
