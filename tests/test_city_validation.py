import unittest

from engine.validation import validate_city_record


class CityAdviceValidationTests(unittest.TestCase):
    def test_verifies_matching_charges_and_conversion(self):
        record = {
            "document_type": "IWLC ISSUANCE",
            "sheet_name": "IWLC Issuance",
            "details": {
                "iwlc_number": "IWLC-001",
                "iwlc_value": {"USD": 100.0, "BDT": 12330.0},
                "conversion_rate": 123.3,
                "contract_registration_fee": 500.0,
                "certificate_charge": 250.0,
            },
            "total_debited": {"amount": 750.0},
        }

        self.assertEqual(validate_city_record(record), {"status": "verified", "issues": []})

    def test_flags_charge_and_conversion_mismatches(self):
        record = {
            "document_type": "IWLC ISSUANCE",
            "sheet_name": "IWLC Issuance",
            "details": {
                "iwlc_number": "IWLC-001",
                "iwlc_value": {"USD": 100.0, "BDT": 12000.0},
                "conversion_rate": 123.3,
                "contract_registration_fee": 500.0,
                "certificate_charge": 250.0,
            },
            "total_debited": {"amount": 800.0},
        }

        result = validate_city_record(record)

        self.assertEqual(result["status"], "needs_review")
        self.assertEqual(len(result["issues"]), 2)
        self.assertEqual(
            result["issues"][0],
            "Total Debited: expected BDT 750.00; document BDT 800.00; mismatch +50.00 BDT.",
        )

    def test_reports_the_bank_fx_mismatch_with_both_values_and_difference(self):
        record = {
            "document_type": "LC AMENDMENT",
            "sheet_name": "LC Amendment",
            "details": {
                "lc_number": "LC-001",
                "lc_value": {"USD": 1511709.5, "BDT": 186696123.25},
                "conversion_rate": 123.3,
                "commission_on_amendment": 90463.99,
                "swift_charge": 500.0,
            },
            "charges": [],
            "total_debited": {"amount": 90963.99},
        }

        result = validate_city_record(record)
        fx_issue = next(issue for issue in result["issues"] if issue.startswith("LC Value:"))

        self.assertEqual(
            fx_issue,
            "LC Value: expected BDT 186,393,781.35; document BDT 186,696,123.25; "
            "mismatch +302,341.90 BDT.",
        )

    def test_preserves_existing_review_notes(self):
        record = {
            "document_type": "IWLC ISSUANCE",
            "sheet_name": "IWLC Issuance",
            "details": {
                "iwlc_value": {"USD": 100.0, "BDT": 12330.0},
                "conversion_rate": 123.3,
                "contract_registration_fee": 500.0,
                "certificate_charge": 250.0,
                "review_notes": "Bank confirmation required.",
            },
            "total_debited": {"amount": 750.0},
        }

        result = validate_city_record(record)

        self.assertEqual(result["status"], "needs_review")
        self.assertIn("Bank confirmation required.", result["issues"])

    def test_does_not_verify_a_calculated_total_as_a_printed_total(self):
        record = {
            "document_type": "IWLC ISSUANCE",
            "sheet_name": "IWLC Issuance",
            "details": {
                "iwlc_value": {"USD": 100.0, "BDT": 12330.0},
                "conversion_rate": 123.3,
                "contract_registration_fee": 500.0,
                "certificate_charge": 250.0,
            },
            "total_debited": {"amount": 750.0, "source": "charge_sum"},
        }

        result = validate_city_record(record)

        self.assertEqual(result["status"], "needs_review")
        self.assertIn(
            "Total Debited: not printed; value was calculated from listed charges.",
            result["issues"],
        )


if __name__ == "__main__":
    unittest.main()
