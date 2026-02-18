import React from 'react';
import { Background } from './components/Background';
import { Header } from './components/Header';
import { HeroContent } from './components/HeroContent';
import { PricingCard } from './components/PricingCard';

export default function App() {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden selection:bg-primary selection:text-black">
      {/* Background Layers */}
      <Background />

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col h-full flex-grow">
        <Header />
        
        <main className="flex-grow flex items-center justify-center py-12 lg:py-0">
          <div className="w-full max-w-[1400px] px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            {/* Left Column: Text & Features */}
            <div className="order-2 lg:order-1">
              <HeroContent />
            </div>

            {/* Right Column: Pricing & CTA */}
            <div className="order-1 lg:order-2 flex justify-center lg:justify-end w-full">
              <PricingCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}