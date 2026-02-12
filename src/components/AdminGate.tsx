import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import Admin from '../pages/Admin';

const REMEMBER_OPTIONS: { value: string; label: string }[] = [
  { value: '1h', label: '1 hour' },
  { value: '3h', label: '3 hours' },
  { value: '12h', label: '12 hours' },
  { value: '1d', label: '1 day' },
  { value: '2d', label: '2 days' },
  { value: '1w', label: '1 week' },
];

export default function AdminGate() {
  const { isValid, requestCode, verify } = useAdminAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [rememberDuration, setRememberDuration] = useState('1d');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /** After first admin verifies 2FA, show QR so second admin can scan too. */
  const [showQrForSecondAdmin, setShowQrForSecondAdmin] = useState(false);

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await requestCode(password);
      if (result.success) {
        setPendingEmail(password.trim().toLowerCase());
        setEmailMasked(result.emailMasked || '***');
        setSetupRequired(!!result.setupRequired);
        setOtpauthUrl(result.otpauthUrl || '');
        setStep(2);
        setCode('');
      } else {
        setError(result.error || 'Invalid secret password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await verify(pendingEmail, code, rememberMe, rememberDuration);
      if (result.success) {
        if (otpauthUrl) {
          setShowQrForSecondAdmin(true);
        } else {
          setStep(1);
          setPassword('');
          setPendingEmail('');
          setCode('');
        }
      } else {
        setError(result.error || 'Invalid or expired code');
      }
    } finally {
      setLoading(false);
    }
  };

  const layoutClass = 'min-h-screen bg-background text-foreground flex items-center justify-center p-4 pt-24 md:pt-28';
  const cardClass = 'w-full max-w-md bg-surface border border-border rounded-card p-8 shadow-card';
  const btnClass = 'w-full py-3 rounded-lg font-medium bg-primary text-black hover:opacity-90 transition-opacity disabled:opacity-50';

  if (isValid && showQrForSecondAdmin) {
    return (
      <div className={layoutClass}>
        <div className={cardClass}>
          <h1 className="text-2xl font-bold mb-2 text-center">Admin panel</h1>
          <p className="text-muted text-sm mb-4 text-center">
            You’re signed in. Leave this QR code visible so another admin can scan it and add the same code to their Authenticator app.
          </p>
          {otpauthUrl && (
            <div className="flex justify-center my-6">
              <QRCodeSVG value={otpauthUrl} size={200} level="M" />
            </div>
          )}
          <button
            type="button"
            onClick={() => { setShowQrForSecondAdmin(false); setOtpauthUrl(''); }}
            className={btnClass}
          >
            Continue to panel
          </button>
        </div>
      </div>
    );
  }

  if (isValid) {
    return <Admin />;
  }

  const inputClass = 'w-full px-4 py-3 rounded-lg bg-background border border-border text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none';
  const labelClass = 'block text-sm font-medium text-muted mb-2';

  return (
    <div className={layoutClass}>
      <div className={cardClass}>
        <h1 className="text-2xl font-bold mb-6 text-center">Admin panel</h1>

        {step === 1 && (
          <form onSubmit={handleStep1}>
            <label className={labelClass}>Secret password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className={inputClass}
              placeholder="Enter secret password"
              autoComplete="off"
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button type="submit" className={`${btnClass} mt-6`} disabled={loading || !password.trim()}>
              {loading ? 'Checking…' : 'Continue'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2}>
            {otpauthUrl && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">
                  {setupRequired ? 'Set up Google Authenticator' : 'QR code for admins'}
                </h2>
                <p className="text-muted text-sm mb-2">
                  {setupRequired
                    ? 'Scan this QR code with Google Authenticator (or similar app), then enter the 6-digit code below.'
                    : 'Another admin can scan this QR to add the same code to their app. Then enter your 6-digit code below.'}
                </p>
                <div className="flex justify-center my-4">
                  <QRCodeSVG value={otpauthUrl} size={200} level="M" />
                </div>
              </div>
            )}
            {!otpauthUrl && (
              <p className="text-muted text-sm mb-4">
                Enter the 6-digit code from your authenticator app.
              </p>
            )}
            <label className={labelClass}>Authenticator code</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              className={inputClass}
              placeholder="000000"
              autoComplete="one-time-code"
              autoFocus
            />
            <div className="mt-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="remember" className="text-sm text-muted">Remember me</label>
            </div>
            {rememberMe && (
              <div className="mt-2">
                <label className={labelClass}>Duration</label>
                <select
                  value={rememberDuration}
                  onChange={(e) => setRememberDuration(e.target.value)}
                  className={inputClass}
                >
                  {REMEMBER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <button type="submit" className={`${btnClass} mt-6`} disabled={loading || !code.trim()}>
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); setCode(''); setPendingEmail(''); setSetupRequired(false); setOtpauthUrl(''); }}
              className="w-full py-2 mt-3 text-sm text-muted hover:text-foreground"
            >
              Back to password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
