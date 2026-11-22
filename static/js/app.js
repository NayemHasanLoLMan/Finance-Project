document.addEventListener('DOMContentLoaded', () => {
    let adviceRecords = [];
    const expandedRecordKeys = new Set();
    let registryJson = '';
    let recordsRequestActive = false;
    let registryRequestActive = false;

    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const statusIndicator = document.getElementById('system-status');
    const statusLabel = document.getElementById('status-label');
    const kpiTotalRecords = document.getElementById('kpi-total-records');
    const kpiTotalReceived = document.getElementById('kpi-total-received');
    const kpiVerified = document.getElementById('kpi-verified');
    const kpiNeedsReview = document.getElementById('kpi-needs-review');
    const tabRecordsCount = document.getElementById('tab-records-count');
    const recordSearch = document.getElementById('record-search');
    const recordsTbody = document.getElementById('records-tbody');
    const recordsSummaryCount = document.getElementById('records-summary-count');
    const registryTbody = document.getElementById('registry-tbody');

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(value) {
        const number = Number(value);
        return Number.isFinite(number)
            ? number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-';
    }

    function formatCell(header, value) {
        if (value === null || value === undefined || value === '') return '-';
        if (typeof value === 'number' && (header.includes('(USD') || header.includes('(BDT)'))) {
            return formatCurrency(value);
        }
        if (typeof value === 'number' && header === 'Conversion Rate') return value.toFixed(2);
        return String(value);
    }

    function getRecordKey(record) {
        const values = record.values || {};
        return JSON.stringify([
            record.advice_type || '',
            record.reference || values['LC Number'] || values['IWLC Number'] || '',
            record.advice_date || values['Bank Deduction Date'] || '',
            record.unit_name || values['Unit Name'] || '',
            record.vendor_name || values['Vendor Name'] || ''
        ]);
    }

    function renderDataCheck(record) {
        const checks = {
            verified: ['badge-success', 'Verified'],
            needs_review: ['badge-warning', 'Needs review'],
            not_checked: ['badge-neutral', 'Not checked']
        };
        const [badgeClass, label] = checks[record.data_check] || checks.not_checked;
        return `<span class="badge ${badgeClass}">${label}</span>`;
    }

    function renderIssueSummary(record) {
        const issues = record.data_check_details || [];
        if (record.data_check !== 'needs_review' || !issues.length) return '<span class="issue-none">-</span>';
        return `<div class="issue-summary">${issues.map(issue => `<div class="issue-summary-item">${escapeHtml(issue)}</div>`).join('')}</div>`;
    }

    function validateAdviceValues(adviceType, values) {
        const chargeFields = {
            'LC Acceptance': ['Acceptance Commission (BDT)', 'SWIFT Charge Import Bills (BDT)'],
            'LC Amendment': ['Commission on Amendment (BDT)', 'SWIFT Charge LC Amendment (BDT)'],
            'IWLC Issuance': ['Contract Registration Fee (BDT)', 'Certificate Charge (BDT)']
        };
        const issues = [];
        const fields = chargeFields[adviceType] || [];
        const chargeValues = fields.map(header => values[header]);
        const total = values['Total Debited (BDT)'];
        if (chargeValues.some(value => value === null || value === undefined || value === '') || total === null || total === undefined || total === '') {
            const missing = fields.filter((header, index) => chargeValues[index] === null || chargeValues[index] === undefined || chargeValues[index] === '');
            if (total === null || total === undefined || total === '') missing.push('Total Debited (BDT)');
            issues.push(`Total Debited check unavailable; missing ${missing.join(', ')}.`);
        } else {
            const chargeTotal = chargeValues.reduce((sum, value) => sum + Number(value), 0);
            const difference = Number(total) - chargeTotal;
            if (Math.abs(difference) > 0.01) {
                issues.push(`Total Debited: expected BDT ${formatCurrency(chargeTotal)}; document BDT ${formatCurrency(Number(total))}; mismatch ${difference >= 0 ? '+' : '-'}${formatCurrency(Math.abs(difference))} BDT.`);
            }
        }

        const fxValue = adviceType === 'LC Amendment'
            ? ['LC Value', values['LC Value (USD)'], values['LC Value (BDT)']]
            : adviceType === 'IWLC Issuance'
                ? ['IWLC Value', values['IWLC Value (USD)'], values['IWLC Value (BDT)']]
                : null;
        const rate = Number(values['Conversion Rate']);
        if (fxValue && fxValue[1] !== null && fxValue[1] !== undefined && fxValue[2] !== null && fxValue[2] !== undefined && Number.isFinite(rate) && rate > 0) {
            const usd = Number(fxValue[1]);
            const bdt = Number(fxValue[2]);
            const expected = Math.round(usd * rate * 100) / 100;
            const difference = Math.round((bdt - expected) * 100) / 100;
            if (Math.abs(difference) > 0.01) {
                issues.push(`${fxValue[0]}: expected BDT ${formatCurrency(expected)}; document BDT ${formatCurrency(bdt)}; mismatch ${difference >= 0 ? '+' : '-'}${formatCurrency(Math.abs(difference))} BDT.`);
            }
        }
        return { status: issues.length ? 'needs_review' : 'verified', issues };
    }

    function renderRecordsTable() {
        if (!recordsTbody) return;
        const query = (recordSearch ? recordSearch.value : '').trim().toLowerCase();
        const filtered = adviceRecords.filter(record => {
            const values = Object.values(record.values || {}).map(value => String(value ?? ''));
            const searchable = [
                record.advice_type,
                record.advice_date,
                record.reference,
                record.unit_name,
                record.vendor_name,
                ...(record.data_check_details || []),
                ...values
            ].join(' ').toLowerCase();
            return !query || searchable.includes(query);
        });

        if (recordsSummaryCount) {
            recordsSummaryCount.textContent = `Showing ${filtered.length} of ${adviceRecords.length} advice records`;
        }
        if (filtered.length === 0) {
            const message = query ? 'No advice records match your search.' : 'No advice records available yet.';
            recordsTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">${message}</td></tr>`;
            return;
        }

        recordsTbody.innerHTML = filtered.map((record, index) => {
            const detailsId = `advice-details-${index}`;
            const recordKey = getRecordKey(record);
            const expanded = expandedRecordKeys.has(recordKey);
            const details = Object.entries(record.values || {}).map(([header, value]) =>
                `<div class="detail-item"><span class="detail-label">${escapeHtml(header)}</span><strong class="detail-value">${escapeHtml(formatCell(header, value))}</strong></div>`
            ).join('');
            const reviewDetails = record.data_check === 'needs_review'
                ? `<div class="review-callout"><strong>Review required</strong><ul>${(record.data_check_details || []).map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>`
                : '';
            return `<tr class="advice-row">
                <td><span class="advice-type">${escapeHtml(record.advice_type || '-')}</span></td>
                <td>${escapeHtml(formatCell('Advice Date', record.advice_date))}</td>
                <td class="font-mono">${escapeHtml(record.reference || '-')}</td>
                <td>${escapeHtml(record.unit_name || '-')}</td>
                <td>${escapeHtml(record.vendor_name || '-')}</td>
                <td>${renderDataCheck(record)}</td>
                <td>${renderIssueSummary(record)}</td>
                <td><button type="button" class="details-toggle ep-btn ep-btn--ghost ep-btn--sm" aria-expanded="${expanded}" aria-controls="${detailsId}" data-details-id="${detailsId}" data-record-key="${escapeHtml(recordKey)}">${expanded ? 'View less' : 'View more'} <span aria-hidden="true">${expanded ? '-' : '+'}</span></button></td>
            </tr>
            <tr class="details-row" id="${detailsId}"${expanded ? '' : ' hidden'}>
                <td colspan="8"><div class="record-details">${reviewDetails}<div class="details-grid">${details}</div></div></td>
            </tr>`;
        }).join('');
    }

    async function loadStats() {
        try {
            const response = await fetch('/api/stats');
            if (!response.ok) throw new Error(`Stats request failed (${response.status})`);
            const data = await response.json();
            const pipeline = data.pipeline || {};

            if (kpiTotalRecords) kpiTotalRecords.textContent = data.total_records ?? 0;
            if (kpiTotalReceived) kpiTotalReceived.textContent = data.total_received ?? '--';
            if (kpiVerified) kpiVerified.textContent = data.verified_records ?? '--';
            if (kpiNeedsReview) kpiNeedsReview.textContent = data.records_needing_review ?? '--';
            if (tabRecordsCount) tabRecordsCount.textContent = data.total_records ?? 0;
            if (statusLabel) {
                statusLabel.textContent = pipeline.status === 'error'
                    ? 'Pipeline Error'
                    : pipeline.status === 'running'
                        ? 'Auto-Sync On'
                        : 'Starting pipeline...';
            }
            if (statusIndicator) {
                statusIndicator.title = pipeline.last_error || 'Monitoring automatic input-folder synchronization';
                statusIndicator.classList.toggle('pipeline-error', pipeline.status === 'error');
            }
        } catch (error) {
            console.error('Unable to load pipeline status:', error);
            if (statusLabel) statusLabel.textContent = 'Dashboard connection error';
            if (statusIndicator) statusIndicator.classList.add('pipeline-error');
        }
    }

    async function loadRecords() {
        if (recordsRequestActive) return;
        recordsRequestActive = true;
        try {
            const response = await fetch('/api/records');
            if (!response.ok) throw new Error(`Records request failed (${response.status})`);
            const data = await response.json();
            if (Array.isArray(data.records)) {
                adviceRecords = data.records;
            } else {
                adviceRecords = Object.entries(data.records_by_sheet || {}).flatMap(([sheet, rows]) =>
                    rows.map(values => {
                        const check = validateAdviceValues(sheet, values);
                        return {
                            advice_type: sheet,
                            advice_date: values['Bank Deduction Date'],
                            reference: values['LC Number'] || values['IWLC Number'],
                            unit_name: values['Unit Name'],
                            vendor_name: values['Vendor Name'],
                            data_check: check.status,
                            data_check_details: check.issues,
                            values
                        };
                    })
                );
            }
            renderRecordsTable();
        } catch (error) {
            console.error('Unable to load workbook records:', error);
            if (recordsTbody) {
                recordsTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">Unable to load workbook records.</td></tr>';
            }
        } finally {
            recordsRequestActive = false;
        }
    }

    async function loadRegistry() {
        if (!registryTbody || registryRequestActive) return;
        registryRequestActive = true;
        try {
            const response = await fetch('/api/registry');
            if (!response.ok) throw new Error(`Audit request failed (${response.status})`);
            const entries = await response.json();
            const nextJson = JSON.stringify(entries);
            if (nextJson === registryJson) return;
            registryJson = nextJson;

            if (entries.length === 0) {
                registryTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No documents processed yet.</td></tr>';
                return;
            }

            const badges = {
                success: ['badge-success', 'Success'],
                duplicate: ['badge-warning', 'Duplicate'],
                non_advice: ['badge-neutral', 'Non-Advice'],
                failed: ['badge-danger', 'Failed']
            };
            registryTbody.innerHTML = entries.map(item => {
                const [badgeClass, label] = badges[item.status] || ['badge-neutral', item.status || 'Unknown'];
                const timestamp = item.timestamp ? item.timestamp.replace('T', ' ').slice(0, 19) : '-';
                const details = item.error || (item.data_check_details || []).join(' ') || item.fingerprint || '-';
                return `<tr>
                    <td><span class="badge ${badgeClass}">${escapeHtml(label)}</span></td>
                    <td>${renderDataCheck(item)}</td>
                    <td class="font-mono">${escapeHtml(item.filename || '-')}</td>
                    <td><span class="bank-pill pill-city">CITY</span></td>
                    <td>${escapeHtml(item.document_type || '-')}</td>
                    <td class="font-mono text-muted">${escapeHtml(item.hash || '-')}</td>
                    <td class="font-mono text-muted">${escapeHtml(timestamp)}</td>
                    <td class="text-muted" style="max-width:240px;word-break:break-word;">${escapeHtml(details)}</td>
                </tr>`;
            }).join('');
        } catch (error) {
            console.error('Unable to load audit log:', error);
            registryTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${escapeHtml(error.message)}</td></tr>`;
        } finally {
            registryRequestActive = false;
        }
    }

    function activateTab(target) {
        tabButtons.forEach(item => item.classList.toggle('active', item.getAttribute('data-tab') === target));
        tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === target));
        if (target === 'tab-registry') loadRegistry();
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => activateTab(button.getAttribute('data-tab')));
    });

    if (recordSearch) recordSearch.addEventListener('input', renderRecordsTable);
    if (recordsTbody) {
        recordsTbody.addEventListener('click', event => {
            const button = event.target.closest('.details-toggle');
            if (!button) return;
            const row = document.getElementById(button.dataset.detailsId);
            if (!row) return;
            const expanded = button.getAttribute('aria-expanded') === 'true';
            const recordKey = button.dataset.recordKey;
            if (expanded) {
                expandedRecordKeys.delete(recordKey);
            } else {
                expandedRecordKeys.add(recordKey);
            }
            button.setAttribute('aria-expanded', String(!expanded));
            button.innerHTML = expanded
                ? 'View more <span aria-hidden="true">+</span>'
                : 'View less <span aria-hidden="true">-</span>';
            row.hidden = expanded;
        });
    }

    async function refreshDashboard() {
        await Promise.all([loadStats(), loadRecords()]);
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'tab-registry') {
            await loadRegistry();
        }
    }

    refreshDashboard();
    setInterval(refreshDashboard, 3000);
});
