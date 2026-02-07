import React from 'react';
import { useTranslation } from '../../locales';

const Testimonials: React.FC = () => {
    const { t } = useTranslation();
    return (
        <section id="reviews" className="py-24 border-y border-border bg-surfaceElevated">
            <div className="max-w-[800px] mx-auto px-4 sm:px-6 text-center">
                <h2 className="text-[10px] uppercase tracking-[0.4em] text-primary font-bold mb-12 font-display animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.05s' }}>{t('book.testimonials.badge')}</h2>
                <div className="relative animate-fade-in-up opacity-0 [animation-fill-mode:forwards]" style={{ animationDelay: '0.15s' }}>
                    <span className="material-symbols-outlined text-6xl text-primary/10 absolute -top-8 -left-4">format_quote</span>
                    <p className="text-2xl md:text-3xl font-medium text-foreground leading-relaxed italic mb-8 font-display">
                        {t('book.testimonials.quote')}
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <div 
                            className="size-12 rounded-full bg-cover bg-center grayscale border border-primary/30"
                            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDxoQmwPL2zoqsEBZ9NcvbfWznvqUCoWRRzutpVzG_hoE6vI9VhODzh3mEXIenM3sPwTPmF4Jty9-ZDo_yKfMFzc-P-GdgReKs-FqIOOtDn5vr7c-n0InrNEAbQNrO0PpU9pm370olr34Uw7INXUbNd7Xea7udgZ6woL96mS4PtGQQN4mgL3Njo0ayZOWsaKj9IRoAq5Kp0Y-O_UU0u1wHgoozJL_KSKsYGajaifX9Nz2euUony3wbcPScKeYTh_orScag0DP7QVhI')" }}
                        ></div>
                        <div className="text-left">
                            <div className="text-foreground font-bold text-sm tracking-wide font-display">{t('book.testimonials.name')}</div>
                            <div className="text-primary text-[10px] tracking-widest uppercase font-display">{t('book.testimonials.role')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Testimonials;