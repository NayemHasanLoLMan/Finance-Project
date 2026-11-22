import tempfile
import unittest
from pathlib import Path

import openpyxl

from engine.config import (
    CITY_LEGACY_SHEET_HEADERS,
    CITY_SHEET_HEADERS,
    CITY_USD_EQUIVALENT_COLUMNS,
    SHEET_NAME,
)
from engine.excel_sync import record_to_sheet_row, sync_records_to_excel
from parsers.city import classify_city_advice


def sample_records():
    return [
        {
            "document_type": "IPLC BILL ACCEPTANCE",
            "sheet_name": "LC Acceptance",
            "bank_name": "CITY BANK PLC.",
            "bank_deduction_date": "2026-09-23",
            "unit_name": "TEST UNIT",
            "vendor_name": "TEST VENDOR",
            "lc_number": "000001",
            "lc_issue_date": "2026-06-25",
            "lc_value_usd": 1000.0,
            "conversion_rate": 123.55,
            "bill_value_usd": 500.0,
            "acceptance_commission_bdt": 100.0,
            "swift_charge_bdt": 20.0,
            "total_debited_bdt": 120.0,
            "details": {"lc_number": "000001", "bill_value": {"USD": 500.0}},
        },
        {
            "document_type": "LC AMENDMENT",
            "sheet_name": "LC Amendment",
            "bank_name": "CITY BANK PLC.",
            "bank_deduction_date": "2026-10-04",
            "unit_name": "TEST UNIT",
            "vendor_name": "TEST VENDOR",
            "details": {
                "lc_number": "000002",
                "lc_issue_date": "2026-08-03",
                "lc_value": {"USD": 1500.0, "BDT": 184950.0},
                "conversion_rate": 123.3,
                "no_of_amendment": 3,
                "value_increase": {"USD": 700.0},
                "value_decrease": {"USD": 0.0},
                "new_shipment_date": "2026-10-15",
                "new_expiry_date": "2026-10-25",
                "commission_on_amendment": 200.0,
                "swift_charge": 50.0,
            },
            "charges": [],
        },
        {
            "document_type": "IWLC ISSUANCE",
            "sheet_name": "IWLC Issuance",
            "bank_name": "CITY BANK PLC.",
            "bank_deduction_date": "2026-10-04",
            "unit_name": "TEST UNIT",
            "vendor_name": "TEST VENDOR",
            "details": {
                "iwlc_number": "000003",
                "iwlc_value": {"USD": 1500.0, "BDT": 184950.0},
                "conversion_rate": 123.3,
                "contract_registration_fee": 500.0,
                "certificate_charge": 250.0,
            },
        },
    ]


