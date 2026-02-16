import React, { useEffect, useState } from 'react';
import { Link } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { getApiUrl } from '../lib/api';
import { useTranslation } from '../locales';
import AnimatedSection from '../components/ui/AnimatedSection';

type MediaState = { welcomePdfUrl: string; welcomeVideoUrl: string };

const ThankYou: React.FC<{ localeFromLoader?: 'en' | 'am' | null }> = ({ localeFromLoader }) => {
    const { locale: contextLocale, localizePath } = useLocale();
    const locale = localeFromLoader ?? contextLocale;
    const { t } = useTranslation();
    const [media, setMedia] = useState<MediaState>({ welcomePdfUrl: '', welcomeVideoUrl: '' });
    const pdfLink = media.welcomePdfUrl;

    useEffect(() => {
        const apiUrl = getApiUrl();
        if (!apiUrl || !locale) return;
        fetch(`${apiUrl}/api/site-media?locale=${locale}`)
            .then(res => (res.ok ? res.json() : null))
            .then((data: { welcomePdfUrl?: string; welcomeVideoUrl?: string } | null) => {
                if (data?.welcomePdfUrl || data?.welcomeVideoUrl) {
                    setMedia({
                        welcomePdfUrl: data.welcomePdfUrl || '',
                        welcomeVideoUrl: data.welcomeVideoUrl || ''
                    });
                }
            })
            .catch(() => {});
    }, [locale]);

    // Auto-open PDF in new tab after 2 seconds (only when we have link from API)
    useEffect(() => {
        if (!pdfLink) return;
        const timer = setTimeout(() => {
            window.open(pdfLink, '_blank');
        }, 2000);
        return () => clearTimeout(timer);
    }, [pdfLink]);

    return (
        <div className="min-h-screen bg-background text-foreground font-display relative overflow-x-hidden">

            {/* Background Effects */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(57, 255, 20, 0.05), transparent 40%), radial-gradient(circle at 85% 30%, rgba(0, 43, 43, 0.3), transparent 35%)'
                }}
            />

            {/* Grid Pattern Overlay */}
            <div
                className="fixed inset-0 pointer-events-none opacity-30"
                style={{
                    backgroundImage: 'linear-gradient(to right, rgba(57, 255, 20, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(57, 255, 20, 0.03) 1px, transparent 1px)',
                    backgroundSize: '50px 50px',
                    maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)'
                }}
            />

            {/* Main Content */}
            <main className="flex-1 relative z-10 py-16 md:py-24">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">

                    {/* Success Badge */}
                    <AnimatedSection className="mb-12 space-y-4" delayMs={60}>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            {t('thankYou.badge')}
                        </div>

                        {/* Main Headline */}
                        <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-foreground leading-tight">
                            {t('thankYou.headline')}
                        </h2>

                        {/* Subheadline */}
                        <p className="text-muted text-lg font-light max-w-2xl mx-auto">
                            {t('thankYou.subline')}
                        </p>
                    </AnimatedSection>

                    {/* Wistia Video Embed — only from API (env) */}
                    {media.welcomeVideoUrl && (
                        <AnimatedSection
                            className="rounded-card overflow-hidden mb-12 bg-surface/40 backdrop-blur-xl shadow-card hover:shadow-card-hover border border-border hover:border-primary/20 relative transition-all duration-300 hover:-translate-y-1"
                            delayMs={120}
                        >
                            <div className="relative pb-[56.25%] h-0 overflow-hidden bg-black">
                                <iframe
                                    src={media.welcomeVideoUrl}
                                    title="Welcome Video"
                                    allow="autoplay; fullscreen"
                                    allowFullScreen
                                    className="absolute inset-0 w-full h-full"
                                />
                            </div>
                            <div className="absolute bottom-4 left-4 flex items-center gap-3 z-10 pointer-events-none">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-mono uppercase tracking-widest text-foreground/70">{t('thankYou.welcomeCircle')}</span>
                            </div>
                        </AnimatedSection>
                    )}

                    {/* CTA Section */}
                    <AnimatedSection className="space-y-6 mb-24" delayMs={160}>
                        <Link
                            to={localizePath('/course-access')}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-5 md:px-14 md:py-6 rounded-2xl font-bold text-lg md:text-xl text-black bg-primary hover:bg-primary-glow border-2 border-primary/30 shadow-[0_0_24px_rgba(57,255,20,0.2)] hover:shadow-[0_0_32px_rgba(57,255,20,0.35)] transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
                        >
                            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                            {t('thankYou.cta')}
                        </Link>
                    </AnimatedSection>

                    {/* Blueprint Section */}
                    <AnimatedSection asChild={false} className="relative" delayMs={200}>
                    <section className="relative">
                        {/* Background Dots */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none rounded-card"
                            style={{
                                backgroundImage: 'radial-gradient(rgba(57, 255, 20, 0.1) 1px, transparent 1px)',
                                backgroundSize: '30px 30px'
                            }}
                        />

                        {/* Glass Card */}
                        <div
                            className="rounded-card p-8 md:p-12 relative overflow-hidden border border-border bg-surface/40 backdrop-blur-xl"
                        >
                            {/* Corner Markers */}
                            <div className="absolute top-0 right-0 w-32 h-32 border-r border-t border-primary/10 -mt-2 -mr-2 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 border-l border-b border-primary/10 -mb-2 -ml-2 pointer-events-none" />

                            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16 text-left">

                                {/* Blueprint Cover */}
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    <div className="p-2 rounded-lg border border-border bg-surface/40 shadow-2xl group-hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] transition-all duration-500 group-hover:-translate-y-0.5">
                                        <img
                                            src="/se-cover_opt.webp"
                                            alt="SuperEngulfing Blueprint Cover"
                                            className="w-48 h-64 md:w-56 md:h-72 object-cover rounded shadow-xl"
                                        />
                                    </div>
                                </div>

                                {/* Text Content */}
                                <div className="flex-1 space-y-6">
                                    <div className="space-y-2">
                                        <span className="text-primary font-mono text-sm tracking-[0.2em] uppercase">{t('thankYou.blueprintBadge')}</span>
                                        <h3 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                                            {t('thankYou.blueprintTitle')}
                                        </h3>
                                        <p className="text-muted font-light text-lg max-w-lg">
                                            {t('thankYou.blueprintSubline')}
                                        </p>
                                    </div>

                                    {/* Download Button — only from API (env) */}
                                    {pdfLink && (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                                            <a
                                                href={pdfLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-8 py-4 bg-surfaceElevated hover:bg-surface/80 text-foreground border border-border rounded-lg font-bold flex items-center gap-3 transition-all duration-300 group/btn shadow-card hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98] hover:border-primary/30"
                                            >
                                                <span className="material-symbols-outlined text-primary group-hover/btn:translate-y-1 transition-transform">download</span>
                                                {t('thankYou.downloadNow')}
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                    </AnimatedSection>

                </div>
            </main>
        </div>
    );
};

export default ThankYou;
