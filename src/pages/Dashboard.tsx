import React, { useState, useEffect } from 'react';
import { StatCards } from '../components/dashboard/StatCards';
import { ChartSection } from '../components/dashboard/ChartSection';
import { FeatureCards } from '../components/dashboard/FeatureCards';
import { ProfileSection } from '../components/dashboard/ProfileSection';
import { CertificateSection } from '../components/dashboard/CertificateSection';
import { MagicCertificate } from '../components/cinematic/MagicCertificate';
import { authFetch } from '../lib/api';
import { useTranslation } from '../locales';
import { User, ChevronDown, TestTube } from 'lucide-react';

interface Profile {
  email: string;
  first_name: string;
  onboarding_completed: boolean;
  certificate_section_collapsed?: boolean;
  tradingview_username?: string;
  indicator_access_status?: 'none' | 'pending' | 'approved' | 'rejected';
  indicator_requested_at?: string;
  indicator_rejected_reason?: string | null;
  indicator_rejected_at?: string | null;
}

type OnboardingStep = 'name' | 'certificate' | 'success' | null;

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);

  const loadProfile = () => {
    setProfileLoading(true);
    authFetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            email: data.email,
            first_name: data.first_name || '',
            onboarding_completed: data.onboarding_completed === true,
            certificate_section_collapsed: data.certificate_section_collapsed === true,
            tradingview_username: data.tradingview_username || '',
            indicator_access_status: (data.indicator_access_status || 'none') as 'none' | 'pending' | 'approved' | 'rejected',
            indicator_requested_at: data.indicator_requested_at || undefined,
            indicator_rejected_reason: data.indicator_rejected_reason ?? undefined,
            indicator_rejected_at: data.indicator_rejected_at ?? undefined,
          });
          if (!data.onboarding_completed) {
            if (!(data.first_name || '').trim()) setOnboardingStep('name');
            else setOnboardingStep('certificate');
          }
        }
      })
      .catch(() => {
        // API unreachable (e.g. backend not running) — show dashboard without profile
        setProfile(null);
      })
      .finally(() => setProfileLoading(false));
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleNameConfirm = async (name: string) => {
    setProfile((p) => (p ? { ...p, first_name: name } : null));
    setOnboardingStep('certificate');
    try {
      const res = await authFetch('/api/me', {
        method: 'PUT',
        body: JSON.stringify({ first_name: name }),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch {
      // Optimistic update: user already advanced; sync will retry or they can continue
    }
  };

  const handleAgree = async (certificatePngBase64?: string) => {
    const res = await authFetch('/api/me/send-certificate', {
      method: 'POST',
      body: JSON.stringify(certificatePngBase64 ? { certificatePng: certificatePngBase64 } : {}),
    });
    if (!res.ok) throw new Error('Failed to send');
    setOnboardingStep('success');
  };

  const handleSkip = async () => {
    await authFetch('/api/me/onboarding-complete', { method: 'PUT' });
    setProfile((p) => (p ? { ...p, onboarding_completed: true } : null));
    setOnboardingStep(null);
  };

  const handleSuccessContinue = async () => {
    try {
      await authFetch('/api/me/onboarding-complete', { method: 'PUT' });
    } catch {
      // still close and update local state
    }
    setProfile((p) => (p ? { ...p, onboarding_completed: true } : null));
    setOnboardingStep(null);
  };

  const handleTestOnboarding = async () => {
    const res = await authFetch('/api/me/onboarding-reset', { method: 'PUT' });
    if (!res.ok) return;
    setProfile((p) => (p ? { ...p, onboarding_completed: false } : null));
    setOnboardingStep(profile?.first_name?.trim() ? 'certificate' : 'name');
  };

  const displayLabel = profile?.first_name?.trim()
    ? `${profile.first_name.trim()} (${profile.email})`
    : profile?.email ?? '';

  if (profileLoading) {
    return (
      <div className="flex flex-col min-h-screen relative items-center justify-center">
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
        <p className="text-muted relative z-10">{t('dashboard.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen relative bg-bg transition-colors duration-500">
      <div className="fixed inset-0 bg-subtle-gradient pointer-events-none z-0 opacity-50 dark:opacity-20" />
      <div className="fixed inset-0 grid-bg pointer-events-none z-0 opacity-[0.4] dark:opacity-[0.3]" />

      {/* Cinematic Onboarding Overlay: name → certificate → success */}
      {onboardingStep && (
        <MagicCertificate
          onSubmitName={handleNameConfirm}
          onAgree={handleAgree}
          onContinue={handleSuccessContinue}
          initialStep={onboardingStep === 'certificate' ? 'certificate' : 'trap'}
          initialName={profile?.first_name?.trim() ?? ''}
        />
      )}

      <div className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
        <div className="max-w-[1440px] mx-auto space-y-8">

          <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-2 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.1s' }}>
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-1 text-foreground">
                {t('dashboard.welcome')}{profile?.first_name?.trim() ? `, ${profile.first_name.trim()}` : ''}
              </h2>
              <p className="text-muted">{t('dashboard.systemStatus')} <span className="text-emerald-500 font-mono font-medium">{t('dashboard.online')}</span></p>
              {displayLabel && (
                <p className="text-muted text-sm mt-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span>{t('dashboard.signedInAs')} <span className="text-foreground font-medium">{displayLabel}</span></span>
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4 md:mt-0">
              {/* Test onboarding button removed */}
              <button
                type="button"
                onClick={() => setShowProfile((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surfaceElevated text-foreground text-sm font-medium transition-colors shadow-sm"
              >
                <User className="w-4 h-4 text-primary" /> {t('dashboard.profile')} <ChevronDown className={`w-4 h-4 transition-transform ${showProfile ? 'rotate-180' : ''}`} />
              </button>
              <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {t('dashboard.marketOpen')}
              </div>
              <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono flex items-center gap-2">
                {t('dashboard.volatilityHigh')}
              </div>
            </div>
          </div>

          {showProfile && (
            <div className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.15s' }}>
              <ProfileSection />
            </div>
          )}

          {/* Certificate section removed from dashboard UI */}

          <div className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.25s' }}>
            <StatCards profile={profile} loadProfile={loadProfile} />
          </div>

          <section className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.3s' }}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{t('dashboard.patternLab')}</h2>
              <div className="h-px flex-1 bg-border/50 hidden md:block" />
              <p className="text-sm text-muted mt-0.5">{t('dashboard.patternLabSub')}</p>
            </div>
            <ChartSection />
          </section>

          <div className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.35s' }}>
            <FeatureCards />
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
