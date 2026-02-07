import React from 'react';
import Hero from '../components/Hero';
import SocialProof from '../components/SocialProof';
import Features from '../components/Features';
import PatternShowcase from '../components/PatternShowcase';
import BackgroundEffects from '../components/BackgroundEffects';

const Home: React.FC = () => {
    return (
        <>
            <BackgroundEffects />
            <div className="flex-1 relative z-10 flex flex-col">
                <Hero />
                <SocialProof />
                <Features />
                <PatternShowcase />
            </div>
        </>
    );
};

export default Home;
