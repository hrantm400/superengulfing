import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { getApiUrl } from '../lib/api';
import { Eye, EyeOff } from 'lucide-react';

const SetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { localizePath } = useLocale();
    const { t } = useTranslation();
    const token = searchParams.get('token') || '';
    const [password, setPasswordState] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) setError('missingToken');
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password.length < 6) {
            setError('passwordMin');
            return;
        }
        if (password !== confirmPassword) {
            setError('passwordsMatch');
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch(`${getApiUrl()}/api/set-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = (data.message || '').toLowerCase();
                setError(msg.includes('already used') ? 'linkUsed' : 'linkInvalid');
                return;
            }
            navigate(localizePath('/login'), { state: { message: t('setPassword.passwordSet') } });
        } catch {
            setError('errorGeneric');
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
                    <h1 className="text-2xl font-bold text-foreground mb-2">{t('setPassword.title')}</h1>
                    <p className="text-gray-400 text-sm mb-8">
                        {t('setPassword.subtitle')}
                    </p>

                    {!token ? (
                        <div className="space-y-4">
                            <p className="text-sm text-red-400">{t('setPassword.missingToken')}</p>
                            <Link to={localizePath('/course-access')} className="text-primary hover:underline underline-offset-2">{t('setPassword.requestAccess')}</Link>
                        </div>
                    ) : error === 'linkUsed' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-amber-400 animate-scale-in">{t('setPassword.linkUsed')}</p>
                            <Link to={localizePath('/login')} className="inline-block bg-primary text-black font-bold py-2 px-4 rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">{t('setPassword.goToLogin')}</Link>
                        </div>
                    ) : error === 'linkInvalid' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-red-400">{t('setPassword.linkInvalid')}</p>
                            <p className="text-sm text-muted">{t('setPassword.alreadySetPart1')}<Link to={localizePath('/login')} className="text-primary hover:underline underline-offset-2">{t('setPassword.logInLink')}</Link>{t('setPassword.alreadySetPart2')}<Link to={localizePath('/course-access')} className="text-primary hover:underline underline-offset-2">{t('setPassword.accessPage')}</Link>{t('setPassword.alreadySetPart3')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="set-password" className="block text-sm font-medium text-muted mb-2">
                                    {t('setPassword.passwordLabel')}
                                </label>
                                <div className="relative">
                                    <input
                                        id="set-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPasswordState(e.target.value)}
                                        placeholder="••••••••"
                                        minLength={6}
                                        className="w-full min-h-[48px] bg-background border border-border rounded-lg px-4 py-3 pr-11 text-foreground placeholder-muted focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all duration-300"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute inset-y-0 right-0 flex items-center min-w-[44px] min-h-[48px] pr-3 text-muted hover:text-foreground"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="set-password-confirm" className="block text-sm font-medium text-muted mb-2">
                                    {t('setPassword.confirmLabel')}
                                </label>
                                <div className="relative">
                                    <input
                                        id="set-password-confirm"
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        minLength={6}
                                        className="w-full min-h-[48px] bg-background border border-border rounded-lg px-4 py-3 pr-11 text-foreground placeholder-muted focus:border-primary focus:ring-2 focus:ring-primary/50 outline-none transition-all duration-300"
                                        autoComplete="new-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm((v) => !v)}
                                        className="absolute inset-y-0 right-0 flex items-center min-w-[44px] min-h-[48px] pr-3 text-muted hover:text-foreground"
                                        aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                                    >
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            {error && <p className="text-sm text-red-400 animate-scale-in">{t(`setPassword.${error}`)}</p>}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full min-h-[48px] bg-primary hover:bg-primary/90 text-black font-bold py-3 px-4 rounded-lg shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {isSubmitting ? t('setPassword.setting') : t('setPassword.setButton')}
                            </button>
                        </form>
                    )}
                </div>
                <p className="text-center text-muted text-sm mt-6">
                    <Link to={localizePath('/login')} className="text-primary hover:underline underline-offset-2 transition-colors duration-200">{t('setPassword.backToLogin')}</Link>
                </p>
            </div>
        </div>
    );
};

export default SetPassword;
