import { useEffect, useRef } from 'react';
import { getApiUrl } from '../lib/api';

const COOKIE_NAME = 'se_vid';
const COOKIE_MAX_AGE_YEARS = 1;
const HEARTBEAT_INTERVAL_MS = 18000; // 18 seconds

function getOrCreateVisitorId(): string {
    if (typeof document === 'undefined') return '';
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    const existing = match ? decodeURIComponent(match[1]).trim() : '';
    if (existing && /^[a-z0-9-]{1,64}$/i.test(existing)) return existing;
    const newId =
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID().replace(/-/g, '').slice(0, 32)
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    const safe = newId.replace(/[^a-z0-9-]/gi, '').slice(0, 64) || 'v' + Date.now();
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(safe)}; path=/; max-age=${365 * 24 * 60 * 60 * COOKIE_MAX_AGE_YEARS}; SameSite=Lax`;
    return safe;
}

function sendVisitorHeartbeat(visitorId: string): void {
    const url = getApiUrl();
    if (!url) return;
    fetch(`${url}/api/metrics/visitor-heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId }),
        keepalive: true,
    }).catch(() => {});
}

/**
 * Sends a lightweight heartbeat to the API so the server can count online visitors (guests + logged-in).
 * Runs only on the client; does not block UI.
 */
export default function VisitorHeartbeat() {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const visitorId = getOrCreateVisitorId();
        if (!visitorId) return;

        const tick = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            sendVisitorHeartbeat(visitorId);
        };

        tick(); // first ping soon after load
        intervalRef.current = window.setInterval(tick, HEARTBEAT_INTERVAL_MS);

        const onVisibility = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            if (intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []);

    return null;
}
