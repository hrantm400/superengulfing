import React, { useState, useEffect } from 'react';
import { TrendingUp, Loader2, CheckCircle, Clock, PlayCircle, Lightbulb, Gavel, Rocket, School } from 'lucide-react';
import { useNavigate } from '@remix-run/react';
import { useLocale } from '../../contexts/LocaleContext';
import { useTranslation } from '../../locales';
import { authFetch, getApiUrl } from '../../lib/api';

const TRADINGVIEW_INDICATOR_URL = 'https://www.tradingview.com/v/B2iqoM5q/';

function formatRequestedAt(iso?: string | null): string {
  if (!iso) return 'Just now';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Just now';
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' }) + ' ' + d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  } catch {
    return 'Just now';
  }
}

const INDICATOR_REJECT_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

interface IndicatorAccessCardProps {
  indicatorStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  tradingview_username?: string;
  indicator_requested_at?: string | null;
  indicator_rejected_reason?: string | null;
  indicator_rejected_at?: string | null;
  onIndicatorRequestSubmit?: () => void;
}

function formatCooldown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

const IndicatorAccessCard: React.FC<IndicatorAccessCardProps> = ({
  indicatorStatus = 'none',
  tradingview_username: propUsername = '',
  indicator_requested_at: indicatorRequestedAt,
  indicator_rejected_reason: rejectedReason,
  indicator_rejected_at: rejectedAt,
  onIndicatorRequestSubmit,
}) => {
  const [username, setUsername] = useState(propUsername);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cooldownLeftMs, setCooldownLeftMs] = useState<number | null>(null);

  const status: 'IDLE' | 'PENDING' | 'ACTIVE' | 'REJECTED' =
    indicatorStatus === 'approved' ? 'ACTIVE' : indicatorStatus === 'pending' ? 'PENDING' : indicatorStatus === 'rejected' ? 'REJECTED' : 'IDLE';
  const displayUsername = status === 'PENDING' || status === 'ACTIVE' ? (propUsername || username) : username;

  const rejectedTime = rejectedAt ? new Date(rejectedAt).getTime() : 0;
  const canResubmit = !rejectedAt || (Date.now() - rejectedTime >= INDICATOR_REJECT_COOLDOWN_MS);

  React.useEffect(() => {
    if (status !== 'REJECTED' || canResubmit) {
      setCooldownLeftMs(null);
      return;
    }
    const update = () => {
      const left = INDICATOR_REJECT_COOLDOWN_MS - (Date.now() - rejectedTime);
      if (left <= 0) {
        setCooldownLeftMs(0);
        onIndicatorRequestSubmit?.();
        return;
      }
      setCooldownLeftMs(left);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [status, canResubmit, rejectedTime, onIndicatorRequestSubmit]);

  const handleSubmit = async () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await authFetch('/api/me/indicator-access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingview_username: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || 'Request failed');
        return;
      }
      onIndicatorRequestSubmit?.();
    } catch {
      setSubmitError('Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-card p-0 flex flex-col sm:flex-row overflow-hidden group h-full w-full min-h-[380px] relative border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
      <div className="p-6 md:p-8 flex flex-col justify-between flex-1 min-w-0 relative z-10">

        {/* Header Section */}
        <div>
          <div className="flex justify-between items-start mb-4">
            {status === 'IDLE' && (
              <span className="text-xs font-bold text-muted uppercase tracking-widest">Action Required</span>
            )}
            {status === 'PENDING' && (
              <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-yellow-500 text-[10px] font-bold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div> Pending
              </div>
            )}
            {status === 'ACTIVE' && (
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-3 py-1 rounded-full text-primary text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle size={10} /> Active
              </div>
            )}
            {status === 'REJECTED' && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-red-400 text-[10px] font-bold uppercase tracking-wider">
                Не получилось
              </div>
            )}
            <TrendingUp className="text-muted group-hover:text-primary transition-colors" size={28} />
          </div>

          {/* Dynamic Content Based on Status */}
          {status === 'REJECTED' && (
            <>
              <h3 className="text-foreground text-xl md:text-2xl font-bold tracking-tight mb-2">
                Не получилось
              </h3>
              {rejectedReason && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 mb-4">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Reason</p>
                  <p className="text-sm text-foreground">{rejectedReason}</p>
                </div>
              )}
              {!canResubmit && (cooldownLeftMs === null || cooldownLeftMs > 0) && (
                <p className="text-muted text-sm mb-6">
                  You can submit again in {cooldownLeftMs !== null ? formatCooldown(cooldownLeftMs) : '…'}.
                </p>
              )}
              {canResubmit && (
                <>
                  <p className="text-muted text-sm mb-4">You can try submitting your TradingView username again.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase mb-1.5 block">TradingView Username</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); setSubmitError(null); }}
                        placeholder="@yourusername"
                        className="w-full h-11 bg-surfaceElevated border border-border rounded-btn px-4 text-foreground placeholder-muted text-base md:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                      />
                    </div>
                    {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                    <button
                      onClick={handleSubmit}
                      disabled={!username.trim() || loading}
                      className="w-full h-11 bg-primary hover:bg-primary-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-btn font-bold text-sm flex items-center justify-center gap-2 shadow-glow-primary-sm transition-all"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : 'SUBMIT USERNAME'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {status === 'IDLE' && (
            <>
              <h3 className="text-foreground text-xl md:text-2xl font-bold tracking-tight mb-2">
                Get Indicator Access
              </h3>
              <p className="text-muted text-sm mb-6">Enter your TradingView username below. I'll send you an invite within 24-48h.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase mb-1.5 block">TradingView Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setSubmitError(null); }}
                    placeholder="@yourusername"
                    className="w-full h-11 bg-surfaceElevated border border-border rounded-btn px-4 text-foreground placeholder-muted text-base md:text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300"
                  />
                  <p className="text-[10px] text-muted mt-1.5">Find this in your profile URL.</p>
                </div>
                {submitError && <p className="text-xs text-red-400">{submitError}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={!username.trim() || loading}
                  className="w-full h-11 bg-primary hover:bg-primary-glow active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-btn font-bold text-sm flex items-center justify-center gap-2 shadow-glow-primary-sm transition-all"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : 'SUBMIT USERNAME'}
                </button>
              </div>
            </>
          )}

          {status === 'PENDING' && (
            <>
              <h3 className="text-foreground text-xl md:text-2xl font-bold tracking-tight mb-2">
                Invite Pending
              </h3>
              <p className="text-muted text-sm mb-6">Your request has been submitted. You'll receive a TradingView notification within 24-48 hours.</p>

              <div className="bg-surfaceElevated border border-border rounded-lg p-4 mb-4 cursor-default select-none opacity-90 pointer-events-none">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted uppercase font-bold">Username</span>
                  <span className="text-sm font-mono text-foreground font-medium">{displayUsername}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted uppercase font-bold">Submitted</span>
                  <span className="text-xs text-muted">{formatRequestedAt(indicatorRequestedAt)}</span>
                </div>
                <p className="text-[10px] text-muted mt-2">Waiting for approval — not editable.</p>
              </div>

              <div className="flex items-start gap-3 text-xs text-muted">
                <Clock size={14} className="mt-0.5 shrink-0" />
                <p>Check your TradingView notifications for the invite. Wrong username? Contact support to update your request.</p>
              </div>
            </>
          )}

          {status === 'ACTIVE' && (
            <>
              <h3 className="text-foreground text-xl md:text-2xl font-bold tracking-tight mb-2">
                Already ready
              </h3>
              <p className="text-muted text-sm mb-4">Access granted. The indicator is in your TradingView account. No need to submit again.</p>

              <div className="bg-surfaceElevated/80 border border-border rounded-lg p-4 mb-4 cursor-default select-none opacity-90">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted uppercase font-bold">Username</span>
                  <span className="text-sm font-mono text-foreground font-medium">{displayUsername}</span>
                </div>
                <p className="text-[10px] text-muted mt-2">This field is not editable — access is active.</p>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3 mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-foreground">How to find it:</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted">
                  <li>Open TradingView</li>
                  <li>Go to <span className="text-foreground">Indicators</span></li>
                  <li>Click <span className="text-foreground">Invite-Only Scripts</span></li>
                  <li>Select <span className="text-emerald-400">SuperEngulfing: REV + RUN</span></li>
                </ol>
              </div>

              <a
                href={TRADINGVIEW_INDICATOR_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full h-11 bg-surfaceElevated border border-border hover:bg-surface/80 hover:border-primary/30 text-foreground rounded-btn font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                OPEN TRADINGVIEW
              </a>
            </>
          )}

        </div>
      </div>

      {/* Decorative BG — fixed width for symmetrical rectangle */}
      <div className="h-40 sm:h-full sm:w-[38%] sm:min-w-[220px] sm:max-w-[320px] bg-cover bg-center relative border-t sm:border-t-0 sm:border-l border-border shrink-0 overflow-hidden" style={{ backgroundImage: 'url("/photo_2026-02-05_13-54-25.webp")', backgroundSize: '92%' }} />
    </div>
  );
};

const DEFAULT_COURSE_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCP9ok5ezB8fwIle4TvIJefCxyF99WAhhdag59WU82Xj5wc8glg9PYgNxRmA-JD8P3yg23IZdTJDhwH6aP-P6x7cQYMZuZsmN2Ip2SNH7nvLkLH81HpV0G6lq5Y-xCJUp6a7lcnuHN_hz9uCIx48owtWAbzu4Oa7K5ilLPtk2EbSPDNDQUIg3GdToTumlOn-l-wqtmxYebe9WCNNq8u5dZTgQG8uqAn2JafemkmlCS8WukIFx-urPvXDLEc9MMOgaTjdLxWt-y2VYI';

const CoursesDashboardCard: React.FC = () => {
  const navigate = useNavigate();
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  const [title, setTitle] = useState('Mastery Mini Course');
  const [totalLessons, setTotalLessons] = useState(14);
  const [progressPercent, setProgressPercent] = useState(0);
  const [imageUrl, setImageUrl] = useState(DEFAULT_COURSE_IMAGE);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authFetch('/api/courses/my-courses');
        if (!res.ok) return;
        const data = await res.json();
        const courses = data.courses || [];
        if (courses.length > 0) {
          const first = courses[0];
          setTitle(first.title || 'Mastery Mini Course');
          setTotalLessons(first.total_lessons || 14);
          setProgressPercent(first.progress_percent ?? 0);
          if (first.image_url) setImageUrl(first.image_url);
        } else {
          const catalogRes = await fetch(`${getApiUrl()}/api/courses`);
          if (catalogRes.ok) {
            const catalog = await catalogRes.json();
            const list = catalog.courses || [];
            if (list.length > 0) {
              setTitle(list[0].title || 'Mastery Mini Course');
              if (list[0].image_url) setImageUrl(list[0].image_url);
            }
          }
        }
      } catch (_) {
        /* use defaults */
      }
    };
    load();
  }, []);

  const statusLabel = progressPercent >= 100 ? 'Completed' : progressPercent > 0 ? 'In Progress' : 'Not Started';
  const statusBadgeClass =
    progressPercent >= 100
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
      : progressPercent > 0
        ? 'bg-primary/20 text-primary border-primary/20'
        : 'bg-accent/40 text-teal-300 border-accent/60';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(localizePath('/dashboard/academy'))}
      onKeyDown={(e) => e.key === 'Enter' && navigate(localizePath('/dashboard/academy'))}
      className="glass-panel rounded-card p-0 flex flex-col sm:flex-row overflow-hidden group h-full w-full min-h-[380px] border border-primary/20 shadow-[0_0_20px_rgba(57,255,20,0.1)] relative cursor-pointer hover:border-primary/30 hover:shadow-[0_0_25px_rgba(57,255,20,0.15)] transition-all duration-300"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 rounded-l-card z-10" aria-hidden />
      <div className="p-6 md:p-8 flex flex-col justify-between flex-1 min-w-0 gap-6 relative z-10 pl-6">
        <div>
          <div className="flex justify-between items-start mb-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusBadgeClass}`}>
              {statusLabel}
            </span>
            <School className="w-8 h-8 text-muted group-hover:text-primary transition-colors shrink-0" />
          </div>
          <h3 className="text-foreground text-2xl font-bold tracking-tight mb-4 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <PlayCircle className="text-primary w-[18px] h-[18px] shrink-0" />
              <span>{totalLessons} Premium Lessons</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Lightbulb className="text-primary w-[18px] h-[18px] shrink-0" />
              <span>5 Core Strategies</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Gavel className="text-primary w-[18px] h-[18px] shrink-0" />
              <span>Execution Rules</span>
            </div>
          </div>
          <div className="relative w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(57,255,20,0.8)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-right text-xs text-gray-500 mt-2 font-mono">{progressPercent}% {t('course.complete')}</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); navigate(localizePath('/dashboard/academy')); }}
          className="bg-primary hover:bg-primary-glow text-[#020617] h-11 px-6 rounded-btn font-bold text-sm flex items-center justify-center gap-2 w-full sm:w-max transition-all shadow-[0_0_15px_rgba(57,255,20,0.4)] transform hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(57,255,20,0.6)]"
        >
          <Rocket className="w-5 h-5" />
          <span>{t('dashboard.startLearning')}</span>
        </button>
      </div>
      {/* Image panel — same width as Indicator card for symmetrical rectangles */}
      <div
        className="h-48 sm:h-full sm:w-[38%] sm:min-w-[220px] sm:max-w-[320px] bg-cover bg-center relative border-t sm:border-t-0 sm:border-l border-white/5 shrink-0"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    </div>
  );
};

interface StatCardsProps {
  profile?: {
    indicator_access_status?: 'none' | 'pending' | 'approved' | 'rejected';
    tradingview_username?: string;
    indicator_requested_at?: string | null;
    indicator_rejected_reason?: string | null;
    indicator_rejected_at?: string | null;
  } | null;
  loadProfile?: () => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ profile, loadProfile }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
      <div className="min-h-[380px] flex h-full w-full min-w-0">
        <IndicatorAccessCard
          indicatorStatus={profile?.indicator_access_status ?? 'none'}
          tradingview_username={profile?.tradingview_username}
          indicator_requested_at={profile?.indicator_requested_at}
          indicator_rejected_reason={profile?.indicator_rejected_reason}
          indicator_rejected_at={profile?.indicator_rejected_at}
          onIndicatorRequestSubmit={loadProfile}
        />
      </div>
      <div className="min-h-[380px] flex h-full w-full min-w-0">
        <CoursesDashboardCard />
      </div>
    </div>
  );
};
