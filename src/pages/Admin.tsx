import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from '@remix-run/react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminCourses } from '../components/admin/AdminCourses';
import { RichTextEditor } from '../components/admin/RichTextEditor';
import { getApiUrl } from '../lib/api';

interface Subscriber {
    id: number;
    email: string;
    first_name: string | null;
    source: string;
    status: string;
    created_at: string;
    tags: { id: number; name: string; color: string }[];
    custom_fields?: Record<string, unknown>;
}

interface Tag {
    id: number;
    name: string;
    color: string;
}

interface Template {
    id: number;
    name: string;
    subject: string;
    body: string;
}

interface Broadcast {
    id: number;
    name: string;
    subject: string;
    body: string;
    status: string;
    scheduled_at: string | null;
    sent_at: string | null;
    sent_count: number;
    failed_count: number;
    segment_type?: string;
    segment_tag_ids?: number[];
    subject_am?: string | null;
    body_am?: string | null;
    subject_en?: string | null;
    body_en?: string | null;
    segment_locale?: string | null;
}

interface EmailAttachment {
    filename: string;
    path: string;
}

interface Sequence {
    id: number;
    name: string;
    status: string;
    email_count: number;
    subscriber_count: number;
}

interface Stats {
    total: number;
    today: number;
    thisWeek: number;
    emailsSent: number;
    openRate?: number;
    clickRate?: number;
}

interface AnalyticsSummary {
    totalSent: number;
    totalOpened: number;
    totalClicked: number;
    openRate: number;
    clickRate: number;
}

interface AnalyticsData {
    summary: AnalyticsSummary;
    byType: { email_type: string; total: string; opened: string; clicked: string }[];
    recentActivity: { id: number; email: string; email_type: string; status: string; sent_at: string; opened_at?: string; clicked_at?: string }[];
}

