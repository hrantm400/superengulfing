import React, { useState } from 'react';
import PdfSuccessPopup from './PdfSuccessPopup';
import { useTranslation } from '../locales';
import { useLocale } from '../contexts/LocaleContext';
import { getApiUrl } from '../lib/api';

const Hero: React.FC = () => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch(`${getApiUrl()}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'hero', locale }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.subscriptionStatus === 'already_subscribed') {
          setStatus('error');
          setMessage(t('home.hero.emailAlreadyUsed'));
        } else if (data.subscriptionStatus === 'pending_confirmation') {
          setStatus('error');
          setMessage(t('home.hero.pendingConfirm'));
        } else {
          setStatus('success');
          setMessage(data.message);
          setEmail('');
        }
      } else {
        setStatus('error');
        setMessage(data.message);
      }
    } catch (err) {
      setStatus('error');
      setMessage(t('home.hero.connectionError'));
    }
  };



  return (
    <>
      <PdfSuccessPopup
        open={status === 'success'}
        onClose={() => setStatus('idle')}
      />
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 relative pt-20">
      <div className="max-w-4xl mx-auto space-y-12 relative">

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-primary/20 bg-primary/5 text-primary text-xs font-mono uppercase tracking-widest mb-4 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.1s' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          {t('home.hero.badge')}
        </div>

        {/* Headlines */}
        <div className="space-y-6 relative z-10">
          <h1 className={`text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter text-foreground drop-shadow-2xl animate-fade-in-up opacity-0 [animation-fill-mode:forwards] ${locale === 'am' ? 'leading-[1.35] max-w-4xl mx-auto text-balance' : 'leading-[1]'}`} style={{ animationDelay: '0.2s' }}>
            {locale === 'am' ? (
              <span className="block">
                <span className="block text-[0.4em] leading-snug">
                  {t('home.hero.headline1')}
                </span>
                <span className="block mt-2 text-[0.6em] text-transparent bg-clip-text bg-gradient-to-r from-foreground via-primary to-primary-glow font-extrabold relative inline-block pb-2">
                  {t('home.hero.headline2')}
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2"></path>
                  </svg>
                </span>
              </span>
            ) : (
              <>
                {t('home.hero.headline1')} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-primary to-primary-glow font-extrabold relative inline-block pb-2">
                  {t('home.hero.headline2')}
                  <svg className="absolute w-full h-3 -bottom-1 left-0 text-primary opacity-50" preserveAspectRatio="none" viewBox="0 0 100 10">
                    <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2"></path>
                  </svg>
                </span>
              </>
            )}
          </h1>
          <p className="text-muted text-lg md:text-2xl font-light max-w-2xl mx-auto tracking-tight leading-relaxed animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.35s' }}>
            {t('home.hero.subline1')} <br />
            <span className="text-foreground font-medium">SuperEngulfing</span> {t('home.hero.subline2')}
          </p>
        </div>

        {/* Input Form */}
        <div className="max-w-md mx-auto w-full pt-4">
          <form className="flex flex-col gap-4 relative" onSubmit={handleSubmit}>
            {/* Decorative Corners */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t border-l border-primary/50"></div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b border-r border-primary/50"></div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-500 dark:text-slate-400">mail</span>
              </div>
              <input
                type="email"
                required
                disabled={status === 'loading'}
                className="w-full h-16 bg-surface/80 border border-border rounded-lg px-12 text-lg text-gray-900 dark:text-slate-100 placeholder:text-gray-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all duration-300 backdrop-blur-md font-mono disabled:opacity-50"
                placeholder={t('home.hero.placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full h-16 bg-primary hover:bg-primary-glow text-black rounded-lg font-bold text-lg md:text-xl shadow-glow-primary hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-wide flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100"
            >
              {status === 'loading' ? t('home.hero.sending') : t('home.hero.buttonFull')}
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
            </button>

            {status === 'error' && (
              <div className="text-red-400 text-sm font-medium text-center animate-scale-in">{message}</div>
            )}
          </form>

          {/* Meta Information / Trust Signals */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 font-mono uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
              Logic: low &lt; low[1]
            </span>
            <span className="hidden md:block text-muted/70">|</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">verified_user</span>
              Institutional Grade
            </span>
            <span className="hidden md:block text-muted/70">|</span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">timer</span>
              5-Min Setup
            </span>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce opacity-30">
        <span className="material-symbols-outlined text-foreground">keyboard_arrow_down</span>
      </div>
    </section>
    </>
  );
};

export default Hero;