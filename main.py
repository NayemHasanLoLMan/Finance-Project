#!/usr/bin/env python3
"""City Bank PLC trade advice automation pipeline.

Single-command production script:
    python main.py
    python main.py --once

Automatically detects new PDF advices in the inputs/ or inputs/CITY folder, extracts
their template fields, and updates the single master workbook.
"""

import argparse
import sys
import time
from pathlib import Path

from engine.config import (
    CITY_SHEET_HEADERS,
    INPUT_DIR,
    OUTPUT_JSON,
    POLL_INTERVAL,
    TARGET_EXCEL,
    log,
)
from engine.watcher import scan_and_process


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Scan and synchronize once, then exit.")
    args = parser.parse_args()

    city_folder = INPUT_DIR / "CITY"
    city_status = "OK" if city_folder.exists() else "MISSING"

    print("=" * 72)
    print("   CITY BANK PLC - TRADE ADVICE PIPELINE (CONTINUOUS AUTO-SYNC)   ")
    print("=" * 72)
    print(f" Monitored Folder: {city_folder} [{city_status}]")
    print(f" Single Master   : {TARGET_EXCEL}")
    print(f" JSON Database   : {OUTPUT_JSON}")
    print(f" Deduplication   : Active (SHA-256 Hash | JSON | Excel Row Key)")
    print(f" Polling Rate    : Every {POLL_INTERVAL} seconds")
    print()
    for sheet_name, headers in CITY_SHEET_HEADERS.items():
        print(f" {sheet_name}: {len(headers)} template columns")
    print()
    print(" Action : Drop City Bank advice PDFs into inputs/CITY to auto-process.")
    print(" Press Ctrl + C to stop at any time.")
    print("=" * 72 + "\n", flush=True)

    try:
        while True:
            try:
                scan_and_process()
            except (OSError, ValueError) as exc:
                log(f"[FAILED] Scan/sync: {exc}")
                if args.once:
                    return 1
            if args.once:
                return 0
            time.sleep(POLL_INTERVAL)

    except KeyboardInterrupt:
        print("\n[STOPPED] Pipeline watcher stopped by user.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
