import React from 'react';
import { LocaleLink } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';

const Disclaimer: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative pt-24 md:pt-28 pb-16 md:pb-24 px-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <header className="text-center mb-12 md:mb-16">
            <div className="inline-block h-px w-24 bg-primary/50 mb-6" />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground font-cinzel">
              {t('disclaimer.title')}
            </h1>
            <p className="text-muted text-sm mt-3">{t('disclaimer.lastUpdated')}</p>
            <p className="text-muted text-sm">{t('terms.operator')}</p>
            <div className="inline-block h-px w-24 bg-primary/50 mt-6" />
          </header>

          {/* Content */}
          <article className="space-y-10 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">1.</span> GENERAL RISK DISCLOSURE
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                Trading foreign exchange and other financial instruments carries a high level of risk and may not be suitable for all investors. The high degree of leverage can work against you as well as for you. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                The possibility exists that you could sustain a loss of some or all of your initial investment; therefore, you should not invest money that you cannot afford to lose.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">2.</span> NO FINANCIAL ADVICE
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                The SuperEngulfing indicator, &quot;Liquidity Trap&quot; PDF, Video Course, and all related materials provided by SuperEngulfing (collectively, &quot;the Materials&quot;) are for educational and informational purposes only.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                SuperEngulfing is not a registered investment advisor or broker-dealer. No part of the Materials should be construed as financial, investment, legal, or tax advice. Any trades placed based on the logic or setups described in the SuperEngulfing Protocol are taken at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">3.</span> PERFORMANCE & BACKTESTING
              </h2>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                While the SuperEngulfing logic (including REV/RUN and Wick Grab detection) is designed to identify high-probability market structures:
              </p>
              <p className="text-sm md:text-base leading-relaxed mb-4">
                <strong className="text-foreground">Hypothetical Performance:</strong> Results based on historical data have inherent limitations and do not represent actual trading.
              </p>
              <p className="text-sm md:text-base leading-relaxed">
                <strong className="text-foreground">No Guarantees:</strong> Past performance is not indicative of future results. There is no guarantee that any strategy discussed will result in profits or prevent losses.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">4.</span> INDEMNIFICATION
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                By using these tools, you agree that SuperEngulfing and its team members are not responsible for your trading results. You are solely responsible for your own &quot;due diligence.&quot; Under no circumstances shall SuperEngulfing be held liable for any direct or indirect loss resulting from the use of the SuperEngulfing indicator or educational resources.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-primary font-mono">5.</span> TECHNOLOGY & PLATFORM RISK
              </h2>
              <p className="text-sm md:text-base leading-relaxed">
                The SuperEngulfing indicator is hosted on TradingView. SuperEngulfing is not responsible for platform outages, technical glitches, or data inaccuracies provided by third-party charting software.
              </p>
            </section>

            <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">ACKNOWLEDGMENT</h2>
              <p className="text-sm md:text-base leading-relaxed">
                By utilizing any resources provided by SuperEngulfing, you acknowledge that you have read this Disclaimer and fully understand the risks associated with financial trading.
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

export default Disclaimer;
