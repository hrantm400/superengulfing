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
    id: number;
    source: 'usdt' | 'course_payment';
    email: string | null;
    product: string;
    productType: string;
    amount: number | null;
    currency: string;
    status: string;
    reference: string | null;
    txHash: string | null;
    date: string | null;
}

interface Props {
    fetchWithAdminAuth: (url: string, opts?: RequestInit) => Promise<Response>;
}

function formatUsd(v: number | null | undefined): string {
    if (v == null) return '—';
    return `$${v.toFixed(2)}`;
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
}

function formatDateShort(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

function generateCsv(rows: UnifiedRow[]): string {
    const header = ['Date', 'Email', 'Product', 'Type', 'Amount', 'Currency', 'Status', 'Reference', 'Tx Hash'];
    const lines = rows.map(r => [
        r.date ? new Date(r.date).toISOString() : '',
        r.email || '',
        r.product,
        r.productType,
        r.amount != null ? r.amount.toFixed(2) : '',
        r.currency,
        r.status,
        r.reference || '',
        r.txHash || '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [header.join(','), ...lines].join('\n');
}

function generateXlsXml(rows: UnifiedRow[], summaryText: string): string {
    const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
 <Style ss:ID="header"><Font ss:Bold="1" ss:Size="11"/><Interior ss:Color="#1a1a2e" ss:Pattern="Solid"/><Font ss:Color="#39FF14" ss:Bold="1"/></Style>
 <Style ss:ID="summary"><Font ss:Bold="1" ss:Size="12"/></Style>
 <Style ss:ID="currency"><NumberFormat ss:Format="$#,##0.00"/></Style>
</Styles>
<Worksheet ss:Name="Finance Report">
<Table>
<Column ss:Width="140"/>
<Column ss:Width="200"/>
<Column ss:Width="180"/>
<Column ss:Width="120"/>
<Column ss:Width="100"/>
<Column ss:Width="70"/>
<Column ss:Width="90"/>
<Column ss:Width="180"/>
<Column ss:Width="200"/>
<Row><Cell ss:StyleID="summary"><Data ss:Type="String">${escXml(summaryText)}</Data></Cell></Row>
<Row></Row>
<Row>
 <Cell ss:StyleID="header"><Data ss:Type="String">Date</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Email</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Product</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Type</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Amount</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Currency</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Status</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Reference</Data></Cell>
 <Cell ss:StyleID="header"><Data ss:Type="String">Tx Hash</Data></Cell>
</Row>`;
    for (const r of rows) {
        xml += `<Row>
 <Cell><Data ss:Type="String">${escXml(r.date ? new Date(r.date).toISOString() : '')}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.email || '')}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.product)}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.productType)}</Data></Cell>
 <Cell ss:StyleID="currency"><Data ss:Type="Number">${r.amount != null ? r.amount.toFixed(2) : '0'}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.currency)}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.status)}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.reference || '')}</Data></Cell>
 <Cell><Data ss:Type="String">${escXml(r.txHash || '')}</Data></Cell>
