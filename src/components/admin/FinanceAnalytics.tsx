import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../../lib/api';

interface FinanceSummary {
    byProduct: Record<string, { count: number; total_usdt: number }>;
    totalRevenueUsdt: number;
    totalTransactions: number;
    thisMonthRevenueUsdt: number;
    thisWeekRevenueUsdt: number;
}

interface FinanceOrder {
    id: number;
    order_id: string;
    product_type: string;
    product_id: number | null;
    user_id: number | null;
    email: string | null;
    amount_usdt: number | null;
    tx_hash: string | null;
    status: string;
    created_at: string | null;
    course_title: string | null;
}

interface FinanceCoursePayment {
    id: number;
    user_id: number | null;
    email: string | null;
    course_id: number | null;
    course_title: string;
    amount_usd: number | null;
    status: string;
    payment_id: string | null;
    created_at: string | null;
}

interface UnifiedRow {
    uid: string;
    source: 'usdt' | 'course_payment';
    sourceId: number;
    email: string;
    product: string;
    amount: number | null;
    currency: string;
    status: string;
    paymentRef: string;
    txHash: string;
    date: string | null;
}

interface Props {
    fetchWithAdminAuth: (url: string, opts?: RequestInit) => Promise<Response>;
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(val: number | null, currency: string): string {
    if (val == null) return '—';
    return currency === 'USDT' ? `$${val.toFixed(2)}` : `$${val.toFixed(2)}`;
}

function productLabel(type: string): string {
    switch (type) {
        case 'liquidityscan_pro': return 'LiquidityScan PRO';
        case 'course': return 'Course';
        default: return type || 'Unknown';
    }
}

function generateCSV(rows: UnifiedRow[]): string {
    const headers = ['Date', 'Email', 'Product', 'Amount', 'Currency', 'Status', 'Payment Ref', 'Tx Hash', 'Source'];
    const lines = [headers.join(',')];
    for (const r of rows) {
        lines.push([
            r.date ? new Date(r.date).toISOString() : '',
            `"${(r.email || '').replace(/"/g, '""')}"`,
            `"${r.product.replace(/"/g, '""')}"`,
            r.amount != null ? r.amount.toFixed(2) : '',
            r.currency,
            r.status,
            `"${(r.paymentRef || '').replace(/"/g, '""')}"`,
            r.txHash || '',
            r.source === 'usdt' ? 'USDT Order' : 'Course Payment',
        ].join(','));
    }
    return lines.join('\n');
}

function generateExcelXML(rows: UnifiedRow[], summaryData: FinanceSummary | null): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#1a1a2e" ss:Pattern="Solid"/><Font ss:Color="#FFFFFF" ss:Bold="1"/></Style>
 <Style ss:ID="money"><NumberFormat ss:Format="$#,##0.00"/></Style>
 <Style ss:ID="date"><NumberFormat ss:Format="yyyy-mm-dd hh:mm"/></Style>
 <Style ss:ID="summaryLabel"><Font ss:Bold="1" ss:Size="12"/></Style>
 <Style ss:ID="summaryValue"><Font ss:Bold="1" ss:Size="14" ss:Color="#39FF14"/><NumberFormat ss:Format="$#,##0.00"/></Style>
</Styles>`;

    // Summary sheet
    if (summaryData) {
        xml += `<Worksheet ss:Name="Summary">
<Table>
 <Column ss:Width="200"/><Column ss:Width="150"/>
 <Row><Cell ss:StyleID="summaryLabel"><Data ss:Type="String">Total Revenue (USDT)</Data></Cell><Cell ss:StyleID="summaryValue"><Data ss:Type="Number">${summaryData.totalRevenueUsdt}</Data></Cell></Row>
 <Row><Cell ss:StyleID="summaryLabel"><Data ss:Type="String">This Month</Data></Cell><Cell ss:StyleID="summaryValue"><Data ss:Type="Number">${summaryData.thisMonthRevenueUsdt}</Data></Cell></Row>
 <Row><Cell ss:StyleID="summaryLabel"><Data ss:Type="String">This Week</Data></Cell><Cell ss:StyleID="summaryValue"><Data ss:Type="Number">${summaryData.thisWeekRevenueUsdt}</Data></Cell></Row>
 <Row><Cell ss:StyleID="summaryLabel"><Data ss:Type="String">Total Transactions</Data></Cell><Cell><Data ss:Type="Number">${summaryData.totalTransactions}</Data></Cell></Row>
 <Row/>`;
        for (const [prod, data] of Object.entries(summaryData.byProduct)) {
            xml += `<Row><Cell ss:StyleID="summaryLabel"><Data ss:Type="String">${esc(productLabel(prod))}</Data></Cell><Cell ss:StyleID="summaryValue"><Data ss:Type="Number">${data.total_usdt}</Data></Cell><Cell><Data ss:Type="String">${data.count} txns</Data></Cell></Row>`;
        }
        xml += `</Table></Worksheet>`;
    }

    // Transactions sheet
    xml += `<Worksheet ss:Name="Transactions">
<Table>
 <Column ss:Width="140"/><Column ss:Width="220"/><Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="70"/><Column ss:Width="90"/><Column ss:Width="200"/><Column ss:Width="180"/><Column ss:Width="120"/>
 <Row ss:StyleID="header">
  <Cell><Data ss:Type="String">Date</Data></Cell>
  <Cell><Data ss:Type="String">Email</Data></Cell>
  <Cell><Data ss:Type="String">Product</Data></Cell>
  <Cell><Data ss:Type="String">Amount</Data></Cell>
  <Cell><Data ss:Type="String">Currency</Data></Cell>
  <Cell><Data ss:Type="String">Status</Data></Cell>
  <Cell><Data ss:Type="String">Payment Ref</Data></Cell>
  <Cell><Data ss:Type="String">Tx Hash</Data></Cell>
  <Cell><Data ss:Type="String">Source</Data></Cell>
 </Row>`;

    for (const r of rows) {
        xml += `<Row>
  <Cell ss:StyleID="date"><Data ss:Type="String">${r.date ? new Date(r.date).toISOString().slice(0, 16).replace('T', ' ') : ''}</Data></Cell>
  <Cell><Data ss:Type="String">${esc(r.email)}</Data></Cell>
  <Cell><Data ss:Type="String">${esc(r.product)}</Data></Cell>
  <Cell ss:StyleID="money"><Data ss:Type="Number">${r.amount != null ? r.amount : 0}</Data></Cell>
  <Cell><Data ss:Type="String">${r.currency}</Data></Cell>
  <Cell><Data ss:Type="String">${esc(r.status)}</Data></Cell>
  <Cell><Data ss:Type="String">${esc(r.paymentRef)}</Data></Cell>
  <Cell><Data ss:Type="String">${esc(r.txHash)}</Data></Cell>
  <Cell><Data ss:Type="String">${r.source === 'usdt' ? 'USDT Order' : 'Course Payment'}</Data></Cell>
 </Row>`;
    }

    xml += `</Table></Worksheet></Workbook>`;
    return xml;
}

function generateDocHTML(rows: UnifiedRow[], summaryData: FinanceSummary | null): string {
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><style>
body{font-family:Segoe UI,Arial,sans-serif;padding:30px;color:#222}
h1{font-size:22px;margin-bottom:4px}
h2{font-size:16px;margin-top:24px;margin-bottom:8px;color:#555}
.cards{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.card{background:#f4f4f8;border-radius:8px;padding:16px 24px;min-width:160px}
.card .val{font-size:22px;font-weight:bold;color:#1a7f37}
.card .lbl{font-size:12px;color:#666;margin-top:2px}
table{border-collapse:collapse;width:100%;font-size:12px;margin-top:12px}
th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
td{padding:6px 10px;border-bottom:1px solid #e0e0e0}
tr:nth-child(even){background:#fafafa}
.status-completed{color:#1a7f37;font-weight:600}
.status-pending{color:#c77c00}
</style></head><body>
<h1>Finance Report</h1>
<p style="color:#888;font-size:12px">Generated: ${new Date().toLocaleString()}</p>`;

