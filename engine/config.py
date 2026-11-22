"""Configuration and constants for the City Bank advice pipeline."""

import os
from datetime import datetime
from pathlib import Path
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

# 1. Base paths
BASE_DIR = Path(__file__).resolve().parent.parent

# External dependencies (optional dotenv)
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

INPUT_DIR = (BASE_DIR / os.getenv("INPUT_DIR", "inputs")).resolve()
OUTPUT_JSON = (BASE_DIR / os.getenv("OUTPUT_JSON", "data/records.json")).resolve()
TARGET_EXCEL = (BASE_DIR / os.getenv("TARGET_EXCEL", "City_Bank_Advice_Summary.xlsx")).resolve()
REGISTRY_PATH = (BASE_DIR / os.getenv("REGISTRY_PATH", "data/registry.json")).resolve()
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "3.0"))

# Active bank folders — focused exclusively on City Bank PLC
BANK_FOLDERS = ["CITY"]
BANK_DISPLAY_NAMES = {
    "CITY": "City Bank PLC.",
}

# Single Master Excel Target Sheet & Headers
SHEET_NAME = "LC Acceptance"

CITY_ACCEPTANCE_COLUMNS = [
    ("A", "Bank Name", 21.0),
    ("B", "Bank Deduction Date", 20.0),
    ("C", "Unit Name", 29.0),
    ("D", "Vendor Name", 49.0),
    ("E", "LC Number", 20.0),
    ("F", "LC Issue Date", 19.0),
    ("G", "LC Value (USD)", 26.0),
    ("H", "Conversion Rate", 20.0),
    ("I", "Bill Value (USD)", 20.0),
    ("J", "Acceptance Commission (BDT)", 22.0),
    ("K", "SWIFT Charge Import Bills (BDT)", 24.0),
    ("L", "Total Debited (BDT)", 20.0),
    ("M", "Acceptance Commission (USD Equivalent)", 33.0),
    ("N", "SWIFT Charge Import Bills (USD Equivalent)", 35.0),
    ("O", "Total Debited (USD Equivalent)", 29.0),
]

CITY_ACCEPTANCE_HEADERS = [col[1] for col in CITY_ACCEPTANCE_COLUMNS]

CITY_AMENDMENT_COLUMNS = [
    ("A", "Bank Name", 21.0),
    ("B", "Bank Deduction Date", 20.0),
    ("C", "Unit Name", 29.0),
    ("D", "Vendor Name", 49.0),
    ("E", "LC Number", 20.0),
    ("F", "LC Issue Date", 19.0),
    ("G", "LC Value (USD)", 26.0),
    ("H", "Conversion Rate", 20.0),
    ("I", "LC Value (BDT)", 24.0),
    ("J", "No of Amendment", 18.0),
    ("K", "Value Increase (USD)", 22.0),
    ("L", "Value Decrease (USD)", 22.0),
    ("M", "New Shipment Date", 20.0),
    ("N", "New Expiry Date", 20.0),
    ("O", "Commission on Amendment (BDT)", 28.0),
    ("P", "SWIFT Charge LC Amendment (BDT)", 28.0),
    ("Q", "Total Debited (BDT)", 20.0),
    ("R", "LC Value (USD Equivalent)", 29.0),
    ("S", "Commission on Amendment (USD Equivalent)", 38.0),
    ("T", "SWIFT Charge LC Amendment (USD Equivalent)", 38.0),
    ("U", "Total Debited (USD Equivalent)", 29.0),
]

IWLC_ISSUANCE_COLUMNS = [
    ("A", "Bank Name", 21.0),
    ("B", "Bank Deduction Date", 20.0),
    ("C", "Unit Name", 29.0),
    ("D", "Vendor Name", 49.0),
    ("E", "IWLC Number", 20.0),
    ("F", "Conversion Rate", 20.0),
    ("G", "IWLC Value (USD)", 26.0),
    ("H", "IWLC Value (BDT)", 24.0),
    ("I", "Contract Registration Fee (BDT)", 29.0),
    ("J", "Certificate Charge (BDT)", 24.0),
    ("K", "Total Debited (BDT)", 20.0),
    ("L", "IWLC Value (USD Equivalent)", 30.0),
    ("M", "Contract Registration Fee (USD Equivalent)", 38.0),
    ("N", "Certificate Charge (USD Equivalent)", 34.0),
    ("O", "Total Debited (USD Equivalent)", 29.0),
]

