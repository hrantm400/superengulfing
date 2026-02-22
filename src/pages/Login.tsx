import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { useUser } from '../contexts/UserContext';
import { getApiUrl } from '../lib/api';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { localizePath } = useLocale();
    const { t } = useTranslation();
    const { profile, refetch } = useUser();
    const successMessage = (location.state as { message?: string })?.message;

    useEffect(() => {
        if (profile) {
            const base = profile.locale === 'am' ? '/am' : '';
            navigate(`${base}/dashboard`, { replace: true });
        }
    }, [profile, navigate]);

    // If session expired (JWT), show a clear message on the login screen.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const expired = window.sessionStorage.getItem('session_expired');
            if (expired === '1') {
                window.sessionStorage.removeItem('session_expired');
                setMessage('login.sessionExpired');
            }
        } catch {
            // ignore
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            setMessage('login.errorRequired');
            return;
        }
        setMessage('');
        setIsSubmitting(true);
        try {
            const res = await fetch(`${getApiUrl()}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 429) {
                    setMessage('login.tooManyAttempts');
                } else {
                    setMessage('login.errorInvalid');
                }
                return;
            }
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                await refetch();
                const base = data.locale === 'am' ? '/am' : '';
                navigate(`${base}/dashboard`);
            } else {
                setMessage('login.invalidResponse');
            }
        } catch {
            setMessage('login.serverError');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDevLogin = async () => {
        setMessage('');
        setIsSubmitting(true);
        try {
            const res = await fetch(`${getApiUrl()}/api/dev-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.token) {
                localStorage.setItem('auth_token', data.token);
                await refetch();
                const base = data.locale === 'am' ? '/am' : '';
                navigate(`${base}/dashboard`);
            } else {
                setMessage(res.status === 429 ? 'login.tooManyAttempts' : 'login.devFailed');
            }
        } catch {
            setMessage('login.serverUnreachable');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-24">
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-1/4 left-1/2 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2"></div>
            </div>

            <div className="relative z-10 w-full max-w-md animate-fade-in-up">
                <div className="rounded-card border border-border bg-surface/80 backdrop-blur-sm p-8 md:p-10 shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300">
                    <h1 className="text-2xl font-bold text-foreground mb-2">{t('login.title')}</h1>
                    <p className="text-muted text-sm mb-8">{t('login.subtitle')}</p>

                    {successMessage && (
                        <p className="text-sm text-primary mb-4">{successMessage}</p>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="login-email" className="block text-sm font-medium text-muted mb-2">
                                {t('login.placeholderEmail')}
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full min-h-[48px] bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder-muted focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all duration-300"
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label htmlFor="login-password" className="block text-sm font-medium text-muted mb-2">
                                {t('login.placeholderPassword')}
                            </label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full min-h-[48px] bg-background border border-border rounded-lg px-4 py-3 pr-12 text-foreground placeholder-muted focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all duration-300"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-0 top-0 bottom-0 min-w-[44px] flex items-center justify-center pr-2 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        {message && (
                            <p className="text-sm text-amber-400 animate-scale-in">{t(message)}</p>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full min-h-[48px] bg-primary hover:bg-primary/90 text-black font-bold py-3 px-4 rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                        >
                            {isSubmitting ? t('login.loggingIn') : t('login.button')}
                        </button>
                        {import.meta.env.DEV && (
                            <button
                                type="button"
                                onClick={handleDevLogin}
                                disabled={isSubmitting}
                                className="w-full mt-3 bg-white/5 border border-border hover:bg-white/10 text-muted hover:text-foreground font-medium py-2.5 px-4 rounded-lg transition-all duration-300 disabled:opacity-50 text-sm"
                            >
                                {t('login.devLogin')}
                            </button>
                        )}
                    </form>
                </div>

                <p className="text-center text-muted text-sm mt-6">
                    {t('login.needAccess')} <Link to={localizePath('/course-access')} className="text-primary hover:underline underline-offset-2 transition-colors duration-200">{t('login.accessPage')}</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
