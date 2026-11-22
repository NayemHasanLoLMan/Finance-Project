# City Bank Trade Advice Auto-Sync

The pipeline extracts City Bank advice PDFs and continuously updates one master workbook: `City_Bank_Advice_Summary.xlsx`. Advice is classified from its document title and field labels, then written to the matching sheet. The monitoring dashboard is read-only; it does not upload files or trigger scans manually.

## Workbook template

The workbook contains the advice fields plus calculated USD-equivalent columns on these sheets:

- **LC Acceptance** — 15 columns
- **LC Amendment** — 21 columns
- **IWLC Issuance** — 15 columns

Rows are routed by advice type. Each BDT amount has a USD equivalent calculated from that advice's conversion rate, rounded to two decimals. The workbook uses formulas so USD equivalents update when the BDT amount or rate changes. Existing workbooks are migrated by appending the new columns while preserving existing data; unexpected template changes are rejected.

## Run

Start the dashboard and its background auto-sync worker:

```powershell
python app.py
```

Open [http://localhost:5000](http://localhost:5000). New PDFs placed in `inputs/CITY/` are processed automatically, and the dashboard refreshes pipeline status, workbook records, and audit history. Use `run.ps1` to launch the dashboard on Windows.

The dashboard tracks received and successfully extracted advice. Its Advice Data tab shows workbook rows in one read-only list; expand a row to see all template fields and any review reasons. Its data checks reconcile printed charge totals and available USD/BDT conversions; records with mismatches or existing review notes are flagged with the measured difference. These checks are internal consistency checks, not confirmation from the bank. **Download Excel** saves the workbook so it can be opened in Excel.

The dashboard follows the EPIC Pulse UI Kit v1.0 visual standard. Its required styles and Exo font are bundled under `static/epic-pulse/`; the font license is included in `static/epic-pulse/THIRD_PARTY_NOTICES`.

For command-line pipeline operation without the dashboard:

```powershell
python main.py --once
python main.py
```

Run either the dashboard worker or the standalone CLI watcher against a workbook at a time; they share the same input, registry, and output files.

## Configuration and data

`.env` configures the input folder, JSON record store, master workbook, registry, and polling interval. The workbook is created with the template sheets when it does not exist. Existing workbook rows are preserved during migration and synchronization.

The generated workbook and local bank advice files are excluded from Git so financial records are not published with the source code.

```text
Finance Project/
├── City_Bank_Advice_Summary.xlsx
├── app.py
├── main.py
├── engine/
├── parsers/
├── inputs/CITY/
├── data/
├── templates/
├── static/
└── tests/
```

Validate changes with:

```powershell
python -m unittest discover -s tests -v
```
