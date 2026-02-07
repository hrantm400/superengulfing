import React, { useState } from 'react';
import { useTranslation } from '../../locales';

const chapterKeys: { titleKey: string; itemKeys: string[] }[] = [
    { titleKey: 'ch1Title', itemKeys: ['ch1Item1', 'ch1Item2', 'ch1Item3'] },
    { titleKey: 'ch2Title', itemKeys: ['ch2Item1', 'ch2Item2', 'ch2Item3', 'ch2Item4', 'ch2Item5'] },
    { titleKey: 'ch3Title', itemKeys: ['ch3Item1', 'ch3Item2', 'ch3Item3', 'ch3Item4', 'ch3Item5', 'ch3Item6', 'ch3Item7', 'ch3Item8'] },
    { titleKey: 'ch4Title', itemKeys: ['ch4Item1', 'ch4Item2', 'ch4Item3'] },
    { titleKey: 'ch5Title', itemKeys: ['ch5Item1', 'ch5Item2'] },
    { titleKey: 'ch6Title', itemKeys: ['ch6Item1', 'ch6Item2', 'ch6Item3'] },
];

const Blueprint: React.FC = () => {
    const { t } = useTranslation();
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    const toggle = (index: number) => {
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <section id="inside" className="py-32 relative">
            <div className="max-w-[800px] mx-auto px-4 sm:px-6">
                <div className="text-center mb-16 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.05s' }}>
                    <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight font-display">{t('book.blueprint.sectionTitle')}</h2>
                    <p className="text-muted text-sm tracking-widest uppercase font-display">{t('book.blueprint.sectionSubtitle')}</p>
                </div>
                
                <div className="space-y-4">
                    {chapterKeys.map((chapter, index) => (
                        <div key={index} className="glass-panel rounded-card overflow-hidden transition-all duration-300 border border-border shadow-card hover:shadow-card-hover hover:border-primary/20 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
                            <button 
                                onClick={() => toggle(index)}
                                className="w-full p-6 cursor-pointer flex items-center justify-between hover:bg-surfaceElevated transition-colors text-left"
                            >
                                <span className={`text-lg font-bold tracking-tight font-display transition-colors ${openIndex === index ? 'text-primary' : 'text-foreground'}`}>
                                    {t(`book.blueprint.${chapter.titleKey}`)}
                                </span>
                                <span className={`material-symbols-outlined text-primary transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>
                            <div 
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                            >
                                <div className="px-4 sm:px-6 pb-8 border-t border-border pt-4">
                                    <ul className="space-y-3">
                                        {chapter.itemKeys.map((key, idx) => (
                                            <li key={idx} className="flex items-start gap-3 text-muted text-sm font-body">
                                                <span className="material-symbols-outlined text-primary/50 text-[18px] mt-0.5">arrow_right</span>
                                                <span>{t(`book.blueprint.${key}`)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Blueprint;