</Row>`;
    }
    xml += `</Table></Worksheet></Workbook>`;
    return xml;
}

function generateDocHtml(rows: UnifiedRow[], summaryText: string): string {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Finance Report</title>
<style>
body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; }
h1 { color: #1a1a2e; font-size: 18pt; }
h2 { color: #333; font-size: 13pt; margin-top: 20pt; }
table { border-collapse: collapse; width: 100%; margin-top: 10pt; }
th { background: #1a1a2e; color: #39FF14; padding: 6pt 8pt; text-align: left; font-size: 10pt; border: 1px solid #333; }
td { padding: 5pt 8pt; border: 1px solid #ccc; font-size: 10pt; }
tr:nth-child(even) td { background: #f7f7f7; }
.summary { margin-bottom: 16pt; }
.amount { text-align: right; font-family: monospace; }
</style></head><body>
<h1>Finance Report</h1>
<p class="summary">${esc(summaryText)}</p>
<h2>All Transactions</h2>
<table>
<tr><th>Date</th><th>Email</th><th>Product</th><th>Type</th><th>Amount</th><th>Currency</th><th>Status</th><th>Reference</th><th>Tx Hash</th></tr>`;
    for (const r of rows) {
        html += `<tr>
<td>${esc(r.date ? formatDateShort(r.date) : '')}</td>
<td>${esc(r.email || '—')}</td>
<td>${esc(r.product)}</td>
<td>${esc(r.productType)}</td>
<td class="amount">${r.amount != null ? '$' + r.amount.toFixed(2) : '—'}</td>
<td>${esc(r.currency)}</td>
<td>${esc(r.status)}</td>
<td style="font-size:8pt">${esc(r.reference || '—')}</td>
<td style="font-size:8pt">${esc(r.txHash || '—')}</td>
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
    const [typeFilter, setTypeFilter] = useState<'all' | 'usdt' | 'course_payment'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [purging, setPurging] = useState(false);
    const [message, setMessage] = useState('');
    const [sortField, setSortField] = useState<'date' | 'amount' | 'email'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
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
                id: o.id,
                source: 'usdt',
                email: o.email,
                product: o.course_title || o.product_type,
                productType: o.product_type === 'liquidityscan_pro' ? 'LiquidityScan PRO' : o.product_type === 'course' ? 'Course' : o.product_type,
                amount: o.amount_usdt,
                currency: 'USDT',
                status: o.status,
                reference: o.order_id,
                txHash: o.tx_hash,
                date: o.created_at,
            });
        }
        for (const cp of coursePayments) {
            rows.push({
                id: cp.id,
                source: 'course_payment',
                email: cp.email,
                product: cp.course_title,
                productType: 'Course (NOWPayments)',
                amount: cp.amount_usd,
                currency: 'USD',
                status: cp.status,
                reference: cp.payment_id,
                txHash: null,
                date: cp.created_at,
            });
        }
        return rows;
    }, [orders, coursePayments]);

    const filtered = useMemo(() => {
        let rows = [...unified];
        if (typeFilter === 'usdt') rows = rows.filter(r => r.source === 'usdt');
        if (typeFilter === 'course_payment') rows = rows.filter(r => r.source === 'course_payment');
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(r =>
                (r.email || '').toLowerCase().includes(q) ||
                r.product.toLowerCase().includes(q) ||
                (r.reference || '').toLowerCase().includes(q) ||
                (r.txHash || '').toLowerCase().includes(q)
            );
        }
        if (dateFrom) {
            const from = new Date(dateFrom);
            rows = rows.filter(r => r.date && new Date(r.date) >= from);
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            rows = rows.filter(r => r.date && new Date(r.date) <= to);
        }
        rows.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'date') {
                cmp = (new Date(a.date || 0).getTime()) - (new Date(b.date || 0).getTime());
            } else if (sortField === 'amount') {
                cmp = (a.amount || 0) - (b.amount || 0);
            } else if (sortField === 'email') {
                cmp = (a.email || '').localeCompare(b.email || '');
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });
        return rows;
    }, [unified, typeFilter, search, dateFrom, dateTo, sortField, sortDir]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    useEffect(() => { setCurrentPage(1); }, [search, typeFilter, dateFrom, dateTo]);

    const handleDelete = async (row: UnifiedRow) => {
        if (!confirm(`Delete this ${row.source === 'usdt' ? 'USDT order' : 'course payment'} (${row.email || 'no email'}, ${formatUsd(row.amount)})?`)) return;
        try {
            const endpoint = row.source === 'usdt'
                ? `${getApiUrl()}/api/admin/finance/order/${row.id}`
                : `${getApiUrl()}/api/admin/finance/course-payment/${row.id}`;
            const res = await fetchWithAdminAuth(endpoint, { method: 'DELETE' });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setMessage(err.error || 'Failed to delete');
                return;
            }
            if (row.source === 'usdt') {
                setOrders(prev => prev.filter(o => o.id !== row.id));
            } else {
                setCoursePayments(prev => prev.filter(p => p.id !== row.id));
            }
            setMessage('Deleted successfully');
        } catch {
            setMessage('Failed to delete');
        }
    };

    const handlePurgeTest = async () => {
        if (!confirm('This will permanently delete ALL non-completed (pending/failed/test) USDT orders. Real completed payments will NOT be affected.\n\nContinue?')) return;
        setPurging(true);
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/admin/finance/purge-test`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setMessage(data.error || 'Failed to purge');
                return;
            }
            setMessage(`Purged ${data.purged_orders || 0} test/pending orders`);
            fetchData();
        } catch {
            setMessage('Failed to purge test data');
        } finally {
            setPurging(false);
        }
    };

    const summaryText = summary
        ? `Total Revenue: $${summary.totalRevenueUsdt.toFixed(2)} | This Month: $${summary.thisMonthRevenueUsdt.toFixed(2)} | This Week: $${summary.thisWeekRevenueUsdt.toFixed(2)} | Transactions: ${summary.totalTransactions}`
        : '';

    const handleExportCsv = () => {
        downloadBlob(generateCsv(filtered), `finance-report-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
    };
    const handleExportExcel = () => {
        downloadBlob(generateXlsXml(filtered, summaryText), `finance-report-${new Date().toISOString().slice(0, 10)}.xls`, 'application/vnd.ms-excel');
    };
    const handleExportDoc = () => {
        downloadBlob(generateDocHtml(filtered, summaryText), `finance-report-${new Date().toISOString().slice(0, 10)}.doc`, 'application/msword');
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sortIcon = (field: typeof sortField) => {
        if (sortField !== field) return 'unfold_more';
        return sortDir === 'asc' ? 'expand_less' : 'expand_more';
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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h1 className="text-3xl font-bold">Finance Analytics</h1>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleExportCsv} className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">download</span> CSV
                    </button>
                    <button onClick={handleExportExcel} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">table_view</span> Excel
                    </button>
                    <button onClick={handleExportDoc} className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium hover:bg-purple-500/30 flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">description</span> Word
                    </button>
                </div>
            </div>

            {message && (
                <div className="mb-4 p-3 rounded-lg bg-primary/10 text-primary text-sm flex items-center justify-between">
                    <span>{message}</span>
                    <button onClick={() => setMessage('')} className="text-muted hover:text-foreground ml-4">&times;</button>
                </div>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <p className="text-muted text-xs uppercase tracking-wider mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-emerald-400">${summary.totalRevenueUsdt.toFixed(2)}</p>
                        <p className="text-muted text-xs mt-1">All time (USDT)</p>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <p className="text-muted text-xs uppercase tracking-wider mb-1">This Month</p>
                        <p className="text-2xl font-bold text-blue-400">${summary.thisMonthRevenueUsdt.toFixed(2)}</p>
                        <p className="text-muted text-xs mt-1">Current month revenue</p>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <p className="text-muted text-xs uppercase tracking-wider mb-1">This Week</p>
                        <p className="text-2xl font-bold text-purple-400">${summary.thisWeekRevenueUsdt.toFixed(2)}</p>
                        <p className="text-muted text-xs mt-1">Last 7 days</p>
                    </div>
                    <div className="bg-surface rounded-xl border border-border p-5">
                        <p className="text-muted text-xs uppercase tracking-wider mb-1">Total Transactions</p>
                        <p className="text-2xl font-bold">{summary.totalTransactions}</p>
                        <p className="text-muted text-xs mt-1">Completed payments</p>
                    </div>
                </div>
            )}

            {/* Revenue by Product */}
            {summary && Object.keys(summary.byProduct).length > 0 && (
                <div className="bg-surface rounded-xl border border-border p-5 mb-6">
                    <h3 className="font-semibold text-sm mb-3 text-muted uppercase tracking-wider">Revenue by Product</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(summary.byProduct).map(([type, data]) => (
                            <div key={type} className="bg-background rounded-lg p-4 border border-border/50">
                                <p className="font-medium text-sm">
                                    {type === 'liquidityscan_pro' ? 'LiquidityScan PRO' : type === 'course' ? 'Courses (USDT)' : type}
                                </p>
                                <p className="text-lg font-bold text-primary mt-1">${data.total_usdt.toFixed(2)}</p>
                                <p className="text-muted text-xs">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters & Actions */}
            <div className="bg-surface rounded-xl border border-border p-4 mb-4">
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-muted text-xs mb-1">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Email, product, order ID, tx hash..."
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-muted text-xs mb-1">Type</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="all">All</option>
                            <option value="usdt">USDT Orders</option>
                            <option value="course_payment">Course Payments</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-muted text-xs mb-1">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-muted text-xs mb-1">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <button
                        onClick={handlePurgeTest}
                        disabled={purging}
                        className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50 flex items-center gap-1"
                    >
                        <span className="material-symbols-outlined text-base">delete_sweep</span>
                        {purging ? 'Purging...' : 'Purge test data'}
                    </button>
                </div>
                <p className="text-muted text-xs mt-2">
                    Showing {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} of {unified.length} total
                </p>
            </div>

            {/* Transactions Table */}
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
                {filtered.length === 0 ? (
                    <p className="p-6 text-muted text-center">No transactions found</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-muted text-xs border-b border-border">
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('date')}>
                                            <span className="flex items-center gap-1">Date <span className="material-symbols-outlined text-sm">{sortIcon('date')}</span></span>
                                        </th>
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('email')}>
                                            <span className="flex items-center gap-1">Email <span className="material-symbols-outlined text-sm">{sortIcon('email')}</span></span>
                                        </th>
                                        <th className="text-left p-3">Product</th>
                                        <th className="text-left p-3">Type</th>
                                        <th className="text-left p-3 cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('amount')}>
                                            <span className="flex items-center gap-1">Amount <span className="material-symbols-outlined text-sm">{sortIcon('amount')}</span></span>
                                        </th>
                                        <th className="text-left p-3">Status</th>
                                        <th className="text-left p-3">Reference</th>
                                        <th className="text-left p-3">Tx Hash</th>
                                        <th className="text-left p-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginated.map(row => (
                                        <tr key={`${row.source}-${row.id}`} className="hover:bg-surfaceElevated/30 transition-colors">
                                            <td className="p-3 text-muted text-xs whitespace-nowrap">{formatDate(row.date)}</td>
                                            <td className="p-3 max-w-[180px] truncate">{row.email || '—'}</td>
                                            <td className="p-3 max-w-[160px] truncate">{row.product}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                    row.source === 'usdt' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                    {row.productType}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono whitespace-nowrap">
                                                {row.amount != null ? `$${row.amount.toFixed(2)}` : '—'}
                                                <span className="text-muted text-xs ml-1">{row.currency}</span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded text-xs uppercase ${
                                                    row.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    row.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-gray-500/20 text-muted'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-xs max-w-[140px] truncate" title={row.reference || undefined}>
                                                {row.reference || '—'}
                                            </td>
                                            <td className="p-3 text-xs max-w-[100px]">
                                                {row.txHash ? (
                                                    <a
                                                        href={`https://tronscan.org/#/transaction/${row.txHash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:underline"
                                                        title={row.txHash}
                                                    >
                                                        View
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => handleDelete(row)}
                                                    className="text-red-400/60 hover:text-red-400 transition-colors"
                                                    title="Delete this transaction"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-3 border-t border-border text-sm">
                                <p className="text-muted text-xs">
                                    Page {currentPage} of {totalPages} ({filtered.length} results)
                                </p>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 rounded bg-background border border-border text-sm disabled:opacity-30 hover:bg-surfaceElevated"
                                    >
                                        Prev
                                    </button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let page: number;
                                        if (totalPages <= 5) {
                                            page = i + 1;
                                        } else if (currentPage <= 3) {
                                            page = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            page = totalPages - 4 + i;
                                        } else {
                                            page = currentPage - 2 + i;
                                        }
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`px-3 py-1 rounded text-sm ${currentPage === page ? 'bg-primary text-black font-bold' : 'bg-background border border-border hover:bg-surfaceElevated'}`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 rounded bg-background border border-border text-sm disabled:opacity-30 hover:bg-surfaceElevated"
                                    >
                                        Next
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
