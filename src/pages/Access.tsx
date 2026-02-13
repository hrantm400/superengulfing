import React, { useState, useEffect } from 'react';
import AccessBackground from '../components/AccessBackground';
import AccessHero from '../components/AccessHero';
import ProcessCard from '../components/ProcessCard';
import VerificationCard from '../components/VerificationCard';
import AnimatedSection from '../components/ui/AnimatedSection';
import { useLocale } from '../contexts/LocaleContext';
import { getApiUrl } from '../lib/api';

function ensureAbsoluteUrl(url: string): string {
    if (!url || url === '#') return url;
    const u = url.trim();
    if (u.startsWith('http://') || u.startsWith('https://')) return u;
    return 'https://' + u;
}

const Access: React.FC = () => {
    const { locale } = useLocale();
    const [affiliate, setAffiliate] = useState<{ affiliate_label: string; affiliate_url: string }>({ affiliate_label: 'Test Affiliate Link', affiliate_url: '#' });

    const loadSettings = React.useCallback(() => {
        fetch(`${getApiUrl()}/api/settings?locale=${locale}`)
            .then(res => res.json())
            .then(data => setAffiliate({ affiliate_label: data.affiliate_label || 'Affiliate Link', affiliate_url: data.affiliate_url || '#' }))
            .catch(() => {});
    }, [locale]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Refetch when user returns to this tab (e.g. after saving in admin)
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') loadSettings();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [loadSettings]);

    return (
        <div className="relative min-h-screen flex flex-col pt-24 md:pt-28">
            {/* Affiliate banner – below navbar, editable from admin */}
            <a
                href={ensureAbsoluteUrl(affiliate.affiliate_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 px-6 bg-primary/10 border-b border-primary/20 text-center text-primary font-medium text-sm hover:bg-primary/20 hover:border-primary/30 hover:shadow-glow-primary transition-all duration-300 hover:scale-[1.01] relative z-20"
            >
                {affiliate.affiliate_label}
            </a>

            <AccessBackground />
            <div className="flex-1 relative z-10 flex flex-col justify-center py-28 lg:py-0 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
                    <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start py-24">

                        {/* Left Column: Hero & Features */}
                        <AnimatedSection className="space-y-10 relative lg:sticky lg:top-32" delayMs={80}>
                            <AccessHero />
                        </AnimatedSection>

                        {/* Right Column: Actions */}
                        <AnimatedSection className="space-y-6" delayMs={140}>
                            <ProcessCard
                                affiliateLabel={affiliate.affiliate_label}
                                affiliateUrl={ensureAbsoluteUrl(affiliate.affiliate_url)}
                            />
                            <VerificationCard />
                        </AnimatedSection>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Access;
