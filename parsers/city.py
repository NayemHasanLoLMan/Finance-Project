"""City Bank Trade Transaction Advice Parser.

Extracts structured LC Acceptance, Amendment, and Issuance records
from City Bank PLC trade transaction advice documents.
"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from engine.config import FIELD_ORDER
from engine.utils import _clean_text, _num, _parse_date_flexible


def classify_city_advice(
    document_type: Optional[str],
    details: Dict[str, Any],
    charges: List[Dict[str, Any]],
) -> Optional[str]:
    """Classify an advice from its title and extracted field labels, not its filename."""
    doc_type = (document_type or "").upper()
    charge_labels = " ".join(
        str(charge.get("description", "")).upper() for charge in charges
    )

    if (
        "AMENDMENT" in doc_type
        or details.get("no_of_amendment") is not None
        or "COMMISSION ON AMENDMENT" in charge_labels
    ):
        return "LC Amendment"
    if (
        "IWLC" in doc_type
        or details.get("iwlc_value")
        or "CONTRACT REGISTRATION FEE" in charge_labels
        or "CERTIFICATE CHARGE" in charge_labels
    ):
        return "IWLC Issuance"
    if (
        "ACCEPTANCE" in doc_type
        or (
            (details.get("bill_value") or {}).get("USD") is not None
            and details.get("acceptance_commission") is not None
        )
    ):
        return "LC Acceptance"
    return None


def _parse_city_date(text: Optional[str]) -> Optional[str]:
    """Parse date from City Bank formats to YYYY-MM-DD."""
    if not text:
        return None
    return _parse_date_flexible(text)


def parse_city_advice(text: str) -> Optional[Dict[str, Any]]:
    """Parse a City Bank trade transaction advice PDF text."""
    if not text or "TRANSACTION ADVICE" not in text.upper():
        return None

    # Skip account statement reports
    if "STATEMENT ON DEMAND" in text.upper() or "WITHDRAW" in text.upper() and "DEPOSIT" in text.upper():
        return None

    text = _clean_text(text)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    # 1. Bank Name
    bank_name = "CITY BANK PLC."
    if lines and "BANK" in lines[0].upper():
        bank_name = lines[0].upper().rstrip(".") + "."

    # 2. Document Type, Customer / Unit Name, Bank Advice Date
    doc_type = None
    customer = None
    advice_date = None
    address_lines: List[str] = []

    for i, ln in enumerate(lines):
        tm = re.search(r"TRANSACTION ADVICE\s*[-–—\ufffd]\s*(.+)", ln, re.IGNORECASE)
        if tm:
            doc_type = tm.group(1).strip()
            # The line following TRANSACTION ADVICE is Customer / Unit Name
            if i + 1 < len(lines):
                nxt = lines[i + 1]
                dm = re.search(r"(\d{2}-\d{2}-\d{4})$", nxt)
                if dm:
                    customer = nxt[:dm.start()].strip()
                    advice_date = _parse_city_date(dm.group(1))
                else:
                    customer = nxt.strip()

            # Find deduction/advice date in subsequent lines before BENEFICIARY
            for sub_ln in lines[i + 1:]:
                if "BENEFICIARY" in sub_ln.upper():
                    break
                dm = re.search(r"\b(\d{2}-\d{2}-\d{4})\b", sub_ln)
                if dm and not advice_date:
                    advice_date = _parse_city_date(dm.group(1))
                elif not dm and sub_ln != customer and "ADDRESS" not in sub_ln.upper():
                    address_lines.append(sub_ln)
            break

    if not doc_type:
        return None

    # Fallback for advice date
    if not advice_date:
        dm = re.search(r"\b(\d{2}-\d{2}-\d{4})\b", text)
        if dm:
            advice_date = _parse_city_date(dm.group(1))

    # 3. Beneficiary / Vendor Name
    vm = re.search(
        r"BENEFICIARY\s*:\s*\n?([^\n]+(?:\n(?!(?:LC Number|IWLC Number|Bill Maturity Date|CHARGE DETAILS|\d{4}-\d{2}-\d{2}))[^\n]+)*)",
        text,
        re.IGNORECASE,
    )
    beneficiary = " ".join(ln.strip() for ln in vm.group(1).splitlines() if ln.strip()) if vm else None
    if not beneficiary:
        bm = re.search(r"BENEFICIARY\s*:\s*(.+)", text, re.IGNORECASE)
        if bm:
            beneficiary = bm.group(1).strip()

    # 4. LC / Contract Identification & Values
    details: Dict[str, Any] = {}

    # LC Number or IWLC Number
    lm = re.search(r"(?:LC Number|IWLC Number)\s*\n?\s*(\S+)", text, re.IGNORECASE)
    lc_number = lm.group(1).strip() if lm else None
    if lc_number:
        if "IWLC" in text.upper():
            details["iwlc_number"] = lc_number
        details["lc_number"] = lc_number

    # LC Issue Date
    idm = re.search(r"LC Issue Date\s*\n?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})", text, re.IGNORECASE)
    if idm:
        details["lc_issue_date"] = _parse_city_date(idm.group(1))

    # LC Value (USD and BDT)
    lvm_usd = re.search(r"(?:LC Value|IWLC Value)\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if lvm_usd:
        details.setdefault("lc_value", {})["USD"] = _num(lvm_usd.group(1))
        if "IWLC" in text.upper():
            details.setdefault("iwlc_value", {})["USD"] = _num(lvm_usd.group(1))

    lvm_bdt = re.search(r"(?:LC Value|IWLC Value)\s*\n?\s*BDT\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if lvm_bdt:
        details.setdefault("lc_value", {})["BDT"] = _num(lvm_bdt.group(1))
        if "IWLC" in text.upper():
            details.setdefault("iwlc_value", {})["BDT"] = _num(lvm_bdt.group(1))

    # Conversion Rate
    crm = re.search(r"Conversion Rate\s*\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if crm:
        details["conversion_rate"] = _num(crm.group(1))

    # Tenor
    tnm = re.search(r"Tenor\s*\n?\s*(\d+)", text, re.IGNORECASE)
    if tnm:
        details["tenor"] = int(tnm.group(1))

    # Bill Maturity Date
    bmm = re.search(r"Bill Maturity Date\s*\n?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})", text, re.IGNORECASE)
    if bmm:
        details["bill_maturity_date"] = _parse_city_date(bmm.group(1))

    # Bill ID
    bidm = re.search(r"Bill ID\s*\n?\s*(\S+)", text, re.IGNORECASE)
    if bidm:
        details["bill_id"] = bidm.group(1).strip()

    # Bill Value (USD)
    bvm = re.search(r"Bill Value\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if not bvm:
        bvm = re.search(r"Accpt Booked for\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if bvm:
        details.setdefault("bill_value", {})["USD"] = _num(bvm.group(1))

    # Accpt Booked for
    abm = re.search(r"Accpt Booked for\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if abm:
        details.setdefault("accpt_booked_for", {})["USD"] = _num(abm.group(1))

    # Amendments
    no_amd = re.search(r"No of Amendment\s*\n?\s*(\d+)", text, re.IGNORECASE)
    if no_amd:
        details["no_of_amendment"] = int(no_amd.group(1))

    val_inc = re.search(r"Value Increase\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if val_inc:
        details.setdefault("value_increase", {})["USD"] = _num(val_inc.group(1))

    val_dec = re.search(r"Value Decrease\s*\n?\s*USD\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if val_dec:
        details.setdefault("value_decrease", {})["USD"] = _num(val_dec.group(1))

    new_shp = re.search(r"New Shipment Date\s*\n?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})", text, re.IGNORECASE)
    if new_shp:
        details["new_shipment_date"] = _parse_city_date(new_shp.group(1))

    new_exp = re.search(r"New Expiry Date\s*\n?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})", text, re.IGNORECASE)
    if new_exp:
        details["new_expiry_date"] = _parse_city_date(new_exp.group(1))

    # 5. Charges Section
    charges: List[Dict[str, Any]] = []

    # Acceptance Commission
    ac_match = re.search(r"Acceptance Commission\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if ac_match:
        comm_val = _num(ac_match.group(1))
        charges.append({"description": "Acceptance Commission", "currency": "BDT", "amount": comm_val})
        details["acceptance_commission"] = comm_val

    # SWIFT Charge Import Bills / LC Amendment
    sw_match = re.search(r"SWIFT Charge(?:\s+[^\n\r]+)?\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if sw_match:
        # Determine specific description
        desc = "SWIFT Charge Import Bills"
        if "SWIFT Charge LC Amendment" in text:
            desc = "SWIFT Charge LC Amendment"
        swift_val = _num(sw_match.group(1))
        charges.append({"description": desc, "currency": "BDT", "amount": swift_val})
        details["swift_charge"] = swift_val

    # Commission on Amendment
    amd_comm = re.search(r"Commission on Amendment\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if amd_comm:
        val = _num(amd_comm.group(1))
        charges.append({"description": "Commission on Amendment", "currency": "BDT", "amount": val})
        details["commission_on_amendment"] = val

    # Contract Registration Fee
    crf_match = re.search(r"Contract Registration Fee\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if crf_match:
        val = _num(crf_match.group(1))
        charges.append({"description": "Contract Registration Fee", "currency": "BDT", "amount": val})
        details["contract_registration_fee"] = val

    # Certificate Charge
    cert_match = re.search(r"Certificate Charge\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if cert_match:
        val = _num(cert_match.group(1))
        charges.append({"description": "Certificate Charge", "currency": "BDT", "amount": val})
        details["certificate_charge"] = val

    # Generic charges fallback if specific charges not matched
    if not charges and "CHARGE DETAILS" in text:
        charge_block = text.split("CHARGE DETAILS")[-1].split("Total Debited")[0]
        for cln in charge_block.splitlines():
            cln = cln.strip()
            cm = re.match(r"^(.+?)\s+BDT\s+([\d,]+\.\d{2})$", cln)
            if cm:
                charges.append({"description": cm.group(1).strip(), "currency": "BDT", "amount": _num(cm.group(2))})

    # 6. Total Debited
    tot_match = re.search(r"Total Debited:?\s*(\d*)\s*(?:\n?\s*BDT\s*)?\n?\s*([\d,]+\.?\d*)", text, re.IGNORECASE)
    if tot_match:
        account_num = tot_match.group(1).strip()
        total_amount = _num(tot_match.group(2))
        total_debited = {
            "account": account_num, "currency": "BDT", "amount": total_amount,
            "source": "advice",
        }
    else:
        # Sum from charges if total line missing
        sum_amt = round(sum(c["amount"] for c in charges), 2) if charges else 0.0
        total_debited = {
            "account": "", "currency": "BDT", "amount": sum_amt,
            "source": "charge_sum",
        }

    sheet_name = classify_city_advice(doc_type, details, charges)
    if sheet_name is None:
        return None

    # Direct convenience fields used by the City Bank summary sheets
    lc_val_usd = (details.get("lc_value") or {}).get("USD")
    bill_val_usd = (details.get("bill_value") or {}).get("USD")
    comm_bdt = details.get("acceptance_commission")
    swift_bdt = details.get("swift_charge")

    doc: Dict[str, Any] = {
        "document_type": doc_type,
        "sheet_name": sheet_name,
        "bank": {"name": bank_name, "date": advice_date},
        "customer": customer or "",
        "customer_address": " ".join(address_lines[:3]),
        "beneficiary": beneficiary or "",
        "details": details,
        "charges": charges,
        "total_debited": total_debited,
        # Flattened template fields
        "bank_name": bank_name,
        "bank_deduction_date": advice_date,
        "unit_name": customer or "",
        "vendor_name": beneficiary or "",
        "lc_number": lc_number or "",
        "lc_issue_date": details.get("lc_issue_date"),
        "lc_value_usd": lc_val_usd,
        "conversion_rate": details.get("conversion_rate"),
        "bill_value_usd": bill_val_usd,
        "acceptance_commission_bdt": comm_bdt,
        "swift_charge_bdt": swift_bdt,
        "total_debited_bdt": total_debited.get("amount"),
    }

    return doc
