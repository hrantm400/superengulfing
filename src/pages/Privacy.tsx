import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const Privacy: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative pt-24 md:pt-28 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <div className="inline-block h-px w-24 bg-primary/50 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-cinzel">
              {t('privacy.title')}
            </h1>
            <p className="text-muted text-sm mt-3">{t('privacy.lastUpdated')}</p>
            <p className="text-muted text-sm">{t('terms.operator')}</p>
            <div className="inline-block h-px w-24 bg-primary/50 mt-6" />
          </header>

          {/* Intro */}
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-10">
            At SuperEngulfing.com, we operate under a &quot;Privacy First&quot; philosophy. This policy outlines how we handle your information when you access the SuperEngulfing ecosystem.
          </p>

          {/* Content */}
          <article className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">1.</span> DATA COLLECTION (THE VAULT)
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                We only collect the information necessary to provide you with our proprietary trading resources.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">Personal Information:</strong> This includes your name and email address, provided voluntarily when you register for the &quot;Freemium&quot; tools (Indicator, PDF, or Course) and the weex.com UID.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">Technical Data:</strong> We may collect non-identifying information such as your IP address, browser type, and device information to ensure the security of our proprietary logic and to prevent unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">2.</span> HOW WE USE YOUR INFORMATION
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                Your data is used strictly for the following purposes:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base leading-relaxed">
                <li><strong className="text-foreground">Access Management:</strong> To whitelist your TradingView username and provide access to the SuperEngulfing indicator.</li>
                <li><strong className="text-foreground">Intelligence Updates:</strong> To send you the &quot;Liquidity Trap&quot; PDF, video course links, and periodic market analysis or product updates.</li>
                <li><strong className="text-foreground">Security:</strong> To monitor for &quot;leaks&quot; or unauthorized sharing of our proprietary Pine Script logic.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">3.</span> DATA PROTECTION & SHARING
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                <strong className="text-foreground">No Third-Party Sales:</strong> We do not sell, trade, or rent your personal identification information to marketing firms or third parties.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                <strong className="text-foreground">Service Providers:</strong> We may use trusted third-party service providers (such as email delivery platforms) to help us operate our business, provided those parties agree to keep your information confidential.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">Legal Requirements:</strong> We will only disclose your information if required by law or to protect our intellectual property rights against piracy or plagiarism.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">4.</span> COOKIES & TRACKING
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                Our website may use &quot;cookies&quot; to enhance your user experience. You may choose to set your web browser to refuse cookies, though some parts of the SuperEngulfing ecosystem may not function properly as a result.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">5.</span> THIRD-PARTY LINKS
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                The SuperEngulfing indicator is hosted on TradingView. While we provide the script, your usage of their platform is governed by TradingView&apos;s own privacy policy. We recommend reviewing their terms before utilizing the indicator.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">6.</span> YOUR RIGHTS & OPT-OUT
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm md:text-base leading-relaxed">
                <li><strong className="text-foreground">Unsubscribe:</strong> You may opt-out of our newsletter at any time using the link at the bottom of our emails.</li>
                <li><strong className="text-foreground">Data Deletion:</strong> You may request that we delete your email from our records. Please note that deleting your data will result in the immediate revocation of your license to the SuperEngulfing indicator and video materials.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">7.</span> CHANGES TO THIS POLICY
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                SuperEngulfing has the discretion to update this privacy policy at any time. When we do, we will revise the &quot;Effective Date&quot; at the top of this page.
              </p>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">CONSENT</h2>
              <p className="text-sm md:text-base leading-relaxed">
                By using our website and resources, you hereby consent to our Privacy Policy and agree to its terms.
              </p>
            </section>
          </article>

          {/* Footer CTA */}
          <footer className="mt-16 pt-8 border-t border-border text-center">
            <LocaleLink
              to="/"
              className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-medium"
            >
              ← Back to Home
            </LocaleLink>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
