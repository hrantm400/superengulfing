import React from 'react';
import BookVisual from './BookVisual';
import { useTranslation } from '../../locales';

const BookHero: React.FC = () => {
    const { t } = useTranslation();
    return (
        <section className="flex flex-col items-center justify-center pt-16 pb-24 px-4 text-center relative z-10">
            <div className="max-w-[900px] flex flex-col items-center gap-10 w-full">

                {/* Badge */}
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-primary/5 border border-primary/20 backdrop-blur-sm animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.1s' }}>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-display">{t('book.hero.badge')}</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold leading-[0.95] tracking-tighter text-foreground font-display animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.2s' }}>
                    {t('book.hero.title')}
                </h1>

                {/* Subheading */}
                <p className="text-lg sm:text-xl text-muted max-w-[650px] font-light leading-relaxed font-body animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.3s' }}>
                    {t('book.hero.subtitle')}
                </p>

                {/* Visual */}
                <div className="animate-fade-in-up opacity-0 [animation-fill-mode:forwards] w-full" style={{ animationDelay: '0.35s' }}>
                    <BookVisual />
                </div>

                {/* Social Proof */}
                <div className="flex flex-col items-center gap-4 mt-8 animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.45s' }}>
                    <div className="flex -space-x-3">
                        {[
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuBykIApFBbcRhfUcjwZrtgxb5cz5DL2s-Vw_zNhnoeXpLl4Xt9CBTrIYmtQUXvB4df__3b_n-6S1QYusn1B7cO5ahKhTzQvi72USlACP-6V39hBWXHFNfjgArIWhpC2C6CDW7kOALEau8Enll3EEXyEaOKlZdDwnBce7qfl60rDON8PWzNAqMKZDyUtN2VobktKP0d6Jd_5HbvlUXFLm-inyhJ63KyvdTf7raUfW2GHTaiX_F7Yjs5sJTksHBW-soCbW12jUyIbrl0',
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuDLwnW8nSa6sqc-x1FpR-B2MtRFfFIHVTvBj4ex_Ajfwxfb9w4g82VXdb7o0Wnf2ID3wzNbN_P7rTe9UsFY2OMOxr9gCfwjarPS5aUEMxBXLWBhi7x5fi2DchFmLHZg0Q15zXjskpq3s-niNvXOK24IuDXjyZpcHP0AVTurv1SuvcJF9xTQGdh3K4MrYI_VEpedS_Ue2V8_ogAZmUNvZxC03pMtK82ryvPWCoShreR9BJLxLTn8tlByAj7UZ8nKETtvyTV0eO26Nb0',
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuC4WQLYWnjxJkkJ8q9U8i7rs1KXW-CgLKreUsBPhKah4cIP1yWGZMZBkfdzkI2joAv1PCkAIit1KUtSpvjVZrLZUDx4skqMTF7ISbhHIQMq-oNque-kNUh_QFtCJ07XuXjs9dhpnzFZzUjEbVT_-g10mvwsI3ZpO_c6wdzxWX20JOJHUsBg3Ka7EYQ4Cmy7ILKKVQXQmn2IEKV3b5SVqULIhAjH6aiBzvQXM4p2Z6EwyoFYY7U_egFMSiXHG8kM5sTt_K2-lRT2CtE'
                        ].map((src, i) => (
                            <div
                                key={i}
                                className="size-10 rounded-full border-2 border-background bg-surface bg-cover bg-center"
                                style={{ backgroundImage: `url('${src}')` }}
                            ></div>
                        ))}
                    </div>
                    <p className="text-[11px] text-muted uppercase tracking-[0.2em] font-display">{t('book.hero.socialProof')}</p>
                </div>
            </div>
        </section>
    );
};

export default BookHero;