interface SequenceEmail {
    id: number;
    sequence_id: number;
    position: number;
    subject: string;
    body: string;
    delay_days: number;
    delay_hours: number;
    subject_am?: string | null;
    body_am?: string | null;
    subject_en?: string | null;
    body_en?: string | null;
    conditions?: { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null;
    attachments?: EmailAttachment[] | null;
    stats?: { sent: number; opened: number; clicked: number };
}

interface AccessRequest {
    id: number;
    email: string;
    uid: string;
    status: string;
    locale?: string;
    created_at: string;
}

interface IndicatorAccessRequest {
    id: number;
    email: string;
    first_name: string;
    tradingview_username: string;
    indicator_access_status: string;
    indicator_requested_at: string | null;
}

const REJECT_REASON_TEMPLATES: { id: string; label: string; text: string }[] = [
    { id: 'verify', label: 'Could not verify (WEEX/account)', text: 'We could not verify your account / UID.' },
    { id: 'criteria', label: 'Does not meet criteria', text: 'Your application does not meet our current criteria.' },
    { id: 'duplicate', label: 'Duplicate or invalid request', text: 'Duplicate or invalid request.' },
    { id: 'other', label: 'Other (enter below)', text: '' },
];

/** Sequence subscribers list (loaded on demand) */
function SequenceSubscribersList({ sequenceId, fetchWithAdminAuth }: { sequenceId: number; fetchWithAdminAuth: (url: string, opts?: RequestInit) => Promise<Response> }) {
    const [subs, setSubs] = useState<{ id: number; email: string; first_name: string; current_step: number; seq_status: string; started_at: string }[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${sequenceId}/subscribers`);
            const data = await res.json();
            setSubs(Array.isArray(data) ? data : []);
            setLoaded(true);
        } catch { setSubs([]); setLoaded(true); }
        setLoading(false);
    };

    if (!loaded) return (
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
            {loading ? 'Loading...' : 'Load subscriber list'}
        </button>
    );

    if (subs.length === 0) return <p className="text-muted text-sm">No subscribers in this sequence yet.</p>;

    return (
        <div className="max-h-60 overflow-y-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-muted text-xs">
                        <th className="text-left py-1 pr-4">Email</th>
                        <th className="text-left py-1 pr-4">Name</th>
                        <th className="text-left py-1 pr-4">Step</th>
                        <th className="text-left py-1 pr-4">Status</th>
                        <th className="text-left py-1">Started</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {subs.map(sub => (
                        <tr key={sub.id + '-' + sub.current_step}>
                            <td className="py-1.5 pr-4 font-mono">{sub.email}</td>
                            <td className="py-1.5 pr-4 text-muted">{sub.first_name || '—'}</td>
                            <td className="py-1.5 pr-4">{sub.current_step}</td>
                            <td className="py-1.5 pr-4">
                                <span className={`px-2 py-0.5 rounded text-xs ${sub.seq_status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : sub.seq_status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-muted'}`}>{sub.seq_status}</span>
                            </td>
                            <td className="py-1.5 text-muted">{new Date(sub.started_at).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/** Simple step row for SSR / before client DnD loads (no @dnd-kit on server). */
function SimpleSequenceStep({
    em,
    onEdit,
    onDelete,
}: {
    em: SequenceEmail;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex justify-between items-start py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-muted" title="Drag to reorder (loads on client)">
                    <span className="material-symbols-outlined text-lg">drag_indicator</span>
                </span>
                <div className="min-w-0">
                    <span className="text-muted text-sm mr-2">#{em.position}</span>
                    <span className="font-medium">{em.subject}</span>
                    <p className="text-muted text-xs mt-1">Delay: {em.delay_days}d {em.delay_hours}h</p>
                    {em.stats && em.stats.sent > 0 && (
                        <p className="text-xs mt-1">
                            <span className="text-purple-400">Sent {em.stats.sent}</span>
                            <span className="text-emerald-400 ml-2">Opened {em.stats.opened}</span>
                            <span className="text-blue-400 ml-2">Clicked {em.stats.clicked}</span>
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={onEdit} className="px-3 py-1.5 bg-primary/20 text-primary rounded text-sm hover:bg-primary/30">Edit</button>
                <button onClick={onDelete} className="px-3 py-1.5 bg-rose-500/20 text-rose-400 rounded text-sm hover:bg-rose-500/30">Delete</button>
            </div>
        </div>
    );
}

/** Client-only: loads SequenceEmailsSortable so @dnd-kit is never imported on server. */
function SequenceEmailsListClient(props: {
    sequenceEmails: SequenceEmail[];
    setSequenceEmails: React.Dispatch<React.SetStateAction<SequenceEmail[]>>;
    selectedSequenceId: number | null;
    fetchWithAdminAuth: (url: string, opts: RequestInit) => Promise<Response>;
    setEditingSequenceEmailId: (id: number | null) => void;
    setSequenceEmailForm: (form: { subject: string; body: string; delay_days: number; delay_hours: number; subject_am: string; body_am: string; subject_en: string; body_en: string; conditions: { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null; attachments?: EmailAttachment[] }) => void;
    deleteSequenceEmail: (seqId: number, emailId: number) => Promise<void>;
    setMessage: (msg: string) => void;
}) {
    const [Sortable, setSortable] = useState<React.ComponentType<typeof props> | null>(null);
    useEffect(() => {
        import('../components/admin/SequenceEmailsSortable').then((m) => setSortable(() => m.SequenceEmailsSortable));
    }, []);
    if (Sortable) return <Sortable {...props} />;
    return (
        <div className="space-y-3">
            {props.sequenceEmails.map((em) => (
                <SimpleSequenceStep
                    key={em.id}
                    em={em}
                    onEdit={() => {
                        props.setEditingSequenceEmailId(em.id);
                        props.setSequenceEmailForm({ subject: em.subject, body: em.body, delay_days: em.delay_days, delay_hours: em.delay_hours, subject_am: em.subject_am || '', body_am: em.body_am || '', subject_en: em.subject_en || '', body_en: em.body_en || '', conditions: em.conditions || null, attachments: em.attachments || [] });
                    }}
                    onDelete={() => props.selectedSequenceId != null && props.deleteSequenceEmail(props.selectedSequenceId, em.id)}
                />
            ))}
        </div>
    );
}

const Admin: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { fetchWithAdminAuth } = useAdminAuth();
    const urlAudienceAm = location.pathname.startsWith('/am') || new URLSearchParams(location.search).get('audience') === 'am';
    const [activeTab, setActiveTab] = useState<'dashboard' | 'subscribers' | 'tags' | 'templates' | 'broadcasts' | 'sequences' | 'analytics' | 'accessRequests' | 'indicatorRequests' | 'settings' | 'courses'>('dashboard');
    const [adminAudienceLocale, setAdminAudienceLocale] = useState<'en' | 'am'>(() => (urlAudienceAm ? 'am' : 'en'));
    const [stats, setStats] = useState<Stats>({ total: 0, today: 0, thisWeek: 0, emailsSent: 0 });
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [sequences, setSequences] = useState<Sequence[]>([]);
    const [loading, setLoading] = useState(true);

    // Analytics
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

    // Access requests
    const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);

    // Indicator access requests
    const [indicatorRequests, setIndicatorRequests] = useState<IndicatorAccessRequest[]>([]);

    // Per-broadcast and per-sequence analytics (loaded on demand)
    const [broadcastAnalytics, setBroadcastAnalytics] = useState<Record<number, { sent: number; opened: number; clicked: number; openRate: string; clickRate: string }>>({});
    const [sequenceAnalytics, setSequenceAnalytics] = useState<Record<number, { sent: number; opened: number; clicked: number; openRate: string; clickRate: string }>>({});

    // Bulk actions (subscribers)
    const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<number[]>([]);
    const [bulkTagId, setBulkTagId] = useState<number | null>(null);
    const [bulkRemoveTagId, setBulkRemoveTagId] = useState<number | null>(null);
    const [bulkSequenceId, setBulkSequenceId] = useState<number | null>(null);

    // Edit subscriber (custom fields, first_name, status)
    const [editSubscriberId, setEditSubscriberId] = useState<number | null>(null);
    const [editSubscriberForm, setEditSubscriberForm] = useState({ first_name: '', status: 'active', custom_fields_json: '{}' });

    // Sequence triggers (when tag added -> add to sequence)
    const [sequenceTriggers, setSequenceTriggers] = useState<{ id: number; tag_id: number; sequence_id: number; tag_name: string; sequence_name: string }[]>([]);
    const [triggerForm, setTriggerForm] = useState({ tag_id: 0, sequence_id: 0 });

    // Schedule broadcast
    const [scheduleBroadcastId, setScheduleBroadcastId] = useState<number | null>(null);
    const [scheduleDatetime, setScheduleDatetime] = useState('');
    const [scheduleTimezone, setScheduleTimezone] = useState('UTC');

    // Sequence builder
    const [selectedSequenceId, setSelectedSequenceId] = useState<number | null>(null);
    const [sequenceEmails, setSequenceEmails] = useState<SequenceEmail[]>([]);
    const [sequenceEmailForm, setSequenceEmailForm] = useState({
        subject: '', body: '', delay_days: 0, delay_hours: 0,
        subject_am: '', body_am: '', subject_en: '', body_en: '',
        conditions: null as { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null,
        attachments: [] as EmailAttachment[]
    });
    const [editingSequenceEmailId, setEditingSequenceEmailId] = useState<number | null>(null);
    const [sequenceNameEdit, setSequenceNameEdit] = useState<string | null>(null);
    const [addSubscriberSequenceId, setAddSubscriberSequenceId] = useState<number | null>(null);

    // Form states
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#39FF14');
    const [broadcastForm, setBroadcastForm] = useState({
        name: '', subject: '', body: '',
        subject_am: '', body_am: '', subject_en: '', body_en: '',
        segment_type: 'all' as 'all' | 'tags', segment_tag_ids: [] as number[], segment_locale: '' as '' | 'am' | 'en',
        attachments: [] as EmailAttachment[]
    });
    const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '' });
    const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
    const [editingBroadcastId, setEditingBroadcastId] = useState<number | null>(null);
    const [editingTagId, setEditingTagId] = useState<number | null>(null);
    const [editTagName, setEditTagName] = useState('');
    const [editTagColor, setEditTagColor] = useState('#39FF14');
    const [subscriberSearch, setSubscriberSearch] = useState('');
    const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<'all' | 'active' | 'unsubscribed' | 'pending'>('all');
    const [subscriberTagFilter, setSubscriberTagFilter] = useState<number | null>(null);
    const [sequenceForm, setSequenceForm] = useState({ name: '' });
    const [message, setMessage] = useState('');
    const [affiliateLabel, setAffiliateLabel] = useState('');
    const [affiliateUrl, setAffiliateUrl] = useState('');
    const broadcastFileInputRef = useRef<HTMLInputElement>(null);
    const sequenceEmailFileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    // Reject modal (reason required for Access and Indicator reject)
    const [rejectModal, setRejectModal] = useState<{ type: 'access'; id: number } | { type: 'indicator'; userId: number } | null>(null);
    const [rejectReason, setRejectReason] = useState<string>('');
    const [rejectCustom, setRejectCustom] = useState('');
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);

    // Sync audience from URL when opening /am/admin2admin10 or /admin2admin10
    useEffect(() => {
        if (urlAudienceAm && adminAudienceLocale !== 'am') {
            setAdminAudienceLocale('am');
            fetchAll('am');
        } else if (!urlAudienceAm && adminAudienceLocale !== 'en') {
            setAdminAudienceLocale('en');
            fetchAll('en');
        }
    }, [urlAudienceAm]);

    useEffect(() => {
        if (activeTab === 'analytics') {
            fetchAnalytics();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'accessRequests') {
            fetchWithAdminAuth(`${getApiUrl()}/api/access-requests?locale=${adminAudienceLocale}`)
                .then(res => res.json())
                .then(data => setAccessRequests(Array.isArray(data) ? data : []))
                .catch(() => setAccessRequests([]));
        }
    }, [activeTab, adminAudienceLocale]);

    useEffect(() => {
        if (activeTab === 'indicatorRequests') {
            fetchWithAdminAuth(`${getApiUrl()}/api/indicator-access-requests`)
                .then(res => res.json())
                .then(data => setIndicatorRequests(Array.isArray(data) ? data : []))
                .catch(() => setIndicatorRequests([]));
        }
    }, [activeTab]);

    const fetchBroadcastAnalytics = (id: number) => {
        fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${id}/analytics`)
            .then(res => res.json())
            .then(data => setBroadcastAnalytics(prev => ({ ...prev, [id]: data })))
            .catch(() => {});
    };
    const fetchSequenceAnalytics = (id: number) => {
        fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${id}/analytics`)
            .then(res => res.json())
            .then(data => setSequenceAnalytics(prev => ({ ...prev, [id]: data })))
            .catch(() => {});
    };

    useEffect(() => {
        if (activeTab === 'settings') {
            fetch(`${getApiUrl()}/api/settings?locale=${adminAudienceLocale}`)
                .then(res => res.json())
                .then(data => {
                    setAffiliateLabel(data.affiliate_label || '');
                    setAffiliateUrl(data.affiliate_url || '');
                })
                .catch(() => {});
        }
    }, [activeTab, adminAudienceLocale]);

    useEffect(() => {
        if (selectedSequenceId) {
            fetchSequenceEmails(selectedSequenceId);
        } else {
            setSequenceEmails([]);
            setSequenceNameEdit(null);
            setEditingSequenceEmailId(null);
            setSequenceEmailForm(emptySequenceEmailForm());
        }
    }, [selectedSequenceId]);

    useEffect(() => {
        if (activeTab === 'sequences') {
            fetchWithAdminAuth(`${getApiUrl()}/api/sequence-triggers`)
                .then(res => res.json())
                .then(data => setSequenceTriggers(Array.isArray(data) ? data : []))
                .catch(() => setSequenceTriggers([]));
        }
    }, [activeTab]);

    const fetchAnalytics = async () => {
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/analytics`);
            const data = await res.json();
            if (res.ok && data && data.summary) {
                setAnalyticsData(data);
            } else {
                setAnalyticsData({
                    summary: { totalSent: 0, totalOpened: 0, totalClicked: 0, openRate: 0, clickRate: 0 },
                    byType: [],
                    recentActivity: []
                });
            }
        } catch (e) {
            console.error('Failed to fetch analytics:', e);
            setAnalyticsData({
                summary: { totalSent: 0, totalOpened: 0, totalClicked: 0, openRate: 0, clickRate: 0 },
                byType: [],
                recentActivity: []
            });
        }
    };

    const fetchSequenceEmails = async (seqId: number) => {
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${seqId}/emails`);
            const data = await res.json();
            setSequenceEmails(data);
        } catch (e) {
            console.error('Failed to fetch sequence emails:', e);
        }
    };

    const scheduleBroadcast = async () => {
        if (!scheduleBroadcastId || !scheduleDatetime) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${scheduleBroadcastId}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scheduled_at: scheduleDatetime,
                    timezone: scheduleTimezone || 'UTC'
                })
            });
            setScheduleBroadcastId(null);
            setScheduleDatetime('');
            setScheduleTimezone('UTC');
            setMessage('Broadcast scheduled!');
            fetchAll();
        } catch (e) {
            setMessage('Failed to schedule');
        }
    };

    const emptySequenceEmailForm = () => ({ subject: '', body: '', delay_days: 0, delay_hours: 0, subject_am: '', body_am: '', subject_en: '', body_en: '', conditions: null as { previous_email_opened?: boolean; has_tags?: string[]; not_has_tags?: string[] } | null, attachments: [] as EmailAttachment[] });

    const addSequenceEmail = async () => {
        if (!selectedSequenceId || !sequenceEmailForm.subject || !sequenceEmailForm.body) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${selectedSequenceId}/emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: sequenceEmailForm.subject,
                    body: sequenceEmailForm.body,
                    delay_days: sequenceEmailForm.delay_days || 0,
                    delay_hours: sequenceEmailForm.delay_hours || 0,
                    subject_am: sequenceEmailForm.subject_am || null,
                    body_am: sequenceEmailForm.body_am || null,
                    subject_en: sequenceEmailForm.subject_en || null,
                    body_en: sequenceEmailForm.body_en || null,
                    conditions: sequenceEmailForm.conditions || null,
                    attachments: sequenceEmailForm.attachments?.length ? sequenceEmailForm.attachments : undefined
                })
            });
            setSequenceEmailForm(emptySequenceEmailForm());
            fetchSequenceEmails(selectedSequenceId);
            fetchAll();
            setMessage('Email added to sequence');
        } catch (e) {
            setMessage('Failed to add email');
        }
    };

    const activateSequence = async (seqId: number) => {
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${seqId}/activate`, { method: 'POST' });
            setMessage('Sequence activated');
            fetchAll();
        } catch (e) {
            setMessage('Failed to activate');
        }
    };

    const pauseSequence = async (seqId: number) => {
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${seqId}/pause`, { method: 'POST' });
            setMessage('Sequence paused');
            fetchAll();
        } catch (e) {
            setMessage('Failed to pause');
        }
    };

    const updateSequenceName = async () => {
        if (!selectedSequenceId || sequenceNameEdit === null || !sequenceNameEdit.trim()) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${selectedSequenceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: sequenceNameEdit.trim() })
            });
            setSequenceNameEdit(null);
            setMessage('Sequence name updated');
            fetchAll();
        } catch (e) {
            setMessage('Failed to update name');
        }
    };

    const updateSequenceEmail = async () => {
        if (!selectedSequenceId || !editingSequenceEmailId) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${selectedSequenceId}/emails/${editingSequenceEmailId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: sequenceEmailForm.subject,
                    body: sequenceEmailForm.body,
                    delay_days: sequenceEmailForm.delay_days || 0,
                    delay_hours: sequenceEmailForm.delay_hours || 0,
                    subject_am: sequenceEmailForm.subject_am || null,
                    body_am: sequenceEmailForm.body_am || null,
                    subject_en: sequenceEmailForm.subject_en || null,
                    body_en: sequenceEmailForm.body_en || null,
                    conditions: sequenceEmailForm.conditions || null,
                    attachments: sequenceEmailForm.attachments?.length ? sequenceEmailForm.attachments : undefined
                })
            });
            setEditingSequenceEmailId(null);
            setSequenceEmailForm(emptySequenceEmailForm());
            setMessage('Step updated');
            fetchSequenceEmails(selectedSequenceId);
            fetchAll();
        } catch (e) {
            setMessage('Failed to update step');
        }
    };

    const deleteSequenceEmail = async (seqId: number, emailId: number) => {
        if (!confirm('Remove this step from the sequence?')) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${seqId}/emails/${emailId}`, { method: 'DELETE' });
            if (editingSequenceEmailId === emailId) {
                setEditingSequenceEmailId(null);
                setSequenceEmailForm(emptySequenceEmailForm());
            }
            setMessage('Step removed');
            fetchSequenceEmails(seqId);
            fetchAll();
        } catch (e) {
            setMessage('Failed to remove step');
        }
    };

    const addSubscriberToSequence = async (subscriberId: number, seqId: number) => {
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/${subscriberId}/sequences/${seqId}`, { method: 'POST' });
            setMessage('Subscriber added to sequence');
            setAddSubscriberSequenceId(null);
            fetchAll();
        } catch (e) {
            setMessage('Failed to add to sequence');
        }
    };

    const parseCsv = (text: string): { email: string; first_name?: string; source?: string }[] => {
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const header = lines[0].toLowerCase().split(',').map(h => h.trim());
        const emailIdx = header.findIndex(h => h === 'email' || h === 'e-mail');
        const firstNameIdx = header.findIndex(h => h === 'first_name' || h === 'first name' || h === 'firstname');
        const sourceIdx = header.findIndex(h => h === 'source');
        if (emailIdx === -1) return [];
        const rows: { email: string; first_name?: string; source?: string }[] = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const email = values[emailIdx] || '';
            if (!email || !email.includes('@')) continue;
            rows.push({
                email,
                first_name: firstNameIdx >= 0 && values[firstNameIdx] ? values[firstNameIdx] : undefined,
                source: sourceIdx >= 0 && values[sourceIdx] ? values[sourceIdx] : 'import'
            });
        }
        return rows;
    };

    const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const subscribersList = parseCsv(text);
        if (subscribersList.length === 0) {
            setMessage('No valid rows (need email column)');
            e.target.value = '';
            return;
        }
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscribers: subscribersList })
            });
            const data = await res.json();
            setMessage(`Imported: ${data.imported}, Skipped: ${data.skipped}`);
            e.target.value = '';
            fetchAll();
        } catch (err) {
            setMessage('Import failed');
            e.target.value = '';
        }
    };

    const fetchAll = async (localeOverride?: 'en' | 'am') => {
        const locale = localeOverride ?? adminAudienceLocale;
        setLoading(true);
        try {
            const [statsRes, subsRes, tagsRes, templatesRes, broadcastsRes, seqRes] = await Promise.all([
                fetchWithAdminAuth(`${getApiUrl()}/api/stats?locale=${locale}`),
                fetchWithAdminAuth(`${getApiUrl()}/api/subscribers?locale=${locale}`),
                fetchWithAdminAuth(`${getApiUrl()}/api/tags?locale=${locale}`),
                fetchWithAdminAuth(`${getApiUrl()}/api/templates?locale=${locale}`),
                fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts?locale=${locale}`),
                fetchWithAdminAuth(`${getApiUrl()}/api/sequences?locale=${locale}`)
            ]);

            setStats(await statsRes.json());
            const subsData = await subsRes.json();
            setSubscribers(subsData.subscribers || []);
            setTags(await tagsRes.json());
            setTemplates(await templatesRes.json());
            setBroadcasts(await broadcastsRes.json());
            setSequences(await seqRes.json());
        } catch (e) {
            console.error('Failed to fetch:', e);
        } finally {
            setLoading(false);
        }
    };

    const createTag = async () => {
        if (!newTagName) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newTagName, color: newTagColor, locale: adminAudienceLocale })
        });
        setNewTagName('');
        fetchAll();
    };

    const deleteTag = async (id: number) => {
        if (!confirm('Delete this tag?')) return;
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/tags/${id}?locale=${adminAudienceLocale}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessage(data.error || `Failed to delete tag (${res.status})`);
                return;
            }
            fetchAll();
            setMessage('Tag deleted');
        } catch (e) {
            setMessage('Failed to delete tag');
        }
    };

    const startEditTag = (tag: Tag) => {
        setEditingTagId(tag.id);
        setEditTagName(tag.name);
        setEditTagColor(tag.color);
    };

    const updateTag = async () => {
        if (!editingTagId || !editTagName.trim()) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/tags/${editingTagId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editTagName.trim(), color: editTagColor })
            });
            setEditingTagId(null);
            setEditTagName('');
            setEditTagColor('#39FF14');
            setMessage('Tag updated');
            fetchAll();
        } catch (e) {
            setMessage('Failed to update tag');
        }
    };

    const uploadFile = async (file: File, onSuccess: (att: EmailAttachment) => void) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.path && data.filename) {
                onSuccess({ filename: data.filename, path: data.path });
            } else {
                setMessage(data.error || 'Upload failed');
            }
        } catch {
            setMessage('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const createBroadcast = async () => {
        if (!broadcastForm.subject || !broadcastForm.body) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: broadcastForm.name,
                subject: broadcastForm.subject,
                body: broadcastForm.body,
                subject_am: broadcastForm.subject_am || null,
                body_am: broadcastForm.body_am || null,
                subject_en: broadcastForm.subject_en || null,
                body_en: broadcastForm.body_en || null,
                segment_type: broadcastForm.segment_type || 'all',
                segment_tag_ids: broadcastForm.segment_type === 'tags' ? broadcastForm.segment_tag_ids : [],
                segment_locale: broadcastForm.segment_locale || null,
                attachments: broadcastForm.attachments.length ? broadcastForm.attachments : undefined,
                locale: adminAudienceLocale
            })
        });
        setBroadcastForm({ name: '', subject: '', body: '', subject_am: '', body_am: '', subject_en: '', body_en: '', segment_type: 'all', segment_tag_ids: [], segment_locale: '', attachments: [] });
        setMessage('Broadcast created!');
        fetchAll();
    };

    const sendBroadcast = async (id: number) => {
        if (!confirm('Send this broadcast to all subscribers?')) return;
        setMessage('Sending...');
        const res = await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${id}/send`, { method: 'POST' });
        const data = await res.json();
        setMessage(`Sent to ${data.sentCount} subscribers`);
        fetchAll();
    };

    const deleteBroadcast = async (id: number) => {
        if (!confirm('Delete this broadcast? This cannot be undone.')) return;
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${id}?locale=${adminAudienceLocale}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessage(data.error || `Failed to delete broadcast (${res.status})`);
                return;
            }
            setMessage('Broadcast deleted');
            fetchAll();
        } catch (e) {
            setMessage('Failed to delete broadcast');
        }
    };

    const startEditBroadcast = (b: Broadcast) => {
        setEditingBroadcastId(b.id);
        setBroadcastForm({
            name: b.name || '',
            subject: b.subject || '',
            body: b.body || '',
            subject_am: b.subject_am || '',
            body_am: b.body_am || '',
            subject_en: b.subject_en || '',
            body_en: b.body_en || '',
            segment_type: (b.segment_type as 'all' | 'tags') || 'all',
            segment_tag_ids: b.segment_tag_ids || [],
            segment_locale: (b.segment_locale || '') as '' | 'am' | 'en',
            attachments: []
        });
    };

    const updateBroadcast = async () => {
        if (!editingBroadcastId) return;
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${editingBroadcastId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: broadcastForm.name,
                    subject: broadcastForm.subject,
                    body: broadcastForm.body,
                    subject_am: broadcastForm.subject_am || null,
                    body_am: broadcastForm.body_am || null,
                    subject_en: broadcastForm.subject_en || null,
                    body_en: broadcastForm.body_en || null,
                    segment_type: broadcastForm.segment_type || 'all',
                    segment_tag_ids: broadcastForm.segment_type === 'tags' ? broadcastForm.segment_tag_ids : [],
                    segment_locale: broadcastForm.segment_locale || null,
                    attachments: broadcastForm.attachments.length ? broadcastForm.attachments : undefined
                })
            });
            setEditingBroadcastId(null);
            setBroadcastForm({ name: '', subject: '', body: '', subject_am: '', body_am: '', subject_en: '', body_en: '', segment_type: 'all', segment_tag_ids: [], segment_locale: '', attachments: [] });
            setMessage('Broadcast updated!');
            fetchAll();
        } catch (e) {
            setMessage('Failed to update broadcast');
        }
    };

    const cancelEditBroadcast = () => {
        setEditingBroadcastId(null);
        setBroadcastForm({ name: '', subject: '', body: '', subject_am: '', body_am: '', subject_en: '', body_en: '', segment_type: 'all', segment_tag_ids: [], segment_locale: '', attachments: [] });
    };

    const createTemplate = async () => {
        if (!templateForm.name) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...templateForm, locale: adminAudienceLocale })
        });
        setTemplateForm({ name: '', subject: '', body: '' });
        fetchAll();
    };

    const updateTemplate = async () => {
        if (editingTemplateId == null || !templateForm.name) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/templates/${editingTemplateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateForm)
        });
        setEditingTemplateId(null);
        setTemplateForm({ name: '', subject: '', body: '' });
        fetchAll();
        setMessage('Template updated');
    };

    const deleteTemplate = async (id: number) => {
        if (!confirm('Delete this template?')) return;
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/templates/${id}?locale=${adminAudienceLocale}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessage(data.error || `Failed to delete template (${res.status})`);
                return;
            }
            if (editingTemplateId === id) setEditingTemplateId(null);
            setTemplateForm({ name: '', subject: '', body: '' });
            fetchAll();
            setMessage('Template deleted');
        } catch (e) {
            setMessage('Failed to delete template');
        }
    };

    const createSequence = async () => {
        if (!sequenceForm.name) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/sequences`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...sequenceForm, locale: adminAudienceLocale })
        });
        setSequenceForm({ name: '' });
        fetchAll();
    };

    const deleteSequence = async (id: number) => {
        if (!confirm('Delete this sequence? All steps and subscriber progress will be removed. This cannot be undone.')) return;
        try {
            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/sequences/${id}?locale=${adminAudienceLocale}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setMessage(data.error || `Failed to delete sequence (${res.status})`);
                return;
            }
            if (selectedSequenceId === id) setSelectedSequenceId(null);
            setMessage('Sequence deleted');
            fetchAll();
        } catch (e) {
            setMessage('Failed to delete sequence');
        }
    };

    const deleteSubscriber = async (id: number) => {
        if (!confirm('Delete this subscriber?')) return;
        await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/${id}`, { method: 'DELETE' });
        fetchAll();
    };

    const saveSubscriberEdit = async () => {
        if (!editSubscriberId) return;
        let custom_fields: Record<string, unknown> = {};
        try {
            custom_fields = JSON.parse(editSubscriberForm.custom_fields_json || '{}');
        } catch {
            setMessage('Invalid JSON in custom fields');
            return;
        }
        try {
            await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/${editSubscriberId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: editSubscriberForm.first_name, status: editSubscriberForm.status, custom_fields })
            });
            setEditSubscriberId(null);
            setMessage('Subscriber updated');
            fetchAll();
        } catch (e) {
            setMessage('Failed to update');
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleString();

    /** Convert ISO date string to datetime-local input value (local time) */
    const toDatetimeLocal = (iso: string): string => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const TabButton = ({ tab, icon, label }: { tab: typeof activeTab; icon: string; label: string }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all duration-300 ${activeTab === tab ? 'bg-primary text-black font-bold shadow-glow-primary-sm border-l-2 border-primary' : 'text-muted hover:text-foreground hover:bg-surfaceElevated hover:border-l-2 hover:border-primary/30 border-l-2 border-transparent'}`}
        >
            <span className="material-symbols-outlined text-xl">{icon}</span>
            {label}
        </button>
    );

    return (
        <div className="min-h-screen bg-background text-foreground flex pt-24 md:pt-28">
            {/* Sidebar */}
            <aside className="w-64 bg-surface border-r border-border p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-4 py-4 mb-4">
                    <span className="material-symbols-outlined text-primary text-3xl">mail</span>
                    <span className="font-bold text-xl">Email Marketing</span>
                </div>

                <TabButton tab="dashboard" icon="dashboard" label="Dashboard" />
                <TabButton tab="subscribers" icon="group" label="Subscribers" />
                <TabButton tab="tags" icon="label" label="Tags" />
                <TabButton tab="templates" icon="article" label="Templates" />
                <TabButton tab="broadcasts" icon="campaign" label="Broadcasts" />
                <TabButton tab="sequences" icon="sync" label="Sequences" />
                <TabButton tab="analytics" icon="analytics" label="Analytics" />
                <TabButton tab="accessRequests" icon="person_add" label="Access Requests" />
                <TabButton tab="indicatorRequests" icon="trending_up" label="Indicator requests" />
                <TabButton tab="courses" icon="school" label="Courses" />
                <TabButton tab="settings" icon="settings" label="Settings" />

            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
                {message && (
                    <div className="mb-4 p-4 bg-primary/10 text-primary rounded-lg flex justify-between items-center animate-fade-in border border-primary/20">
                        {message}
                        <button onClick={() => setMessage('')} className="hover:bg-primary/20 rounded p-1 transition-colors duration-200">×</button>
                    </div>
                )}

                {/* Audience switcher — always visible, filters Dashboard / Subscribers / Access Requests by locale */}
                <div className="mb-6 flex items-center gap-2">
                    <span className="text-muted text-sm font-medium">Audience:</span>
                    <div className="flex rounded-lg bg-surfaceElevated border border-border p-0.5">
                        <button
                            onClick={() => {
                                setAdminAudienceLocale('en');
                                navigate('/admin2admin10', { replace: true });
                                fetchAll('en');
                                if (activeTab === 'accessRequests') {
                                    fetchWithAdminAuth(`${getApiUrl()}/api/access-requests?locale=en`).then(r => r.json()).then(d => setAccessRequests(Array.isArray(d) ? d : [])).catch(() => setAccessRequests([]));
                                }
                            }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${adminAudienceLocale === 'en' ? 'bg-primary text-black' : 'text-muted hover:text-foreground'}`}
                        >
                            English
                        </button>
                        <button
                            onClick={() => {
                                setAdminAudienceLocale('am');
                                navigate('/am/admin2admin10', { replace: true });
                                fetchAll('am');
                                if (activeTab === 'accessRequests') {
                                    fetchWithAdminAuth(`${getApiUrl()}/api/access-requests?locale=am`).then(r => r.json()).then(d => setAccessRequests(Array.isArray(d) ? d : [])).catch(() => setAccessRequests([]));
                                }
                            }}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${adminAudienceLocale === 'am' ? 'bg-primary text-black' : 'text-muted hover:text-foreground'}`}
                        >
                            Armenian
                        </button>
                    </div>
                    <span className="text-xs text-muted ml-2">All content created for: <strong className="text-foreground">{adminAudienceLocale === 'am' ? 'Armenian' : 'English'}</strong></span>
                </div>

                {/* Dashboard */}
                {activeTab === 'dashboard' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">Total Subscribers</p>
                                <p className="text-3xl font-bold text-primary mt-2">{stats.total}</p>
                            </div>
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">Today</p>
                                <p className="text-3xl font-bold text-emerald-400 mt-2">+{stats.today}</p>
                            </div>
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">This Week</p>
                                <p className="text-3xl font-bold text-blue-400 mt-2">+{stats.thisWeek}</p>
                            </div>
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">Emails Sent</p>
                                <p className="text-3xl font-bold text-purple-400 mt-2">{stats.emailsSent}</p>
                            </div>
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">Open Rate</p>
                                <p className="text-3xl font-bold text-amber-400 mt-2">{stats.openRate ?? 0}%</p>
                            </div>
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <p className="text-muted text-sm">Click Rate</p>
                                <p className="text-3xl font-bold text-cyan-400 mt-2">{stats.clickRate ?? 0}%</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <h3 className="text-lg font-semibold mb-4">Recent Subscribers</h3>
                                <div className="space-y-3">
                                    {subscribers.slice(0, 5).map(s => (
                                        <div key={s.id} className="flex justify-between text-sm">
                                            <span>{s.email}</span>
                                            <span className="text-muted">{formatDate(s.created_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-surface rounded-card p-6 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                                <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between"><span>Tags:</span> <span>{tags.length}</span></div>
                                    <div className="flex justify-between"><span>Templates:</span> <span>{templates.length}</span></div>
                                    <div className="flex justify-between"><span>Broadcasts:</span> <span>{broadcasts.length}</span></div>
                                    <div className="flex justify-between"><span>Sequences:</span> <span>{sequences.length}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Subscribers */}
                {activeTab === 'subscribers' && (
                    <div>
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <h1 className="text-3xl font-bold">Subscribers ({subscribers.length})</h1>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    id="import-csv-input"
                                    onChange={handleImportCsv}
                                />
                                <label htmlFor="import-csv-input" className="px-4 py-2 bg-surfaceElevated hover:bg-surface/80 rounded-lg cursor-pointer">
                                    Import CSV
                                </label>
                                <button onClick={fetchAll} className="px-4 py-2 bg-surfaceElevated hover:bg-surface/80 rounded-lg">Refresh</button>
                                <a href={`${getApiUrl()}/api/export`} className="px-4 py-2 bg-primary/20 text-primary rounded-lg">Export CSV</a>
                            </div>
                        </div>

                        {selectedSubscriberIds.length > 0 && (
                            <div className="mb-4 p-4 bg-primary/10 rounded-xl border border-primary/20 flex flex-wrap items-center gap-4">
                                <span className="text-primary font-medium">{selectedSubscriberIds.length} selected</span>
                                <select value={bulkTagId ?? ''} onChange={(e) => setBulkTagId(e.target.value ? Number(e.target.value) : null)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                                    <option value="">Add tag...</option>
                                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {bulkTagId && (
                                    <button onClick={async () => {
                                        await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/bulk-tag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriber_ids: selectedSubscriberIds, tag_id: bulkTagId }) });
                                        setMessage('Tag added'); setSelectedSubscriberIds([]); setBulkTagId(null); fetchAll();
                                    }} className="px-3 py-1 bg-primary text-black text-sm font-bold rounded shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Apply</button>
                                )}
                                <select value={bulkRemoveTagId ?? ''} onChange={(e) => setBulkRemoveTagId(e.target.value ? Number(e.target.value) : null)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                                    <option value="">Remove tag...</option>
                                    {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                {bulkRemoveTagId && (
                                    <button onClick={async () => {
                                        await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/bulk-remove-tag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriber_ids: selectedSubscriberIds, tag_id: bulkRemoveTagId }) });
                                        setMessage('Tag removed'); setSelectedSubscriberIds([]); setBulkRemoveTagId(null); fetchAll();
                                    }} className="px-3 py-1 bg-amber-500/20 text-amber-400 text-sm rounded">Apply</button>
                                )}
                                <select value={bulkSequenceId ?? ''} onChange={(e) => setBulkSequenceId(e.target.value ? Number(e.target.value) : null)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm">
                                    <option value="">Add to sequence...</option>
                                    {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                {bulkSequenceId && (
                                    <button onClick={async () => {
                                        await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/bulk-sequence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriber_ids: selectedSubscriberIds, sequence_id: bulkSequenceId }) });
                                        setMessage('Added to sequence'); setSelectedSubscriberIds([]); setBulkSequenceId(null); fetchAll();
                                    }} className="px-3 py-1 bg-blue-500/20 text-blue-400 text-sm rounded">Apply</button>
                                )}
                                <button onClick={async () => {
                                    if (!confirm(`Unsubscribe ${selectedSubscriberIds.length} subscriber(s)?`)) return;
                                    await fetchWithAdminAuth(`${getApiUrl()}/api/subscribers/bulk-unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscriber_ids: selectedSubscriberIds }) });
                                    setMessage('Unsubscribed'); setSelectedSubscriberIds([]); fetchAll();
                                }} className="px-3 py-1 bg-red-500/20 text-red-400 text-sm rounded">Unsubscribe</button>
                                <button onClick={() => { setSelectedSubscriberIds([]); setBulkTagId(null); setBulkRemoveTagId(null); setBulkSequenceId(null); }} className="text-muted text-sm">Clear</button>
                            </div>
                        )}

                        {/* Search & filters */}
                        <div className="flex flex-wrap gap-3 mb-4">
                            <input
                                type="text"
                                value={subscriberSearch}
                                onChange={(e) => setSubscriberSearch(e.target.value)}
                                placeholder="Search by email or name..."
                                className="flex-1 min-w-[200px] bg-background border border-border rounded-lg px-4 py-2 text-sm"
                            />
                            <select
                                value={subscriberStatusFilter}
                                onChange={(e) => setSubscriberStatusFilter(e.target.value as typeof subscriberStatusFilter)}
                                className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="pending">Pending</option>
                                <option value="unsubscribed">Unsubscribed</option>
                            </select>
                            <select
                                value={subscriberTagFilter ?? ''}
                                onChange={(e) => setSubscriberTagFilter(e.target.value ? Number(e.target.value) : null)}
                                className="bg-background border border-border rounded-lg px-3 py-2 text-sm"
                            >
                                <option value="">All tags</option>
                                {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>

                        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-surfaceElevated">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs text-muted">
                                            <input type="checkbox" checked={subscribers.length > 0 && selectedSubscriberIds.length === subscribers.length} onChange={(e) => setSelectedSubscriberIds(e.target.checked ? subscribers.map(s => s.id) : [])} className="rounded" />
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">#</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Email</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Name</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Status</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Source</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Tags</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Date</th>
                                        <th className="px-6 py-3 text-left text-xs text-muted">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {subscribers
                                        .filter(sub => {
                                            const q = subscriberSearch.toLowerCase();
                                            if (q && !sub.email.toLowerCase().includes(q) && !(sub.first_name || '').toLowerCase().includes(q)) return false;
                                            if (subscriberStatusFilter !== 'all' && sub.status !== subscriberStatusFilter) return false;
                                            if (subscriberTagFilter && !sub.tags.some(t => t.id === subscriberTagFilter)) return false;
                                            return true;
                                        })
                                        .map((sub, idx) => (
                                        <tr key={sub.id} className="hover:bg-surfaceElevated">
                                            <td className="px-4 py-4">
                                                <input type="checkbox" checked={selectedSubscriberIds.includes(sub.id)} onChange={(e) => setSelectedSubscriberIds(e.target.checked ? [...selectedSubscriberIds, sub.id] : selectedSubscriberIds.filter(id => id !== sub.id))} className="rounded" />
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted">{idx + 1}</td>
                                            <td className="px-6 py-4 text-sm font-mono">{sub.email}</td>
                                            <td className="px-6 py-4 text-sm text-muted">{sub.first_name || '—'}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs ${sub.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : sub.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{sub.status}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs">{sub.source}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <div className="flex gap-1 flex-wrap">
                                                    {sub.tags?.map(t => (
                                                        <span key={t.id} className="px-2 py-0.5 rounded text-xs" style={{ background: t.color + '20', color: t.color }}>{t.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-muted">{formatDate(sub.created_at)}</td>
                                            <td className="px-6 py-4 text-sm">
                                                <button onClick={() => { setEditSubscriberId(sub.id); setEditSubscriberForm({ first_name: sub.first_name || '', status: sub.status, custom_fields_json: JSON.stringify(sub.custom_fields || {}, null, 2) }); }} className="text-primary hover:underline mr-2">Edit</button>
                                                <button onClick={() => deleteSubscriber(sub.id)} className="text-red-400 hover:text-red-300">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {subscribers.length === 0 && <p className="p-6 text-muted text-sm text-center">No subscribers for {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} audience yet.</p>}
                        </div>

                        {editSubscriberId && (
                            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                                <div className="bg-surface rounded-xl border border-border p-6 max-w-md w-full">
                                    <h3 className="font-semibold mb-4">Edit subscriber</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-muted text-sm mb-1">First name</label>
                                            <input value={editSubscriberForm.first_name} onChange={(e) => setEditSubscriberForm({ ...editSubscriberForm, first_name: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2" />
                                        </div>
                                        <div>
                                            <label className="block text-muted text-sm mb-1">Status</label>
                                            <select value={editSubscriberForm.status} onChange={(e) => setEditSubscriberForm({ ...editSubscriberForm, status: e.target.value })} className="w-full bg-background border border-border rounded-lg px-4 py-2">
                                                <option value="active">active</option>
                                                <option value="unsubscribed">unsubscribed</option>
                                                <option value="pending">pending</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-muted text-sm mb-1">Custom fields (JSON)</label>
                                            <textarea value={editSubscriberForm.custom_fields_json} onChange={(e) => setEditSubscriberForm({ ...editSubscriberForm, custom_fields_json: e.target.value })} rows={4} className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono text-sm" placeholder='{"company": "Acme", "phone": "123"}' />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={saveSubscriberEdit} className="px-4 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Save</button>
                                            <button onClick={() => setEditSubscriberId(null)} className="px-4 py-2 bg-white/10 rounded-lg">Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tags */}
                {activeTab === 'tags' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Tags</h1>

                        <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                            <h3 className="font-semibold mb-4">Create New Tag</h3>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={(e) => setNewTagName(e.target.value)}
                                    placeholder="Tag name"
                                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2"
                                />
                                <input
                                    type="color"
                                    value={newTagColor}
                                    onChange={(e) => setNewTagColor(e.target.value)}
                                    className="w-12 h-10 rounded cursor-pointer"
                                />
                                <button onClick={createTag} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Create</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {tags.map(tag => (
                                <div key={tag.id} className="bg-surface rounded-xl p-4 border border-border">
                                    {editingTagId === tag.id ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                <input type="text" value={editTagName} onChange={(e) => setEditTagName(e.target.value)} className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm" />
                                                <input type="color" value={editTagColor} onChange={(e) => setEditTagColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={updateTag} className="px-3 py-1 bg-primary text-black rounded text-sm font-semibold">Save</button>
                                                <button onClick={() => setEditingTagId(null)} className="px-3 py-1 bg-white/10 rounded text-sm">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full" style={{ background: tag.color }}></div>
                                                <span>{tag.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => startEditTag(tag)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                                                <button onClick={() => deleteTag(tag.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {tags.length === 0 && <p className="text-muted text-sm col-span-3">No tags for {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} audience. Create your first tag above.</p>}
                        </div>
                    </div>
                )}

                {/* Templates */}
                {activeTab === 'templates' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Email Templates</h1>

                        <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                            <h3 className="font-semibold mb-4">{editingTemplateId ? 'Edit Template' : 'Create New Template'}</h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={templateForm.name}
                                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                                    placeholder="Template name"
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                />
                                <input
                                    type="text"
                                    value={templateForm.subject}
                                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                                    placeholder="Email subject"
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                />
                                <textarea
                                    value={templateForm.body}
                                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                                    placeholder="Email body (HTML supported)"
                                    rows={6}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono text-sm"
                                />
                                {editingTemplateId ? (
                                    <div className="flex gap-3">
                                        <button onClick={updateTemplate} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Update Template</button>
                                        <button onClick={() => { setEditingTemplateId(null); setTemplateForm({ name: '', subject: '', body: '' }); }} className="px-6 py-2 bg-surfaceElevated border border-border rounded-lg text-foreground">Cancel</button>
                                    </div>
                                ) : (
                                    <button onClick={createTemplate} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Save Template</button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            {templates.map(t => (
                                <div key={t.id} className="bg-surface rounded-xl p-6 border border-border">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                        <div>
                                            <h4 className="font-semibold">{t.name}</h4>
                                            <span className="text-muted text-sm">Subject: {t.subject}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => { setEditingTemplateId(t.id); setTemplateForm({ name: t.name, subject: t.subject, body: t.body || '' }); }} className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-semibold hover:bg-primary/30 transition-colors">Edit</button>
                                            <button onClick={() => deleteTemplate(t.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-semibold hover:bg-rose-500/30 transition-colors">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {templates.length === 0 && <p className="text-muted text-sm">No templates for {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} audience. Create your first template above.</p>}
                        </div>
                    </div>
                )}

                {/* Broadcasts */}
                {activeTab === 'broadcasts' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Broadcasts</h1>

                        <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                            <h3 className="font-semibold mb-4">{editingBroadcastId ? 'Edit Broadcast' : 'Create New Broadcast'}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-muted text-sm mb-1">Pick template (optional)</label>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const tid = e.target.value ? Number(e.target.value) : 0;
                                            const t = templates.find(x => x.id === tid);
                                            if (t) setBroadcastForm({ ...broadcastForm, subject: t.subject, body: t.body || '' });
                                            e.target.value = '';
                                        }}
                                        className="bg-background border border-border rounded-lg px-4 py-2"
                                    >
                                        <option value="">-- Choose template --</option>
                                        {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    value={broadcastForm.name}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, name: e.target.value })}
                                    placeholder="Broadcast name (internal)"
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                />
                                <input
                                    type="text"
                                    value={broadcastForm.subject}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                                    placeholder="Email subject"
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                />
                                <RichTextEditor
                                    value={broadcastForm.body}
                                    onChange={(body) => setBroadcastForm({ ...broadcastForm, body })}
                                    placeholder="Email body (HTML). Use {{first_name}}, {{email}}, {{unsubscribe_url}}"
                                    minHeight="200px"
                                    className="w-full"
                                />
                                <div className="border-t border-border pt-4 mt-4">
                                    <label className="block text-muted text-sm font-semibold mb-2">Versions by language (optional)</label>
                                    <p className="text-muted text-xs mb-2">If set, AM subscribers get Armenian content, EN get English. Otherwise the subject/body above are used for all.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-primary font-medium">Armenian (AM)</span>
                                            <input type="text" value={broadcastForm.subject_am} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject_am: e.target.value })} placeholder="Subject (AM)" className="w-full mt-1 bg-background border border-border rounded-lg px-4 py-2 text-sm" />
                                            <textarea value={broadcastForm.body_am} onChange={(e) => setBroadcastForm({ ...broadcastForm, body_am: e.target.value })} placeholder="Body (AM)" rows={3} className="w-full mt-1 bg-background border border-border rounded-lg px-4 py-2 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <span className="text-xs text-primary font-medium">English (EN)</span>
                                            <input type="text" value={broadcastForm.subject_en} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject_en: e.target.value })} placeholder="Subject (EN)" className="w-full mt-1 bg-background border border-border rounded-lg px-4 py-2 text-sm" />
                                            <textarea value={broadcastForm.body_en} onChange={(e) => setBroadcastForm({ ...broadcastForm, body_en: e.target.value })} placeholder="Body (EN)" rows={3} className="w-full mt-1 bg-background border border-border rounded-lg px-4 py-2 font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-muted text-sm mb-2">Attachments</label>
                                    <input
                                        ref={broadcastFileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                uploadFile(file, (att) => setBroadcastForm(f => ({ ...f, attachments: [...f.attachments, att] })));
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => broadcastFileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm mb-2"
                                    >
                                        {uploading ? 'Uploading…' : 'Attach files'}
                                    </button>
                                    {broadcastForm.attachments.length > 0 && (
                                        <ul className="mt-2 space-y-1">
                                            {broadcastForm.attachments.map((a, i) => (
                                                <li key={i} className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted truncate">{a.filename}</span>
                                                    <button type="button" onClick={() => setBroadcastForm(f => ({ ...f, attachments: f.attachments.filter((_, j) => j !== i) }))} className="text-rose-400 hover:underline">Remove</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-muted text-sm mb-2">Send to</label>
                                    <div className="flex flex-wrap gap-4 items-center">
                                        <select
                                            value={broadcastForm.segment_type}
                                            onChange={(e) => setBroadcastForm({ ...broadcastForm, segment_type: e.target.value as 'all' | 'tags' })}
                                            className="bg-background border border-border rounded-lg px-4 py-2"
                                        >
                                            <option value="all">All active subscribers</option>
                                            <option value="tags">Subscribers with tag(s)</option>
                                        </select>
                                        <label className="flex items-center gap-2">
                                            <span className="text-muted text-sm">Locale filter:</span>
                                            <select
                                                value={broadcastForm.segment_locale}
                                                onChange={(e) => setBroadcastForm({ ...broadcastForm, segment_locale: e.target.value as '' | 'am' | 'en' })}
                                                className="bg-background border border-border rounded-lg px-4 py-2"
                                            >
                                                <option value="">All locales</option>
                                                <option value="am">Armenian only</option>
                                                <option value="en">English only</option>
                                            </select>
                                        </label>
                                    </div>
                                    {broadcastForm.segment_type === 'tags' && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {tags.map(t => (
                                                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={broadcastForm.segment_tag_ids.includes(t.id)}
                                                        onChange={(e) => {
                                                            const ids = e.target.checked
                                                                ? [...broadcastForm.segment_tag_ids, t.id]
                                                                : broadcastForm.segment_tag_ids.filter(id => id !== t.id);
                                                            setBroadcastForm({ ...broadcastForm, segment_tag_ids: ids });
                                                        }}
                                                        className="rounded"
                                                    />
                                                    <span className="text-sm" style={{ color: t.color }}>{t.name}</span>
                                                </label>
                                            ))}
                                            {tags.length === 0 && <span className="text-muted text-sm">No tags. Create tags in Tags tab.</span>}
                                        </div>
                                    )}
                                </div>
                                {editingBroadcastId ? (
                                    <div className="flex gap-3">
                                        <button onClick={updateBroadcast} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm">Update Broadcast</button>
                                        <button onClick={cancelEditBroadcast} className="px-6 py-2 bg-white/10 rounded-lg">Cancel</button>
                                    </div>
                                ) : (
                                    <button onClick={createBroadcast} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Create Broadcast</button>
                                )}
                            </div>
                        </div>

                        {scheduleBroadcastId && (
                            <div className="bg-surface rounded-xl p-6 border border-primary/30 mb-6">
                                <h3 className="font-semibold mb-2">When to send</h3>
                                <p className="text-muted text-sm mb-4">Schedule broadcast — choose date, time and timezone.</p>
                                <div className="flex flex-wrap items-center gap-4">
                                    <input
                                        type="datetime-local"
                                        value={scheduleDatetime}
                                        onChange={(e) => setScheduleDatetime(e.target.value)}
                                        className="bg-background border border-border rounded-lg px-4 py-2"
                                    />
                                    <div>
                                        <label className="block text-muted text-xs mb-1">Timezone</label>
                                        <select
                                            value={scheduleTimezone}
                                            onChange={(e) => setScheduleTimezone(e.target.value)}
                                            className="bg-background border border-border rounded-lg px-4 py-2"
                                        >
                                            <option value="UTC">UTC</option>
                                            <option value="Europe/London">Europe/London</option>
                                            <option value="Europe/Paris">Europe/Paris</option>
                                            <option value="Europe/Yerevan">Europe/Yerevan</option>
                                            <option value="America/New_York">America/New_York</option>
                                            <option value="America/Los_Angeles">America/Los_Angeles</option>
                                            <option value="Asia/Dubai">Asia/Dubai</option>
                                            <option value="Asia/Tokyo">Asia/Tokyo</option>
                                        </select>
                                    </div>
                                    <button onClick={scheduleBroadcast} className="px-4 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Schedule</button>
                                    <button onClick={() => { setScheduleBroadcastId(null); setScheduleDatetime(''); setScheduleTimezone('UTC'); }} className="px-4 py-2 bg-white/10 rounded-lg">Cancel</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {broadcasts.map(b => (
                                <div key={b.id} className="bg-surface rounded-xl p-6 border border-border">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold">{b.name || b.subject}</h4>
                                            <p className="text-muted text-sm mt-1">Subject: {b.subject}</p>
                                            {b.status === 'scheduled' && b.scheduled_at && (
                                                <p className="text-sm text-blue-400 mt-1">Scheduled: {formatDate(b.scheduled_at)}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`px-3 py-1 rounded text-xs ${b.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    b.status === 'scheduled' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-gray-500/20 text-muted'
                                                }`}>
                                                {b.status}
                                            </span>
                                            {b.status === 'scheduled' && b.scheduled_at && (
                                                <button onClick={() => { setScheduleBroadcastId(b.id); setScheduleDatetime(toDatetimeLocal(b.scheduled_at)); setScheduleTimezone(scheduleTimezone); }} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                                                    Change schedule
                                                </button>
                                            )}
                                            {b.status === 'draft' && (
                                                <>
                                                    <button onClick={() => startEditBroadcast(b)} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm hover:bg-blue-500/30">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => sendBroadcast(b.id)} className="px-4 py-2 bg-primary text-black font-bold rounded-lg text-sm shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                                                        Send Now
                                                    </button>
                                                    <button onClick={() => { const subjectB = prompt('Subject B (for A/B test):'); if (subjectB != null && subjectB.trim()) { fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${b.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ab_test: true, subject_b: subjectB.trim() }) }).then(r => r.json()).then(d => { setMessage(d.abTest || d.error || 'Sent'); fetchAll(); }); } }} className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm">
                                                        A/B test
                                                    </button>
                                                    <button onClick={() => { setScheduleBroadcastId(b.id); setScheduleDatetime(''); }} className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                                                        Schedule
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await fetchWithAdminAuth(`${getApiUrl()}/api/broadcasts/${b.id}/test-send`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({})
                                                                });
                                                                const data = await res.json().catch(() => ({}));
                                                                setMessage(res.ok ? (data.message || 'Test email sent') : (data.error || 'Failed'));
                                                            } catch (e) {
                                                                setMessage('Failed to send test');
                                                            }
                                                        }}
                                                        className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm"
                                                    >
                                                        Send test
                                                    </button>
                                                </>
                                            )}
                                            <button onClick={() => deleteBroadcast(b.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm hover:bg-rose-500/30">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                    {b.sent_count > 0 && (
                                        <p className="text-sm text-muted mt-2">Sent: {b.sent_count} | Failed: {b.failed_count}</p>
                                    )}
                                    {b.status === 'sent' && (
                                        <div className="mt-2">
                                            {broadcastAnalytics[b.id] ? (
                                                <p className="text-sm text-muted">
                                                    Opened: {broadcastAnalytics[b.id].opened} ({broadcastAnalytics[b.id].openRate}%) | Clicked: {broadcastAnalytics[b.id].clicked} ({broadcastAnalytics[b.id].clickRate}%)
                                                </p>
                                            ) : (
                                                <button type="button" onClick={() => fetchBroadcastAnalytics(b.id)} className="text-xs text-primary hover:underline">Load stats</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {broadcasts.length === 0 && <p className="text-muted text-sm">No broadcasts for {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} audience. Create your first broadcast above.</p>}
                        </div>
                    </div>
                )}

                {/* Sequences */}
                {activeTab === 'sequences' && (
                    <div>
                        <p className="text-muted text-sm mb-6">
                            1) Create sequence → 2) Add emails with delay → 3) Set triggers (tag → sequence) or add subscribers → 4) Activate.
                        </p>
                        {!selectedSequenceId && (
                            <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                                <h3 className="font-semibold mb-4">Triggers: when a subscriber gets a tag, add them to a sequence</h3>
                                <div className="flex flex-wrap gap-4 mb-4">
                                    <select value={triggerForm.tag_id || ''} onChange={(e) => setTriggerForm({ ...triggerForm, tag_id: Number(e.target.value) })} className="bg-background border border-border rounded-lg px-4 py-2">
                                        <option value="">Select tag</option>
                                        {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    <select value={triggerForm.sequence_id || ''} onChange={(e) => setTriggerForm({ ...triggerForm, sequence_id: Number(e.target.value) })} className="bg-background border border-border rounded-lg px-4 py-2">
                                        <option value="">Select sequence</option>
                                        {sequences.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <button onClick={async () => {
                                        if (!triggerForm.tag_id || !triggerForm.sequence_id) return;
                                        await fetchWithAdminAuth(`${getApiUrl()}/api/sequence-triggers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(triggerForm) });
                                        setMessage('Trigger added');
                                        setTriggerForm({ tag_id: 0, sequence_id: 0 });
                                        fetchWithAdminAuth(`${getApiUrl()}/api/sequence-triggers`).then(r => r.json()).then(d => setSequenceTriggers(Array.isArray(d) ? d : []));
                                    }} className="px-4 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Add trigger</button>
                                </div>
                                <div className="space-y-2">
                                    {sequenceTriggers.map(tr => (
                                        <div key={tr.id} className="flex items-center justify-between py-2 border-b border-border">
                                            <span>When tag <strong style={{ color: (tags.find(t => t.id === tr.tag_id)?.color) || '#fff' }}>{tr.tag_name}</strong> is added → add to sequence <strong>{tr.sequence_name}</strong></span>
                                            <button onClick={async () => { await fetchWithAdminAuth(`${getApiUrl()}/api/sequence-triggers/${tr.id}`, { method: 'DELETE' }); setSequenceTriggers(prev => prev.filter(x => x.id !== tr.id)); setMessage('Trigger removed'); }} className="text-red-400 hover:underline text-sm">Remove</button>
                                        </div>
                                    ))}
                                    {sequenceTriggers.length === 0 && <p className="text-muted text-sm">No triggers. Add one above.</p>}
                                </div>
                            </div>
                        )}
                        {selectedSequenceId ? (
                            <>
                                <div className="flex items-center gap-4 mb-6 flex-wrap">
                                    <button onClick={() => setSelectedSequenceId(null)} className="flex items-center gap-2 text-muted hover:text-foreground">
                                        <span className="material-symbols-outlined">arrow_back</span> Back to list
                                    </button>
                                    {sequenceAnalytics[selectedSequenceId] ? (
                                        <span className="text-sm text-muted">
                                            Sequence stats: Sent {sequenceAnalytics[selectedSequenceId].sent} | Opened {sequenceAnalytics[selectedSequenceId].opened} ({sequenceAnalytics[selectedSequenceId].openRate}%) | Clicked {sequenceAnalytics[selectedSequenceId].clicked} ({sequenceAnalytics[selectedSequenceId].clickRate}%)
                                        </span>
                                    ) : (
                                        <button type="button" onClick={() => fetchSequenceAnalytics(selectedSequenceId)} className="text-sm text-primary hover:underline">Load sequence stats</button>
                                    )}
                                </div>
                                {(() => {
                                    const seq = sequences.find(s => s.id === selectedSequenceId);
                                    return seq ? (
                                        <div>
                                            <div className="flex items-center gap-4 flex-wrap mb-2">
                                                {sequenceNameEdit === null ? (
                                                    <>
                                                        <h1 className="text-3xl font-bold">{seq.name}</h1>
                                                        <button onClick={() => setSequenceNameEdit(seq.name)} className="px-3 py-1.5 bg-surfaceElevated hover:bg-white/10 rounded-lg text-sm text-muted hover:text-foreground">Edit name</button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            value={sequenceNameEdit}
                                                            onChange={(e) => setSequenceNameEdit(e.target.value)}
                                                            className="bg-background border border-border rounded-lg px-4 py-2 text-xl font-bold flex-1 min-w-[200px]"
                                                        />
                                                        <button onClick={updateSequenceName} className="px-4 py-2 bg-primary text-black font-bold rounded-lg text-sm">Save</button>
                                                        <button onClick={() => setSequenceNameEdit(null)} className="px-4 py-2 bg-white/10 rounded-lg text-sm">Cancel</button>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-muted text-sm mb-6">
                                                {seq.email_count} emails • {seq.subscriber_count} subscribers • {seq.status}
                                            </p>

                                            <div className="flex items-center gap-3 mb-6 flex-wrap">
                                                {seq.status === 'draft' && (
                                                    <button onClick={() => activateSequence(selectedSequenceId)} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold">
                                                        Activate Sequence
                                                    </button>
                                                )}
                                                {seq.status === 'active' && (
                                                    <button onClick={() => pauseSequence(selectedSequenceId)} className="px-6 py-2 bg-amber-500/20 text-amber-400 rounded-lg font-semibold">
                                                        Pause
                                                    </button>
                                                )}
                                                {seq.status === 'paused' && (
                                                    <button onClick={() => activateSequence(selectedSequenceId)} className="px-6 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold">
                                                        Activate
                                                    </button>
                                                )}
                                                <button onClick={() => selectedSequenceId != null && deleteSequence(selectedSequenceId)} className="px-6 py-2 bg-rose-500/20 text-rose-400 rounded-lg font-semibold hover:bg-rose-500/30">
                                                    Delete sequence
                                                </button>
                                            </div>

                                            {seq.status === 'draft' && (
                                                <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                                                    <h3 className="font-semibold mb-4">{editingSequenceEmailId ? 'Edit Step' : 'Add Email to Sequence'}</h3>
                                                    <div className="space-y-4">
                                                        <input
                                                            type="text"
                                                            value={sequenceEmailForm.subject}
                                                            onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject: e.target.value })}
                                                            placeholder="Subject"
                                                            className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                                        />
                                                        <RichTextEditor
                                                            value={sequenceEmailForm.body}
                                                            onChange={(body) => setSequenceEmailForm({ ...sequenceEmailForm, body })}
                                                            placeholder="Body (HTML). Use {{first_name}}, {{unsubscribe_url}}"
                                                            minHeight="140px"
                                                            className="w-full"
                                                        />
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2">
                                                                <span className="text-muted text-sm">Delay days</span>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={sequenceEmailForm.delay_days}
                                                                    onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, delay_days: parseInt(e.target.value) || 0 })}
                                                                    className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm"
                                                                />
                                                            </label>
                                                            <label className="flex items-center gap-2">
                                                                <span className="text-muted text-sm">Delay hours</span>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={sequenceEmailForm.delay_hours}
                                                                    onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, delay_hours: parseInt(e.target.value) || 0 })}
                                                                    className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm"
                                                                />
                                                            </label>
                                                        </div>
                                                        <div className="border-t border-border pt-4">
                                                            <span className="text-muted text-xs font-semibold">Versions by language (optional)</span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                                                <div><input type="text" value={sequenceEmailForm.subject_am} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject_am: e.target.value })} placeholder="Subject (AM)" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm" /><textarea value={sequenceEmailForm.body_am} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, body_am: e.target.value })} placeholder="Body (AM)" rows={2} className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 font-mono text-xs" /></div>
                                                                <div><input type="text" value={sequenceEmailForm.subject_en} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject_en: e.target.value })} placeholder="Subject (EN)" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm" /><textarea value={sequenceEmailForm.body_en} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, body_en: e.target.value })} placeholder="Body (EN)" rows={2} className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 font-mono text-xs" /></div>
                                                            </div>
                                                        </div>
                                                        <div className="border-t border-border pt-4">
                                                            <span className="text-muted text-xs font-semibold">Conditions (optional)</span>
                                                            <label className="flex items-center gap-2 mt-2">
                                                                <input type="checkbox" checked={sequenceEmailForm.conditions?.previous_email_opened === true} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, previous_email_opened: e.target.checked } })} className="rounded" />
                                                                <span className="text-sm">Send only if previous email was opened</span>
                                                            </label>
                                                            <input type="text" value={(sequenceEmailForm.conditions?.has_tags || []).join(', ')} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, has_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} placeholder="Has tags (comma-separated)" className="w-full mt-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm" />
                                                            <input type="text" value={(sequenceEmailForm.conditions?.not_has_tags || []).join(', ')} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, not_has_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} placeholder="Not has tags (comma-separated)" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm" />
                                                        </div>
                                                        <div>
                                                            <span className="text-muted text-xs font-semibold">Attachments</span>
                                                            <input
                                                                ref={sequenceEmailFileInputRef}
                                                                type="file"
                                                                className="hidden"
                                                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                        uploadFile(file, (att) => setSequenceEmailForm(f => ({ ...f, attachments: [...(f.attachments || []), att] })));
                                                                        e.target.value = '';
                                                                    }
                                                                }}
                                                            />
                                                            <button type="button" onClick={() => sequenceEmailFileInputRef.current?.click()} disabled={uploading} className="mt-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
                                                                {uploading ? 'Uploading…' : 'Attach files'}
                                                            </button>
                                                            {sequenceEmailForm.attachments?.length > 0 && (
                                                                <ul className="mt-2 space-y-1">
                                                                    {sequenceEmailForm.attachments.map((a, i) => (
                                                                        <li key={i} className="flex items-center gap-2 text-sm">
                                                                            <span className="text-muted truncate">{a.filename}</span>
                                                                            <button type="button" onClick={() => setSequenceEmailForm(f => ({ ...f, attachments: (f.attachments || []).filter((_, j) => j !== i) }))} className="text-rose-400 hover:underline">Remove</button>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                        {editingSequenceEmailId ? (
                                                            <div className="flex gap-3">
                                                                <button onClick={updateSequenceEmail} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm">Update Step</button>
                                                                <button onClick={() => { setEditingSequenceEmailId(null); setSequenceEmailForm(emptySequenceEmailForm()); }} className="px-6 py-2 bg-white/10 rounded-lg">Cancel</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={addSequenceEmail} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Add Email</button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {editingSequenceEmailId != null && seq.status !== 'draft' && (
                                                <div className="bg-surface rounded-xl p-6 border border-primary/30 mb-6">
                                                    <h3 className="font-semibold mb-4">Edit Step</h3>
                                                    <div className="space-y-4">
                                                        <input type="text" value={sequenceEmailForm.subject} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject: e.target.value })} placeholder="Subject" className="w-full bg-background border border-border rounded-lg px-4 py-2" />
                                                        <textarea value={sequenceEmailForm.body} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, body: e.target.value })} placeholder="Body (HTML)" rows={4} className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono text-sm" />
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2"><span className="text-muted text-sm">Delay days</span><input type="number" min={0} value={sequenceEmailForm.delay_days} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, delay_days: parseInt(e.target.value) || 0 })} className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm" /></label>
                                                            <label className="flex items-center gap-2"><span className="text-muted text-sm">Delay hours</span><input type="number" min={0} value={sequenceEmailForm.delay_hours} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, delay_hours: parseInt(e.target.value) || 0 })} className="w-20 bg-background border border-border rounded-lg px-2 py-1 text-sm" /></label>
                                                        </div>
                                                        <div className="border-t border-border pt-4">
                                                            <span className="text-muted text-xs font-semibold">AM/EN (optional)</span>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                                                <div><input type="text" value={sequenceEmailForm.subject_am} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject_am: e.target.value })} placeholder="Subject (AM)" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm" /><textarea value={sequenceEmailForm.body_am} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, body_am: e.target.value })} placeholder="Body (AM)" rows={2} className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 font-mono text-xs" /></div>
                                                                <div><input type="text" value={sequenceEmailForm.subject_en} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, subject_en: e.target.value })} placeholder="Subject (EN)" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm" /><textarea value={sequenceEmailForm.body_en} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, body_en: e.target.value })} placeholder="Body (EN)" rows={2} className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 font-mono text-xs" /></div>
                                                            </div>
                                                        </div>
                                                        <div className="border-t border-border pt-4">
                                                            <span className="text-muted text-xs font-semibold">Conditions</span>
                                                            <label className="flex items-center gap-2 mt-2"><input type="checkbox" checked={sequenceEmailForm.conditions?.previous_email_opened === true} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, previous_email_opened: e.target.checked } })} className="rounded" /><span className="text-sm">Only if previous opened</span></label>
                                                            <input type="text" value={(sequenceEmailForm.conditions?.has_tags || []).join(', ')} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, has_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} placeholder="Has tags (comma-separated)" className="w-full mt-2 bg-background border border-border rounded-lg px-3 py-1.5 text-sm" />
                                                            <input type="text" value={(sequenceEmailForm.conditions?.not_has_tags || []).join(', ')} onChange={(e) => setSequenceEmailForm({ ...sequenceEmailForm, conditions: { ...sequenceEmailForm.conditions, not_has_tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} placeholder="Not has tags" className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm" />
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <button onClick={updateSequenceEmail} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm">Update Step</button>
                                                            <button onClick={() => { setEditingSequenceEmailId(null); setSequenceEmailForm(emptySequenceEmailForm()); }} className="px-6 py-2 bg-white/10 rounded-lg">Cancel</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                                                <h3 className="font-semibold mb-4">Sequence Emails</h3>
                                                <p className="text-muted text-xs mb-2">Drag steps to reorder.</p>
                                                {sequenceEmails.length === 0 ? (
                                                    <p className="text-muted text-sm">No emails yet. Add emails above (draft only).</p>
                                                ) : (
                                                    <SequenceEmailsListClient
                                                        sequenceEmails={sequenceEmails}
                                                        setSequenceEmails={setSequenceEmails}
                                                        selectedSequenceId={selectedSequenceId}
                                                        fetchWithAdminAuth={fetchWithAdminAuth}
                                                        setEditingSequenceEmailId={setEditingSequenceEmailId}
                                                        setSequenceEmailForm={setSequenceEmailForm}
                                                        deleteSequenceEmail={deleteSequenceEmail}
                                                        setMessage={setMessage}
                                                    />
                                                )}
                                            </div>

                                            <div className="bg-surface rounded-xl p-6 border border-border">
                                                <h3 className="font-semibold mb-4">Add Subscribers to Sequence</h3>
                                                {addSubscriberSequenceId === selectedSequenceId ? (
                                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                                        {subscribers.map(sub => (
                                                            <div key={sub.id} className="flex justify-between items-center py-2 border-b border-border">
                                                                <span className="font-mono text-sm">{sub.email}</span>
                                                                <button onClick={() => addSubscriberToSequence(sub.id, selectedSequenceId)} className="px-3 py-1 bg-primary/20 text-primary rounded text-sm">Add</button>
                                                            </div>
                                                        ))}
                                                        <button onClick={() => setAddSubscriberSequenceId(null)} className="text-muted hover:text-foreground text-sm mt-2">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setAddSubscriberSequenceId(selectedSequenceId)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm">
                                                        Choose subscribers to add
                                                    </button>
                                                )}
                                            </div>

                                            {/* Subscribers in this sequence */}
                                            <div className="bg-surface rounded-xl p-6 border border-border mt-6">
                                                <h3 className="font-semibold mb-4">Subscribers in this Sequence</h3>
                                                <SequenceSubscribersList sequenceId={selectedSequenceId} fetchWithAdminAuth={fetchWithAdminAuth} />
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted">Sequence not found.</p>
                                    );
                                })()}
                            </>
                        ) : (
                            <>
                                <h1 className="text-3xl font-bold mb-6">Email Sequences</h1>

                                <div className="bg-surface rounded-xl p-6 border border-border mb-6">
                                    <h3 className="font-semibold mb-4">Create New Sequence</h3>
                                    <div className="flex gap-4">
                                        <input
                                            type="text"
                                            value={sequenceForm.name}
                                            onChange={(e) => setSequenceForm({ name: e.target.value })}
                                            placeholder="Sequence name"
                                            className="flex-1 bg-background border border-border rounded-lg px-4 py-2"
                                        />
                                        <button onClick={createSequence} className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">Create</button>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {sequences.map(seq => (
                                        <div key={seq.id} className="bg-surface rounded-xl p-6 border border-border flex justify-between items-center">
                                            <div>
                                                <h4 className="font-semibold">{seq.name}</h4>
                                                <p className="text-muted text-sm mt-1">
                                                    {seq.email_count} emails • {seq.subscriber_count} subscribers
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`px-3 py-1 rounded text-xs ${seq.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : seq.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-muted'}`}>
                                                    {seq.status}
                                                </span>
                                                <button onClick={() => setSelectedSequenceId(seq.id)} className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm">
                                                    Manage
                                                </button>
                                                <button onClick={() => deleteSequence(seq.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm hover:bg-rose-500/30">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {sequences.length === 0 && <p className="text-muted text-sm">No sequences for {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} audience. Create your first sequence above.</p>}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Analytics */}
                {activeTab === 'analytics' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-8">Email Analytics</h1>
                        {analyticsData ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                                    <div className="bg-surface rounded-xl p-6 border border-border">
                                        <p className="text-muted text-sm">Emails Sent</p>
                                        <p className="text-4xl font-bold text-primary mt-2">{analyticsData.summary.totalSent}</p>
                                    </div>
                                    <div className="bg-surface rounded-xl p-6 border border-border">
                                        <p className="text-muted text-sm">Opened</p>
                                        <p className="text-4xl font-bold text-emerald-400 mt-2">{analyticsData.summary.totalOpened}</p>
                                    </div>
                                    <div className="bg-surface rounded-xl p-6 border border-border">
                                        <p className="text-muted text-sm">Clicked</p>
                                        <p className="text-4xl font-bold text-blue-400 mt-2">{analyticsData.summary.totalClicked}</p>
                                    </div>
                                    <div className="bg-surface rounded-xl p-6 border border-border">
                                        <p className="text-muted text-sm">Open Rate</p>
                                        <p className="text-4xl font-bold text-purple-400 mt-2">{analyticsData.summary.openRate}%</p>
                                    </div>
                                    <div className="bg-surface rounded-xl p-6 border border-border">
                                        <p className="text-muted text-sm">Click Rate</p>
                                        <p className="text-4xl font-bold text-amber-400 mt-2">{analyticsData.summary.clickRate}%</p>
                                    </div>
                                </div>
                                {analyticsData.byType && analyticsData.byType.length > 0 && (
                                    <div className="bg-surface rounded-xl p-6 border border-border mb-8">
                                        <h3 className="text-lg font-semibold mb-4">By Email Type</h3>
                                        <table className="w-full text-sm">
                                            <thead className="text-left text-muted">
                                                <tr>
                                                    <th className="pb-2">Type</th>
                                                    <th className="pb-2">Total</th>
                                                    <th className="pb-2">Opened</th>
                                                    <th className="pb-2">Clicked</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {analyticsData.byType.map((row, i) => (
                                                    <tr key={i} className="hover:bg-surfaceElevated transition-colors duration-200">
                                                        <td className="py-2">{row.email_type || '—'}</td>
                                                        <td className="py-2">{row.total}</td>
                                                        <td className="py-2">{row.opened}</td>
                                                        <td className="py-2">{row.clicked}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="bg-surface rounded-xl p-6 border border-border">
                                    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
                                    <div className="space-y-2">
                                        {analyticsData.recentActivity?.length ? analyticsData.recentActivity.map((a: { id: number; email: string; email_type: string; status: string; sent_at: string }) => (
                                            <div key={a.id} className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
                                                <span className="font-mono">{a.email}</span>
                                                <span className="text-muted">{a.email_type}</span>
                                                <span className={`px-2 py-0.5 rounded text-xs ${a.status === 'clicked' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{a.status}</span>
                                                <span className="text-muted">{formatDate(a.sent_at)}</span>
                                            </div>
                                        )) : (
                                            <p className="text-muted text-sm">No recent activity</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-muted">Loading analytics...</p>
                        )}
                    </div>
                )}

                {/* Access Requests */}
                {activeTab === 'accessRequests' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Access Requests</h1>
                        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-surfaceElevated">
                                    <tr>
                                        <th className="px-4 py-3 text-muted font-medium">Email</th>
                                        <th className="px-4 py-3 text-muted font-medium">UID</th>
                                        <th className="px-4 py-3 text-muted font-medium">Locale</th>
                                        <th className="px-4 py-3 text-muted font-medium">Status</th>
                                        <th className="px-4 py-3 text-muted font-medium">Created</th>
                                        <th className="px-4 py-3 text-muted font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accessRequests.map(req => (
                                        <tr key={req.id} className="border-t border-border hover:bg-surfaceElevated transition-colors duration-200">
                                            <td className="px-4 py-3">{req.email}</td>
                                            <td className="px-4 py-3 font-mono">{req.uid}</td>
                                            <td className="px-4 py-3 text-muted text-sm">{req.locale || 'en'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${req.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : req.status === 'accepted' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {req.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-muted text-sm">{formatDate(req.created_at)}</td>
                                            <td className="px-4 py-3">
                                                {req.status === 'pending' && (
                                                    <span className="flex gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await fetchWithAdminAuth(`${getApiUrl()}/api/access-requests/${req.id}/accept`, { method: 'POST' });
                                                                    setMessage('Request accepted. User will receive set-password email.');
                                                                    fetchWithAdminAuth(`${getApiUrl()}/api/access-requests?locale=${adminAudienceLocale}`).then(r => r.json()).then(d => setAccessRequests(Array.isArray(d) ? d : []));
                                                                } catch (e) {
                                                                    setMessage('Failed to accept');
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setRejectModal({ type: 'access', id: req.id });
                                                                setRejectReason('');
                                                                setRejectCustom('');
                                                            }}
                                                            className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                                        >
                                                            Reject
                                                        </button>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {accessRequests.length === 0 && (
                                <p className="p-6 text-muted text-center">No access requests</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Indicator requests */}
                {activeTab === 'indicatorRequests' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Indicator requests</h1>
                        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-surfaceElevated">
                                    <tr>
                                        <th className="px-4 py-3 text-muted font-medium">Email</th>
                                        <th className="px-4 py-3 text-muted font-medium">Name</th>
                                        <th className="px-4 py-3 text-muted font-medium">TradingView username</th>
                                        <th className="px-4 py-3 text-muted font-medium">Requested at</th>
                                        <th className="px-4 py-3 text-muted font-medium">Status</th>
                                        <th className="px-4 py-3 text-muted font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {indicatorRequests.map(req => (
                                        <tr key={req.id} className="border-t border-border hover:bg-surfaceElevated transition-colors duration-200">
                                            <td className="px-4 py-3">{req.email}</td>
                                            <td className="px-4 py-3">{req.first_name || '—'}</td>
                                            <td className="px-4 py-3 font-mono">{req.tradingview_username || '—'}</td>
                                            <td className="px-4 py-3 text-muted text-sm">{req.indicator_requested_at ? formatDate(req.indicator_requested_at) : '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs ${req.indicator_access_status === 'pending' ? 'bg-amber-500/20 text-amber-400' : req.indicator_access_status === 'approved' ? 'bg-green-500/20 text-green-400' : req.indicator_access_status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-muted/20 text-muted'}`}>
                                                    {req.indicator_access_status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {req.indicator_access_status === 'pending' && (
                                                    <span className="flex gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const res = await fetchWithAdminAuth(`${getApiUrl()}/api/indicator-access-requests/${req.id}/approve`, { method: 'POST' });
                                                                    if (!res.ok) {
                                                                        const err = await res.json().catch(() => ({}));
                                                                        setMessage(err.error || 'Failed to approve');
                                                                        return;
                                                                    }
                                                                    setMessage('Access approved. User will receive an email.');
                                                                    const listRes = await fetchWithAdminAuth(`${getApiUrl()}/api/indicator-access-requests`);
                                                                    const list = await listRes.json();
                                                                    setIndicatorRequests(Array.isArray(list) ? list : []);
                                                                } catch (e) {
                                                                    setMessage('Failed to approve');
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setRejectModal({ type: 'indicator', userId: req.id });
                                                                setRejectReason('');
                                                                setRejectCustom('');
                                                            }}
                                                            className="px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                                                        >
                                                            Reject
                                                        </button>
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {indicatorRequests.length === 0 && (
                                <p className="p-6 text-muted text-center">No indicator access requests</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'courses' && <AdminCourses setMessage={setMessage} adminAudienceLocale={adminAudienceLocale} />}

                {/* Settings */}
                {activeTab === 'settings' && (
                    <div>
                        <h1 className="text-3xl font-bold mb-6">Settings</h1>

                        <div className="space-y-6">
                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="font-semibold mb-4">Affiliate Link ({adminAudienceLocale === 'am' ? 'Armenian' : 'English'} Access page)</h3>
                                <p className="text-muted text-sm mb-4">This text and link appear at the top of the {adminAudienceLocale === 'am' ? 'Armenian' : 'English'} Access page and below the Register Now button. Switch EN/AM above to edit the other locale.</p>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-muted text-sm mb-2">Label (visible text)</label>
                                        <input
                                            type="text"
                                            value={affiliateLabel}
                                            onChange={(e) => setAffiliateLabel(e.target.value)}
                                            placeholder="e.g. Test Affiliate Link"
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-muted text-sm mb-2">URL (affiliate link)</label>
                                        <input
                                            type="text"
                                            value={affiliateUrl}
                                            onChange={(e) => setAffiliateUrl(e.target.value)}
                                            placeholder="hayktrading.am or https://..."
                                            className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetchWithAdminAuth(`${getApiUrl()}/api/settings`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ locale: adminAudienceLocale, affiliate_label: affiliateLabel, affiliate_url: affiliateUrl })
                                                });
                                                if (res.ok) {
                                                    const data = await res.json();
                                                    setMessage('Affiliate settings saved. Open or refresh the Access page to see the new text.');
                                                    setAffiliateLabel(data.affiliate_label ?? '');
                                                    setAffiliateUrl(data.affiliate_url ?? '');
                                                } else {
                                                    setMessage('Failed to save');
                                                }
                                            } catch (e) {
                                                setMessage('Failed to save');
                                            }
                                        }}
                                        className="px-6 py-2 bg-primary text-black font-bold rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                                    >
                                        Save Affiliate Link
                                    </button>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="font-semibold mb-4">SMTP Configuration</h3>
                                <p className="text-muted text-sm mb-4">Configure in <code className="text-primary">server/.env</code></p>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-muted">Server:</span> mail.privateemail.com</div>
                                    <div><span className="text-muted">Port:</span> 465</div>
                                    <div><span className="text-muted">From:</span> info@superengulfing.com</div>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="font-semibold mb-4">Database</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-muted">Type:</span> PostgreSQL</div>
                                    <div><span className="text-muted">Database:</span> superengulfing_email</div>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-6 border border-border">
                                <h3 className="font-semibold mb-4">Test Email</h3>
                                <button
                                    onClick={async () => {
                                        const res = await fetchWithAdminAuth(`${getApiUrl()}/api/test-email`);
                                        const data = await res.json();
                                        setMessage(data.success ? '✅ Test email sent!' : '❌ Failed');
                                    }}
                                    className="px-6 py-2 bg-primary/20 text-primary rounded-lg"
                                >
                                    Send Test Email
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Reject reason modal (Access + Indicator) */}
            {rejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !rejectSubmitting && setRejectModal(null)}>
                    <div className="bg-surface border border-border rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Reject request – reason</h2>
                        <p className="text-muted text-sm mb-4">Choose a reason or enter your own. The user will receive an email with this reason.</p>
                        <div className="space-y-2 mb-4">
                            {REJECT_REASON_TEMPLATES.map(t => (
                                <label key={t.id} className="flex items-start gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        checked={rejectReason === t.id}
                                        onChange={() => { setRejectReason(t.id); if (t.id !== 'other') setRejectCustom(''); }}
                                        className="mt-1"
                                    />
                                    <span className="text-sm">{t.label}</span>
                                </label>
                            ))}
                        </div>
                        {rejectReason === 'other' && (
                            <textarea
                                value={rejectCustom}
                                onChange={e => setRejectCustom(e.target.value)}
                                placeholder="Enter reason..."
                                className="w-full h-24 bg-background border border-border rounded-lg px-4 py-2 text-sm mb-4 resize-none"
                            />
                        )}
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setRejectModal(null)}
                                disabled={rejectSubmitting}
                                className="px-4 py-2 rounded-lg border border-border hover:bg-surfaceElevated disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={rejectSubmitting || !rejectReason || (rejectReason === 'other' && !rejectCustom.trim())}
                                onClick={async () => {
                                    const reason = rejectReason === 'other'
                                        ? rejectCustom.trim()
                                        : (REJECT_REASON_TEMPLATES.find(t => t.id === rejectReason)?.text ?? '');
                                    if (!reason) return;
                                    setRejectSubmitting(true);
                                    try {
                                        if (rejectModal.type === 'access') {
                                            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/access-requests/${rejectModal.id}/reject`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reason }),
                                            });
                                            if (!res.ok) {
                                                const err = await res.json().catch(() => ({}));
                                                setMessage(err.error || 'Failed to reject');
                                                return;
                                            }
                                            setMessage('Request rejected. User will receive an email with the reason.');
                                            const listRes = await fetchWithAdminAuth(`${getApiUrl()}/api/access-requests?locale=${adminAudienceLocale}`);
                                            const list = await listRes.json();
                                            setAccessRequests(Array.isArray(list) ? list : []);
                                        } else {
                                            const res = await fetchWithAdminAuth(`${getApiUrl()}/api/indicator-access-requests/${rejectModal.userId}/reject`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ reason }),
                                            });
                                            if (!res.ok) {
                                                const err = await res.json().catch(() => ({}));
                                                setMessage(err.error || 'Failed to reject');
                                                return;
                                            }
                                            setMessage('Request rejected. User will receive an email with the reason.');
                                            const listRes = await fetchWithAdminAuth(`${getApiUrl()}/api/indicator-access-requests`);
                                            const list = await listRes.json();
                                            setIndicatorRequests(Array.isArray(list) ? list : []);
                                        }
                                        setRejectModal(null);
                                        setRejectReason('');
                                        setRejectCustom('');
                                    } catch (e) {
                                        setMessage('Failed to reject');
                                    } finally {
                                        setRejectSubmitting(false);
                                    }
                                }}
                                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {rejectSubmitting ? 'Sending...' : 'Reject and send email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
