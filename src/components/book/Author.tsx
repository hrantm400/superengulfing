import React from 'react';
import { useTranslation } from '../../locales';

const credKeys = ['cred1', 'cred2', 'cred3', 'cred4'];

const Author: React.FC = () => {
    const { t } = useTranslation();
    return (
        <section className="py-24 border-t border-border bg-surface/40">
            <div className="max-w-[1000px] mx-auto px-4 sm:px-6">
                <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
                    
                    {/* Image Column */}
                    <div className="w-full md:w-1/3 flex justify-center md:justify-end animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.1s' }}>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-primary rounded-card rotate-6 opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                            <div className="relative w-64 h-80 rounded-card overflow-hidden border border-border shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
                                <img 
                                    src="https://images.unsplash.com/photo-1556157382-97eda2d62296?q=80&w=800&auto=format&fit=crop" 
                                    alt="Author" 
                                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                                <div className="absolute bottom-4 left-4">
                                    <div className="text-foreground font-bold font-display text-lg">{t('book.author.name')}</div>
                                    <div className="text-primary text-[10px] uppercase tracking-widest font-display">{t('book.author.role')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Column */}
                    <div className="w-full md:w-2/3 text-center md:text-left animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.2s' }}>
                        <h2 className="text-3xl font-bold text-foreground mb-6 tracking-tight font-display">{t('book.author.title')}</h2>
                        
                        <div className="space-y-6 text-muted font-body leading-relaxed text-sm md:text-base mb-8">
                            <p>{t('book.author.para1')}</p>
                            <p>{t('book.author.para2')}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {credKeys.map((key) => (
                                <div key={key} className="flex items-center gap-3 justify-center md:justify-start">
                                    <span className="material-symbols-outlined text-primary text-lg">verified</span>
                                    <span className="text-foreground text-sm font-medium font-display">{t(`book.author.${key}`)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};

export default Author;