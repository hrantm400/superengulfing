import React from 'react';
import { useTranslation } from '../../locales';

const tiers: { id: string; price: string; typeKey: string; titleKey: string; descKey: string; buttonKey: string; icon: string; isRecommended: boolean }[] = [
    { id: 'digital', price: '$19.99', typeKey: 'digitalType', titleKey: 'digitalTitle', descKey: 'digitalDesc', buttonKey: 'digitalButton', icon: 'stay_current_portrait', isRecommended: false },
    { id: 'print', price: '$34.99', typeKey: 'printType', titleKey: 'printTitle', descKey: 'printDesc', buttonKey: 'printButton', icon: 'menu_book', isRecommended: true },
];

const Pricing: React.FC = () => {
    const { t } = useTranslation();
    return (
        <section id="pricing" className="py-24 bg-gradient-to-b from-transparent to-black/40">
            <div className="max-w-[960px] mx-auto px-4 sm:px-6">
                <div className="text-center mb-16 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.05s' }}>
                    <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight font-display">{t('book.pricing.sectionTitle')}</h2>
                    <p className="text-primary text-[11px] font-bold tracking-[0.3em] uppercase font-display">{t('book.pricing.sectionSubtitle')}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-[850px] mx-auto">
                    {tiers.map((tier, idx) => (
                        <div key={tier.id} className={`relative flex flex-col animate-fade-in-up opacity-0 [animation-fill-mode:forwards] ${tier.isRecommended ? 'group' : ''}`} style={{ animationDelay: `${0.1 + idx * 0.1}s` }}>
                            {tier.isRecommended && (
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-transparent to-bronze/40 opacity-50 group-hover:opacity-100 transition-opacity rounded-card -m-[1px]"></div>
                            )}
                            
                            <div className={`
                                relative flex flex-col h-full p-10 rounded-card transition-all duration-300 shadow-card hover:shadow-card-hover hover:-translate-y-1
                                ${tier.isRecommended 
                                    ? 'bg-surface border border-border hover:border-primary/20' 
                                    : 'glass-panel border border-border hover:border-primary/20'}
                            `}>
                                {tier.isRecommended && (
                                    <div className="absolute top-4 right-4 bg-primary text-black text-[9px] font-black px-3 py-1 rounded-full tracking-widest uppercase font-display">
                                        {t('book.pricing.recommended')}
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-8">
                                    <div className="text-primary">
                                        <span className="material-symbols-outlined text-4xl">{tier.icon}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-foreground font-display">{tier.price}</div>
                                        <div className="text-[10px] text-muted uppercase tracking-widest font-display">{t(`book.pricing.${tier.typeKey}`)}</div>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-foreground mb-4 font-display">{t(`book.pricing.${tier.titleKey}`)}</h3>
                                <p className="text-muted text-sm mb-10 leading-relaxed font-body flex-grow">
                                    {t(`book.pricing.${tier.descKey}`)}
                                </p>

                                <button className={`
                                    w-full py-4 rounded-lg font-bold transition-all duration-300 uppercase text-[11px] tracking-[0.2em] font-display
                                    ${tier.isRecommended 
                                        ? 'bg-primary hover:bg-white text-black shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98]' 
                                        : 'border border-border hover:bg-foreground hover:text-background text-foreground hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98]'}
                                `}>
                                    {t(`book.pricing.${tier.buttonKey}`)}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Pricing;