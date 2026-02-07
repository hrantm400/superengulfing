import React from 'react';
import { useTranslation } from '../../locales';

const StickyBar: React.FC = () => {
    const { t } = useTranslation();
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 sm:px-6 pt-6 pb-sticky-safe pointer-events-none">
            <div className="max-w-[700px] mx-auto bg-surface/90 backdrop-blur-2xl border border-border rounded-full p-2 pl-8 flex items-center justify-between shadow-2xl pointer-events-auto">
                <div className="hidden sm:flex flex-col">
                    <span className="text-xs uppercase tracking-widest text-primary font-bold font-display">{t('book.sticky.label')}</span>
                    <span className="text-sm text-muted font-body">{t('book.sticky.subline')}</span>
                </div>
                <button className="bg-primary hover:bg-white transition-all duration-300 shadow-glow-primary-sm hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm sm:text-base px-8 py-3 rounded-full flex items-center gap-2 font-display group">
                    <span>{t('book.sticky.button')}</span>
                    <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">diamond</span>
                </button>
            </div>
        </div>
    );
};

export default StickyBar;