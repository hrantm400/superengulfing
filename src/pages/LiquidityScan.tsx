import React from 'react';
import LiqScanHero from '../components/liquidityscan/LiqScanHero';
import LiqScanFeatureSpotlight from '../components/liquidityscan/LiqScanFeatureSpotlight';
import LiqScanPricing from '../components/liquidityscan/LiqScanPricing';
import LiqScanFAQ from '../components/liquidityscan/LiqScanFAQ';
const LiquidityScan: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="fixed inset-0 grid-bg pointer-events-none z-0"></div>

      <main className="flex-1 relative z-10">
        <LiqScanHero />
        <LiqScanFeatureSpotlight />
        <LiqScanPricing />
        <LiqScanFAQ />
      </main>
    </div>
  );
};

export default LiquidityScan;
