import React, { useEffect, useState } from 'react';
import { authFetch } from '../../lib/api';
import { useTranslation } from '../../locales';
import { Share2, Copy, Check, X, ChevronDown, Sparkles } from 'lucide-react';
import {
  IconFacebook,
  IconX,
  IconInstagram,
} from './SocialIcons';


const iconMap: Record<string, React.FC> = {
  facebook: IconFacebook,
  x: IconX,
  instagram: IconInstagram,
};

const shareLinks: { id: string; label: string; getUrl: (shareUrl: string, shareText?: string) => string }[] = [
  { id: 'facebook', label: 'Facebook', getUrl: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { id: 'x', label: 'X (Twitter)', getUrl: (u, text) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(text || '')}` },
  { id: 'instagram', label: 'Instagram', getUrl: () => 'https://www.instagram.com/' },
];

interface CertificateSectionProps {
  initialCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const CertificateSection: React.FC<CertificateSectionProps> = ({
  initialCollapsed = false,
  onCollapsedChange,
}) => {
  const { t } = useTranslation();
  const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    setCollapsed(!!initialCollapsed);
  }, [initialCollapsed]);

  useEffect(() => {
    let objectUrl: string | null = null;
    authFetch('/api/me/certificate')
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setCertificateUrl(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  useEffect(() => {
    authFetch('/api/me/certificate-share-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.shareUrl && setShareUrl(data.shareUrl))
      .catch(() => {});
  }, []);

  const shareText = t('dashboard.shareText');
  const copyShareText = () => {
    const text = `${shareText} ${shareUrl || ''}`.trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const linkUrl = shareUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  const setCollapsedAndSave = (value: boolean) => {
    setCollapsed(value);
    onCollapsedChange?.(value);
    authFetch('/api/me/certificate-section-collapsed', {
      method: 'PUT',
      body: JSON.stringify({ collapsed: value }),
    }).catch(() => {});
  };

  if (collapsed) {
    return (
      <section className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.03s' }}>
        <button
          type="button"
          onClick={() => setCollapsedAndSave(false)}
          className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-4 md:p-5 text-left transition-all duration-300 hover:border-amber-500/40 hover:shadow-[0_0_24px_-8px_rgba(245,158,11,0.15)]"
          aria-label="Show certificate section"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('dashboard.yourCertificate')}</h3>
                <p className="text-xs text-muted">{t('dashboard.shareDeclaration')}</p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 -rotate-90 text-muted" />
          </div>
        </button>
      </section>
    );
  }

  return (
    <section className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.03s' }}>
      <div
        className="rounded-2xl overflow-hidden border border-amber-500/20 bg-gradient-to-br from-surface/95 to-surface/80 shadow-lg"
        style={{
          boxShadow: '0 0 0 1px rgba(245,158,11,0.06), 0 4px 24px -4px rgba(0,0,0,0.12), 0 0 40px -12px rgba(245,158,11,0.08)',
        }}
      >
        {/* Header */}
        <div className="border-b border-border/80 bg-surfaceElevated/50 px-5 py-4 md:px-6 md:py-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 shadow-[0_0_12px_-4px_rgba(245,158,11,0.2)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
                {t('dashboard.yourCertificate')}
              </h3>
              <p className="text-sm text-muted mt-0.5">{t('dashboard.declarationShareHint')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsedAndSave(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surfaceElevated text-muted hover:text-foreground transition-all shrink-0"
            aria-label="Close certificate section"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">{t('dashboard.close')}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 flex flex-col lg:flex-row gap-8 items-start">
          {/* Certificate frame */}
          <div className="flex-shrink-0 w-full lg:max-w-[360px]">
            <div
              className="relative rounded-xl overflow-hidden border-2 border-amber-500/30 bg-black/50 p-3 md:p-4"
              style={{
                boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.1), 0 8px 32px -8px rgba(0,0,0,0.4), 0 0 24px -8px rgba(245,158,11,0.12)',
              }}
            >
              <div className="absolute inset-0 rounded-lg pointer-events-none bg-gradient-to-br from-amber-500/5 via-transparent to-transparent" />
              {certificateUrl ? (
                <img
                  src={certificateUrl}
                  alt="Certificate of Commitment"
                  className="relative w-full h-auto block rounded-lg"
                />
              ) : (
                <div className="aspect-[600/800] max-h-[320px] flex items-center justify-center rounded-lg bg-surfaceElevated/80 text-muted text-sm">
                  {t('dashboard.loading')}
                </div>
              )}
            </div>
          </div>

          {/* Share */}
          <div className="flex-1 min-w-0 space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">{t('dashboard.share')}</p>
              <div className="flex flex-wrap gap-3">
                {shareLinks.map(({ id, label, getUrl }) => {
                  const Icon = iconMap[id];
                  const href = getUrl(linkUrl, shareText);
                  return (
                    <a
                      key={id}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface hover:border-amber-500/40 hover:bg-amber-500/10 text-foreground transition-all duration-200 hover:shadow-[0_0_12px_-4px_rgba(245,158,11,0.2)]"
                      title={label}
                      aria-label={label}
                    >
                      {Icon ? <Icon /> : null}
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <button
                type="button"
                onClick={copyShareText}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-500/20 hover:border-amber-500/50 transition-all duration-200 hover:shadow-[0_0_16px_-4px_rgba(245,158,11,0.25)]"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? t('dashboard.copied') : t('dashboard.copyShareLink')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
