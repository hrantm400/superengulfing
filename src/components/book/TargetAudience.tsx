import React from 'react';
import { useTranslation } from '../../locales';

const itemKeys = ['item1', 'item2', 'item3', 'item4', 'item5'];

const TargetAudience: React.FC = () => {
    const { t } = useTranslation();
    return (
        <section className="py-24 bg-background relative border-t border-border">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-30"></div>
            
            <div className="max-w-[900px] mx-auto px-4 sm:px-6 relative z-10">
                <div className="text-center mb-16 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.05s' }}>
                    <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight font-display">{t('book.target.title')}</h2>
                    <div className="h-1 w-20 bg-primary mx-auto rounded-full"></div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {itemKeys.map((key, index) => (
                        <div key={key} className="glass-panel p-6 rounded-card border border-border shadow-card hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20 transition-all duration-300 group animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: `${0.1 + index * 0.06}s` }}>
                            <div className="mb-4">
                                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <span className="material-symbols-outlined text-primary text-xl">check</span>
                                </div>
                            </div>
                            <p className="text-foreground/90 font-medium font-body leading-relaxed">
                                {t(`book.target.${key}`)}
                            </p>
                        </div>
                    ))}
                    <div className="hidden lg:flex glass-panel p-6 rounded-card border border-border shadow-card hover:shadow-card-hover items-center justify-center bg-surfaceElevated animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.5s' }}>
                        <span className="text-primary/40 font-display uppercase tracking-widest text-xs">{t('book.target.cta')}</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TargetAudience;