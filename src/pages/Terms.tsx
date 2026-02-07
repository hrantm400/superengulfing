import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const Terms: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative pt-24 md:pt-28 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <div className="inline-block h-px w-24 bg-primary/50 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-cinzel">
              {t('terms.title')}
            </h1>
            <p className="text-muted text-sm mt-3">{t('terms.lastUpdated')}</p>
            <p className="text-muted text-sm">{t('terms.operator')}</p>
            <div className="inline-block h-px w-24 bg-primary/50 mt-6" />
          </header>

          {/* Content */}
          <article className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">1.</span> ACCEPTANCE OF THE PROTOCOL
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                By accessing the SuperEngulfing website, submitting your email address, or utilizing the proprietary resources provided (including the &quot;SuperEngulfing&quot; TradingView indicator, the &quot;Liquidity Trap&quot; PDF, and the Video Course), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, you are unauthorized to access the SuperEngulfing ecosystem or utilize its proprietary logic in any way apart from using it for your own trading.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">2.</span> THE EXCHANGE (ACCESS & CONSIDERATION)
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                Access to the SuperEngulfing resources is provided on a &quot;Freemium&quot; basis.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">The Consideration:</strong> In exchange for access to these institutional-grade tools, you agree to provide a valid email address and subscribe to our newsletter/communication channels.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">The Deliverables:</strong> Upon registration, you are granted a limited, non-transferable, revocable license to:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm md:text-base leading-relaxed">
                <li>Download and view the SuperEngulfing PDF Strategy Guide.</li>
                <li>Access the Video Course materials.</li>
                <li>Utilize the SuperEngulfing Indicator on the TradingView platform (subject to TradingView&apos;s own Terms of Service).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">3.</span> INTELLECTUAL PROPERTY & PROPRIETARY LOGIC
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                All content provided is the exclusive intellectual property of SuperEngulfing.com owned by Hayk Muradyan.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">The Code:</strong> The Pine Script logic driving the SuperEngulfing indicator (specifically the REV/RUN logic, Wick Grab detection, and PLUS (+) layer definitions) is proprietary. You may not reverse engineer, decompile, or copy the source code.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">The Content:</strong> The PDF guide and Video Course are for your personal educational use only. Redistribution, resale, or plagiarism of the &quot;SuperEngulfing&quot; methodology is strictly prohibited.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">Enforcement:</strong> Any unauthorized distribution of our proprietary logic will result in the immediate revocation of indicator access and potential legal action.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">4.</span> RISK DISCLOSURE (NO FINANCIAL ADVICE)
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                Trading involves a substantial risk of loss and is not suitable for every investor.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">Educational Purpose:</strong> The SuperEngulfing indicator, PDF, and Course are strictly for educational and informational purposes. They do not constitute financial advice, investment recommendations, or a signal service.
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-2">
                <strong className="text-foreground">No Guarantees:</strong> While the SuperEngulfing logic (REV/RUN) creates high-probability setups based on historical market structure, past performance is not indicative of future results.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">User Responsibility:</strong> You acknowledge that you are solely responsible for your trading decisions. SuperEngulfing assumes no liability for any financial losses incurred while using our tools or strategies (including the Strategies Playbook).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">5.</span> TRADINGVIEW INDICATOR ACCESS
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                <strong className="text-foreground">Platform Dependency:</strong> Access to the indicator requires a valid TradingView account. We are not affiliated with TradingView and cannot guarantee their platform&apos;s uptime.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">Revocation Rights:</strong> We reserve the right to remove your access to the SuperEngulfing indicator at any time, without notice, should we detect abuse, sharing of access, or violation of these terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">6.</span> PRIVACY & DATA USAGE
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                <strong className="text-foreground">The Vault:</strong> We respect the sanctity of your data. Your email address is collected solely for the purpose of delivering the requested resources and providing you with further intelligence regarding SuperEngulfing updates, market analysis, or product offers.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">No Third-Party Sales:</strong> We do not sell, trade, or rent your personal identification information to others.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">7.</span> LIMITATION OF LIABILITY
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                To the fullest extent permitted by law, SuperEngulfing and its officers shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use or inability to use the website, the indicator, or the educational materials.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">8.</span> GOVERNING LAW
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                These terms shall be governed by and construed in accordance with the laws of the United States of America, without regard to its conflict of law provisions.
              </p>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">ACKNOWLEDGMENT</h2>
              <p className="text-sm md:text-base leading-relaxed">
                By clicking &quot;Submit,&quot; &quot;Download,&quot; or &quot;Get Access,&quot; you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
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

export default Terms;
