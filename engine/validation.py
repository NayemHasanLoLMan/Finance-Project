"""Internal consistency checks for extracted City Bank advice records."""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Any, Dict, List, Optional

from engine.config import CITY_TOTAL_COMPONENTS, CITY_SHEET_HEADERS
from engine.excel_sync import record_to_sheet_row
from parsers.city import classify_city_advice

_TOLERANCE = 0.01


def validate_city_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """Check extracted values against arithmetic relationships printed in an advice."""
    issues: List[str] = []
    details = record.get("details") or {}
    review_note = details.get("review_notes") or record.get("review_notes")

    sheet_name = record.get("sheet_name")
    if sheet_name not in CITY_SHEET_HEADERS:
        sheet_name = classify_city_advice(
            record.get("document_type"), details, record.get("charges") or []
        )

    if sheet_name not in CITY_SHEET_HEADERS:
        issues.append("Advice type could not be classified for validation.")
    else:
        row = record_to_sheet_row(record, sheet_name)
        first_charge, second_charge = CITY_TOTAL_COMPONENTS[sheet_name]
        charge_values = (row.get(first_charge), row.get(second_charge))
        total_data = record.get("total_debited") or {}
        total = record.get("total_debited_bdt", total_data.get("amount"))
        if total_data.get("source") == "charge_sum":
            issues.append("Total Debited: not printed; value was calculated from listed charges.")
        if any(value is None for value in charge_values) or total is None:
            missing = [
                header for header, value in zip((first_charge, second_charge), charge_values)
                if value is None
            ]
            if total is None:
                missing.append("Total Debited (BDT)")
            issues.append(
                "Total Debited check unavailable; missing "
                + ", ".join(missing)
                + "."
            )
        else:
            try:
                charges_total = sum(Decimal(str(value)) for value in charge_values)
                printed_total = Decimal(str(total))
                difference = printed_total - charges_total
                if abs(difference) > Decimal(str(_TOLERANCE)):
                    issues.append(
                        f"Total Debited: expected BDT {charges_total:,.2f}; "
                        f"document BDT {printed_total:,.2f}; "
                        f"mismatch {difference:+,.2f} BDT."
                    )
            except (InvalidOperation, TypeError, ValueError):
                issues.append("Total Debited check failed: amount is not numeric.")

        conversion_values: Optional[tuple] = None
        if sheet_name == "LC Amendment":
            lc_value = details.get("lc_value") or {}
            conversion_values = (lc_value.get("USD"), lc_value.get("BDT"))
        elif sheet_name == "IWLC Issuance":
            iwlc_value = details.get("iwlc_value") or details.get("lc_value") or {}
            conversion_values = (iwlc_value.get("USD"), iwlc_value.get("BDT"))

        rate = details.get("conversion_rate")
        if conversion_values and all(value is not None for value in conversion_values) and rate is not None:
            try:
                usd_value, bdt_value = (Decimal(str(value)) for value in conversion_values)
                conversion_rate = Decimal(str(rate))
                if (
                    not usd_value.is_finite()
                    or not bdt_value.is_finite()
                    or not conversion_rate.is_finite()
                    or conversion_rate <= 0
                ):
                    raise ValueError("Conversion values must be finite and the rate positive.")
                expected_bdt = (usd_value * conversion_rate).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                difference = (bdt_value - expected_bdt).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
                if abs(difference) > Decimal(str(_TOLERANCE)):
                    value_label = "LC Value" if sheet_name == "LC Amendment" else "IWLC Value"
                    issues.append(
                        f"{value_label}: expected BDT {expected_bdt:,.2f}; "
                        f"document BDT {bdt_value:,.2f}; "
                        f"mismatch {difference:+,.2f} BDT."
                    )
            except (InvalidOperation, TypeError, ValueError):
                issues.append("Currency conversion check failed: amount or rate is invalid.")

    if review_note:
        issues.append(str(review_note))

    return {
        "status": "needs_review" if issues else "verified",
        "issues": issues,
    }