class CityAdviceWorkbookTests(unittest.TestCase):
    def test_classifies_from_document_headers(self):
        self.assertEqual(
            classify_city_advice("LC AMENDMENT", {}, []),
            "LC Amendment",
        )
        self.assertEqual(
            classify_city_advice(None, {"iwlc_value": {"USD": 1}}, []),
            "IWLC Issuance",
        )
        self.assertEqual(
            classify_city_advice(
                None,
                {"bill_value": {"USD": 1}, "acceptance_commission": 1},
                [],
            ),
            SHEET_NAME,
        )
        self.assertIsNone(classify_city_advice("OTHER ADVICE", {}, []))

    def test_calculates_all_bdt_values_as_usd_equivalents(self):
        acceptance, amendment, iwlc = sample_records()

        acceptance_row = record_to_sheet_row(acceptance, "LC Acceptance")
        amendment_row = record_to_sheet_row(amendment, "LC Amendment")
        iwlc_row = record_to_sheet_row(iwlc, "IWLC Issuance")

        self.assertEqual(acceptance_row["Acceptance Commission (USD Equivalent)"], 0.81)
        self.assertEqual(acceptance_row["SWIFT Charge Import Bills (USD Equivalent)"], 0.16)
        self.assertEqual(acceptance_row["Total Debited (USD Equivalent)"], 0.97)
        self.assertEqual(amendment_row["LC Value (USD Equivalent)"], 1500.0)
        self.assertEqual(amendment_row["Commission on Amendment (USD Equivalent)"], 1.62)
        self.assertEqual(amendment_row["SWIFT Charge LC Amendment (USD Equivalent)"], 0.41)
        self.assertEqual(iwlc_row["IWLC Value (USD Equivalent)"], 1500.0)
        self.assertEqual(iwlc_row["Contract Registration Fee (USD Equivalent)"], 4.06)
        self.assertEqual(iwlc_row["Certificate Charge (USD Equivalent)"], 2.03)

    def test_every_bdt_column_has_a_usd_equivalent(self):
        for sheet_name, headers in CITY_SHEET_HEADERS.items():
            bdt_headers = {header for header in headers if header.endswith("(BDT)")}
            converted_headers = {
                bdt_header
                for bdt_header, _ in CITY_USD_EQUIVALENT_COLUMNS[sheet_name].values()
            }
            self.assertEqual(bdt_headers, converted_headers, sheet_name)

    def test_adds_and_deduplicates_all_advice_types(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "summary.xlsx"
            records = sample_records()
            self.assertEqual(sync_records_to_excel(records, target), (3, 0))
            self.assertEqual(sync_records_to_excel(records, target), (0, 3))

            wb = openpyxl.load_workbook(target, data_only=False)
            self.assertEqual(wb.sheetnames, list(CITY_SHEET_HEADERS))
            for sheet_name, headers in CITY_SHEET_HEADERS.items():
                ws = wb[sheet_name]
                self.assertEqual(ws.max_column, len(headers))
                self.assertEqual(
                    [ws.cell(1, col).value for col in range(1, len(headers) + 1)],
                    headers,
                )
                self.assertEqual(ws.max_row, 2)
                for header in CITY_USD_EQUIVALENT_COLUMNS[sheet_name]:
                    column = headers.index(header) + 1
                    self.assertTrue(ws.cell(2, column).value.startswith("="))
            self.assertEqual(wb["LC Acceptance"]["E2"].value, "000001")
            self.assertEqual(wb["LC Amendment"]["Q2"].value, "=O2+P2")
            self.assertEqual(wb["IWLC Issuance"]["K2"].value, "=I2+J2")
            self.assertEqual(
                wb["LC Acceptance"]["O2"].value,
                '=IF(OR(L2="",H2=""),"",IFERROR(ROUND(L2/H2,2),""))',
            )
            wb.close()

    def test_migrates_existing_acceptance_sheet_without_losing_columns(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "summary.xlsx"
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = SHEET_NAME
            for col, header in enumerate(CITY_LEGACY_SHEET_HEADERS[SHEET_NAME], 1):
                ws.cell(1, col, header)
            ws.cell(2, 1, "CITY BANK PLC.")
            ws.cell(2, 5, "LEGACY-001")
            ws.cell(2, 2, "2026-01-01")
            ws.cell(2, 9, 100.0)
            wb.save(target)
            wb.close()

            sync_records_to_excel(sample_records(), target)
            wb = openpyxl.load_workbook(target, data_only=False)
            self.assertEqual(wb.sheetnames, list(CITY_SHEET_HEADERS))
            self.assertEqual(wb[SHEET_NAME]["E2"].value, "LEGACY-001")
            self.assertEqual(wb[SHEET_NAME].max_column, len(CITY_SHEET_HEADERS[SHEET_NAME]))
            self.assertEqual(wb["LC Amendment"].max_column, len(CITY_SHEET_HEADERS["LC Amendment"]))
            self.assertEqual(wb["IWLC Issuance"].max_column, len(CITY_SHEET_HEADERS["IWLC Issuance"]))
            self.assertEqual(
                wb[SHEET_NAME]["O2"].value,
                '=IF(OR(L2="",H2=""),"",IFERROR(ROUND(L2/H2,2),""))',
            )
            wb.close()

    def test_rejects_modified_headers_without_removing_columns(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / "summary.xlsx"
            records = sample_records()
            sync_records_to_excel(records, target)
            wb = openpyxl.load_workbook(target)
            wb["LC Amendment"]["A1"] = "Unexpected Header"
            wb.save(target)
            wb.close()

            with self.assertRaises(ValueError):
                sync_records_to_excel([], target)

            wb = openpyxl.load_workbook(target, read_only=True)
            self.assertEqual(
                wb["LC Amendment"].max_column,
                len(CITY_SHEET_HEADERS["LC Amendment"]),
            )
            self.assertEqual(wb["LC Amendment"]["A1"].value, "Unexpected Header")
            wb.close()


if __name__ == "__main__":
    unittest.main()