    if (summaryData) {
        html += `<div class="cards">
<div class="card"><div class="val">$${summaryData.totalRevenueUsdt.toFixed(2)}</div><div class="lbl">Total Revenue</div></div>
<div class="card"><div class="val">$${summaryData.thisMonthRevenueUsdt.toFixed(2)}</div><div class="lbl">This Month</div></div>
<div class="card"><div class="val">$${summaryData.thisWeekRevenueUsdt.toFixed(2)}</div><div class="lbl">This Week</div></div>
<div class="card"><div class="val">${summaryData.totalTransactions}</div><div class="lbl">Transactions</div></div>
</div>`;
    }

    html += `<h2>All Transactions</h2><table>
<tr><th>Date</th><th>Email</th><th>Product</th><th>Amount</th><th>Status</th><th>Payment Ref</th><th>Tx Hash</th><th>Source</th></tr>`;

    for (const r of rows) {
        const statusClass = r.status === 'completed' ? 'status-completed' : r.status === 'pending' ? 'status-pending' : '';
        html += `<tr>
<td>${fmtDate(r.date)}</td>
<td>${r.email || '—'}</td>
<td>${r.product}</td>
<td>${fmtMoney(r.amount, r.currency)}</td>
<td class="${statusClass}">${r.status}</td>
<td style="font-size:10px;word-break:break-all">${r.paymentRef || '—'}</td>
<td style="font-size:10px;word-break:break-all">${r.txHash || '—'}</td>
<td>${r.source === 'usdt' ? 'USDT' : 'Course'}</td>
</tr>`;
    }