CITY_SHEET_COLUMNS = {
    SHEET_NAME: CITY_ACCEPTANCE_COLUMNS,
    "LC Amendment": CITY_AMENDMENT_COLUMNS,
    "IWLC Issuance": IWLC_ISSUANCE_COLUMNS,
}
CITY_USD_EQUIVALENT_COLUMNS = {
    SHEET_NAME: {
        "Acceptance Commission (USD Equivalent)": (
            "Acceptance Commission (BDT)", "Conversion Rate",
        ),
        "SWIFT Charge Import Bills (USD Equivalent)": (
            "SWIFT Charge Import Bills (BDT)", "Conversion Rate",
        ),
        "Total Debited (USD Equivalent)": (
            "Total Debited (BDT)", "Conversion Rate",
        ),
    },
    "LC Amendment": {
        "LC Value (USD Equivalent)": ("LC Value (BDT)", "Conversion Rate"),
        "Commission on Amendment (USD Equivalent)": (
            "Commission on Amendment (BDT)", "Conversion Rate",
        ),
        "SWIFT Charge LC Amendment (USD Equivalent)": (
            "SWIFT Charge LC Amendment (BDT)", "Conversion Rate",
        ),
        "Total Debited (USD Equivalent)": (
            "Total Debited (BDT)", "Conversion Rate",
        ),
    },
    "IWLC Issuance": {
        "IWLC Value (USD Equivalent)": ("IWLC Value (BDT)", "Conversion Rate"),
        "Contract Registration Fee (USD Equivalent)": (
            "Contract Registration Fee (BDT)", "Conversion Rate",
        ),
        "Certificate Charge (USD Equivalent)": (
            "Certificate Charge (BDT)", "Conversion Rate",
        ),
        "Total Debited (USD Equivalent)": (
            "Total Debited (BDT)", "Conversion Rate",
        ),
    },
}
CITY_SHEET_HEADERS = {
    sheet: [column[1] for column in columns]
    for sheet, columns in CITY_SHEET_COLUMNS.items()
}
CITY_LEGACY_SHEET_HEADERS = {
    sheet: [
        column[1] for column in columns
        if column[1] not in CITY_USD_EQUIVALENT_COLUMNS[sheet]
    ]
    for sheet, columns in CITY_SHEET_COLUMNS.items()
}
CITY_DOCUMENT_KEYS = {
    SHEET_NAME: ("LC Number", "Bank Deduction Date", "Bill Value (USD)"),
    "LC Amendment": (
        "LC Number", "Bank Deduction Date", "No of Amendment",
        "Value Increase (USD)", "Value Decrease (USD)",
    ),
    "IWLC Issuance": ("IWLC Number", "Bank Deduction Date", "IWLC Value (USD)"),
}
CITY_TOTAL_COMPONENTS = {
    SHEET_NAME: ("Acceptance Commission (BDT)", "SWIFT Charge Import Bills (BDT)"),
    "LC Amendment": ("Commission on Amendment (BDT)", "SWIFT Charge LC Amendment (BDT)"),
    "IWLC Issuance": ("Contract Registration Fee (BDT)", "Certificate Charge (BDT)"),
}

# Backward compatibility alias
UNIFIED_HEADERS = CITY_ACCEPTANCE_HEADERS
EXTRA_COLUMNS = []

# Excel Formatting Constants
FMT_CURRENCY = r"#,##0.00"
FMT_RATE = r"0.00"
FMT_DATE = r"dd\-mm\-yyyy"
FMT_TEXT = "@"

FONT_HEADER = Font(name="Arial", size=11, bold=True, color="FFFFFFFF")
FILL_HEADER = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
ALIGN_HEADER = Alignment(horizontal="center", vertical="top", wrap_text=True)

FONT_DATA = Font(name="Arial", size=11, bold=False)
ALIGN_CENTER = Alignment(horizontal="center", vertical="center")
BORDER_THIN = Border(
    left=Side(style="thin", color="D9D9D9"),
    right=Side(style="thin", color="D9D9D9"),
    top=Side(style="thin", color="D9D9D9"),
    bottom=Side(style="thin", color="D9D9D9"),
)

# Canonical field order for record dictionary
FIELD_ORDER = (
    "document_type", "bank", "customer", "customer_address",
    "beneficiary", "details", "charges", "total_debited",
)


def log(msg: str) -> None:
    """Print timestamped console log."""
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{now_str}] {msg}", flush=True)
