import React, { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { getApiUrl } from '../lib/api';

const VerificationCard: React.FC = () => {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [uid, setUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@') || !uid || !String(uid).trim()) {
      setError(t('access.step3.errorRequired'));
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), uid: String(uid).trim(), locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.code === 'already_exists' ? t('access.step3.errorAlreadyExists') : (data.message || t('access.step3.errorGeneric')));
        return;
      }
      setSuccess(true);
    } catch {
      setError(t('access.step3.errorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative group">
      <div className="glass-panel p-8 rounded-card relative overflow-hidden bg-surface/60 border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">

        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary font-bold z-10 shrink-0 animate-glow-pulse">
            3
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">{t('access.step3.title')}</h2>
            <p className="text-[10px] text-muted font-mono uppercase tracking-widest">{t('access.step3.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {success ? (
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-4 text-center animate-scale-in">
              <p className="text-sm text-foreground">
                {t('access.step3.success')}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {t('access.step3.hint')}
              </p>

              {error && (
                <p className="text-sm text-red-400 animate-scale-in">{error}</p>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-4 pl-12 pr-4 text-foreground placeholder:text-muted focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 text-sm outline-none"
                    placeholder={t('access.step3.emailPlaceholder')}
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted">
                    <span className="material-symbols-outlined text-xl">fingerprint</span>
                  </div>
                  <input
                    type="text"
                    value={uid}
                    onChange={(e) => setUid(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg py-4 pl-12 pr-4 text-foreground placeholder:text-muted focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-300 font-mono text-sm outline-none"
                    placeholder={t('access.step3.uidPlaceholder')}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-4 border border-primary/40 text-primary hover:bg-primary/10 font-bold rounded-lg text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 group/btn shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? t('access.step3.verifying') : t('access.step3.submit')}
                  <span className={`material-symbols-outlined text-lg ${!isSubmitting ? 'group-hover/btn:translate-x-1' : ''} transition-transform`}>
                    send
                  </span>
                </button>
              </form>
            </>
          )}
        </div>

        {!success && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-gray-500 font-mono">
            <span className="material-symbols-outlined text-xs">info</span>
            {t('access.step3.info')}
          </div>
        )}
      </div>

      {/* Decorative Corners */}
      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-border rounded-tr-md pointer-events-none"></div>
      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-border rounded-bl-md pointer-events-none"></div>
    </div>
  );
};

export default VerificationCard;