    html += `</table></body></html>`;
    return html;
}

function downloadBlob(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const FinanceAnalytics: React.FC<Props> = ({ fetchWithAdminAuth }) => {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [orders, setOrders] = useState<FinanceOrder[]>([]);
    const [coursePayments, setCoursePayments] = useState<FinanceCoursePayment[]>([]);

    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'usdt' | 'course_payment'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [sortField, setSortField] = useState<'date' | 'amount' | 'email'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(0);
    const [purging, setPurging] = useState(false);
    const [message, setMessage] = useState('');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const PAGE_SIZE = 50;

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/admin/finance-analytics`);
            const data = await res.json();
            setSummary(data.summary || null);
            setOrders(Array.isArray(data.orders) ? data.orders : []);
            setCoursePayments(Array.isArray(data.coursePayments) ? data.coursePayments : []);
        } catch {
            setSummary(null);
            setOrders([]);
            setCoursePayments([]);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const unified: UnifiedRow[] = useMemo(() => {
        const rows: UnifiedRow[] = [];
        for (const o of orders) {
            rows.push({
                uid: `usdt-${o.id}`,
                source: 'usdt',
                sourceId: o.id,
                email: o.email || '—',
                product: o.course_title ? `Course: ${o.course_title}` : productLabel(o.product_type),
                amount: o.amount_usdt,
                currency: 'USDT',
                status: o.status,
                paymentRef: o.order_id || '',
                txHash: o.tx_hash || '',
                date: o.created_at,
            });
        }
        for (const cp of coursePayments) {
            rows.push({
                uid: `cp-${cp.id}`,
                source: 'course_payment',
                sourceId: cp.id,
                email: cp.email || '—',
                product: cp.course_title || 'Course',
                amount: cp.amount_usd,
                currency: 'USD',
                status: cp.status,
                paymentRef: cp.payment_id || '',
                txHash: '',
                date: cp.created_at,
            });
        }
        return rows;
    }, [orders, coursePayments]);

    const filtered = useMemo(() => {
        let rows = unified;

        if (sourceFilter !== 'all') {
            rows = rows.filter(r => r.source === sourceFilter);
        }
        if (search.trim()) {
            const q = search.toLowerCase().trim();
            rows = rows.filter(r =>
                r.email.toLowerCase().includes(q) ||
                r.product.toLowerCase().includes(q) ||
                r.paymentRef.toLowerCase().includes(q) ||
                r.txHash.toLowerCase().includes(q)
            );
        }
        if (dateFrom) {
            const from = new Date(dateFrom).getTime();
            rows = rows.filter(r => r.date && new Date(r.date).getTime() >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo).getTime() + 86400000;
            rows = rows.filter(r => r.date && new Date(r.date).getTime() < to);
        }

        rows.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') {
                cmp = (new Date(a.date || 0).getTime()) - (new Date(b.date || 0).getTime());
            } else if (sortField === 'amount') {
                cmp = (a.amount || 0) - (b.amount || 0);
            } else {
                cmp = (a.email || '').localeCompare(b.email || '');
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return rows;
    }, [unified, sourceFilter, search, dateFrom, dateTo, sortField, sortDir]);

    const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const filteredTotal = useMemo(() => {
        return filtered.reduce((sum, r) => sum + (r.amount || 0), 0);
    }, [filtered]);

    const handleDelete = async (row: UnifiedRow) => {
        if (!confirm(`Delete this ${row.source === 'usdt' ? 'USDT order' : 'course payment'} from ${row.email}?\nAmount: ${fmtMoney(row.amount, row.currency)}`)) return;
        setDeletingId(row.uid);
        try {
            const endpoint = row.source === 'usdt'
                ? `${getApiUrl()}/api/admin/finance/order/${row.sourceId}`
                : `${getApiUrl()}/api/admin/finance/course-payment/${row.sourceId}`;
            const res = await fetchWithAdminAuth(endpoint, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setMessage(err.error || 'Failed to delete');
                return;
            }
            if (row.source === 'usdt') {
                setOrders(prev => prev.filter(o => o.id !== row.sourceId));
            } else {
                setCoursePayments(prev => prev.filter(cp => cp.id !== row.sourceId));
            }
            setMessage('Payment deleted');
        } catch {
            setMessage('Failed to delete');
        } finally {
            setDeletingId(null);
        }
    };

    const handlePurge = async () => {
        if (!confirm('This will permanently remove ALL non-completed (pending/abandoned) USDT orders.\n\nCompleted real payments will NOT be affected.\n\nContinue?')) return;
        setPurging(true);
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/admin/finance/purge-test`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data.error || 'Purge failed');
                return;
            }
            setMessage(`Purged ${data.purged_orders || 0} test orders`);
            await fetchData();
        } catch {
            setMessage('Purge failed');
        } finally {
            setPurging(false);
        }
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sortIcon = (field: typeof sortField) => {
        if (sortField !== field) return 'unfold_more';
        return sortDir === 'desc' ? 'expand_more' : 'expand_less';
    };

    const exportCSV = () => {
        downloadBlob(generateCSV(filtered), `finance_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
    };

    const exportExcel = () => {
        downloadBlob(generateExcelXML(filtered, summary), `finance_${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel');
    };

    const exportDoc = () => {
        downloadBlob(generateDocHTML(filtered, summary), `finance_report_${new Date().toISOString().slice(0, 10)}.doc`, 'application/msword');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h1 className="text-3xl font-bold">Finance Analytics</h1>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">download</span>CSV
                    </button>
                    <button onClick={exportExcel} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">table_view</span>Excel
                    </button>
                    <button onClick={exportDoc} className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">description</span>DOC
                    </button>
                    <button
                        onClick={handlePurge}
                        disabled={purging}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                        {purging ? 'Purging…' : 'Purge test orders'}
                    </button>
                </div>
            </div>

            {message && (
                <div className="mb-4 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm flex items-center justify-between">
                    <span>{message}</span>
                    <button onClick={() => setMessage('')} className="text-primary/60 hover:text-primary ml-3">
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
            )}

            {/* Summary cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-muted text-xs uppercase tracking-wider mb-1">Total Revenue</div>
                        <div className="text-2xl font-bold text-emerald-400">${summary.totalRevenueUsdt.toFixed(2)}</div>
                        <div className="text-muted text-xs mt-1">All time • USDT</div>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-muted text-xs uppercase tracking-wider mb-1">This Month</div>
                        <div className="text-2xl font-bold text-blue-400">${summary.thisMonthRevenueUsdt.toFixed(2)}</div>
                        <div className="text-muted text-xs mt-1">Current month</div>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-muted text-xs uppercase tracking-wider mb-1">This Week</div>
                        <div className="text-2xl font-bold text-purple-400">${summary.thisWeekRevenueUsdt.toFixed(2)}</div>
                        <div className="text-muted text-xs mt-1">Last 7 days</div>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <div className="text-muted text-xs uppercase tracking-wider mb-1">Transactions</div>
                        <div className="text-2xl font-bold">{summary.totalTransactions}</div>
                        <div className="text-muted text-xs mt-1">Completed</div>
                    </div>
                </div>
            )}

            {/* Revenue by product */}
            {summary && Object.keys(summary.byProduct).length > 0 && (
                <div className="bg-surface rounded-xl border border-border p-5 mb-6">
                    <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted">Revenue by Product</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(summary.byProduct).map(([type, data]) => (
                            <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-surfaceElevated/40 border border-border/50">
                                <div>
                                    <div className="font-medium text-sm">{productLabel(type)}</div>
                                    <div className="text-muted text-xs">{data.count} transactions</div>
                                </div>
                                <div className="text-emerald-400 font-bold">${data.total_usdt.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-surface rounded-xl border border-border p-4 mb-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-muted text-xs mb-1">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(0); }}
                            placeholder="Email, product, payment ref, tx hash..."
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="min-w-[140px]">
                        <label className="block text-muted text-xs mb-1">Source</label>
                        <select
                            value={sourceFilter}
                            onChange={e => { setSourceFilter(e.target.value as typeof sourceFilter); setPage(0); }}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="all">All Sources</option>
                            <option value="usdt">USDT Orders</option>
                            <option value="course_payment">Course Payments</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-muted text-xs mb-1">From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => { setDateFrom(e.target.value); setPage(0); }}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-muted text-xs mb-1">To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => { setDateTo(e.target.value); setPage(0); }}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    {(search || sourceFilter !== 'all' || dateFrom || dateTo) && (
                        <button
                            onClick={() => { setSearch(''); setSourceFilter('all'); setDateFrom(''); setDateTo(''); setPage(0); }}
                            className="px-3 py-2 rounded-lg text-sm text-muted hover:text-foreground hover:bg-surfaceElevated"
                        >
                            Clear
                        </button>
                    )}
                </div>
                {filtered.length > 0 && (
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                        <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''} found</span>
                        <span>Filtered total: <span className="text-emerald-400 font-medium">${filteredTotal.toFixed(2)}</span></span>
                    </div>
                )}
            </div>

            {/* Transaction table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                {filtered.length === 0 ? (
                    <p className="p-8 text-muted text-center">No transactions found</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-muted text-xs border-b border-border">
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('date')}>
                                            <span className="flex items-center gap-1">Date <span className="material-symbols-outlined text-sm">{sortIcon('date')}</span></span>
                                        </th>
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('email')}>
                                            <span className="flex items-center gap-1">Email <span className="material-symbols-outlined text-sm">{sortIcon('email')}</span></span>
                                        </th>
                                        <th className="text-left p-3">Product</th>
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => handleSort('amount')}>
                                            <span className="flex items-center gap-1">Amount <span className="material-symbols-outlined text-sm">{sortIcon('amount')}</span></span>
                                        </th>
                                        <th className="text-left p-3">Status</th>
                                        <th className="text-left p-3">Payment Ref</th>
                                        <th className="text-left p-3">Tx Hash</th>
                                        <th className="text-left p-3">Source</th>
                                        <th className="text-left p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paged.map(row => (
                                        <tr key={row.uid} className="hover:bg-surfaceElevated/30 transition-colors">
                                            <td className="p-3 text-muted text-xs whitespace-nowrap">{fmtDate(row.date)}</td>
                                            <td className="p-3 font-mono text-xs">{row.email}</td>
                                            <td className="p-3 text-xs">{row.product}</td>
                                            <td className="p-3 font-medium whitespace-nowrap">
                                                {fmtMoney(row.amount, row.currency)}
                                                {row.currency === 'USDT' && <span className="text-muted text-[10px] ml-1">USDT</span>}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${
                                                    row.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    row.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-gray-500/20 text-muted'
                                                }`}>{row.status}</span>
                                            </td>
                                            <td className="p-3 font-mono text-[10px] text-muted max-w-[140px] truncate" title={row.paymentRef}>{row.paymentRef || '—'}</td>
                                            <td className="p-3 max-w-[120px]">
                                                {row.txHash ? (
                                                    <a
                                                        href={`https://tronscan.org/#/transaction/${row.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline font-mono text-[10px] truncate block"
                                                        title={row.txHash}
                                                    >
                                                        {row.txHash.slice(0, 12)}…
                                                    </a>
                                                ) : <span className="text-muted text-xs">—</span>}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] ${
                                                    row.source === 'usdt' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                                                }`}>
                                                    {row.source === 'usdt' ? 'USDT' : 'Course'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    disabled={deletingId === row.uid}
                                                    className="text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-30"
                                                    title="Delete this payment"
                                                >
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                                <span className="text-muted text-xs">
                                    Page {page + 1} of {totalPages} ({filtered.length} rows)
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setPage(0)}
                                        disabled={page === 0}
                                        className="px-2 py-1 rounded text-xs text-muted hover:text-foreground hover:bg-surfaceElevated disabled:opacity-30"
                                    >
                                        First
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="px-2 py-1 rounded text-xs text-muted hover:text-foreground hover:bg-surfaceElevated disabled:opacity-30"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="px-2 py-1 rounded text-xs text-muted hover:text-foreground hover:bg-surfaceElevated disabled:opacity-30"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                    <button
                                        onClick={() => setPage(totalPages - 1)}
                                        disabled={page >= totalPages - 1}
                                        className="px-2 py-1 rounded text-xs text-muted hover:text-foreground hover:bg-surfaceElevated disabled:opacity-30"
                                    >
                                        Last
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
