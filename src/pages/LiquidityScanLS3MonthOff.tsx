import React from 'react';
import { Background } from '../../liquidityscan-premium/components/Background';
import { Header } from '../../liquidityscan-premium/components/Header';
import { HeroContent } from '../../liquidityscan-premium/components/HeroContent';
import { PricingCard } from '../../liquidityscan-premium/components/PricingCard';
import { useUser } from '../contexts/UserContext';

const LiquidityScanLS3MonthOff: React.FC = () => {
  const { profile } = useUser();
  const customerEmail = profile?.email || undefined;
  const orderId = profile ? `LS3MONTHOFF_USER_${profile.id}` : 'LS3MONTHOFF_GUEST';

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden selection:bg-primary selection:text-black bg-[#050509] text-slate-100 pt-16 md:pt-20">
      {/* Background Layers */}
      <Background />

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col h-full flex-grow">
        <Header />

        <main className="flex-grow flex items-center justify-center py-10 lg:py-12">
          <div className="w-full max-w-[1400px] px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            {/* Left Column: Text & Features */}
            <div className="order-2 lg:order-1">
              <HeroContent />
            </div>

            {/* Right Column: Pricing & CTA */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end w-full">
              <PricingCard customerEmail={customerEmail} orderId={orderId} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LiquidityScanLS3MonthOff;

