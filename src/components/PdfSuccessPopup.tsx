import React from 'react';
import { useTranslation } from '../locales';

interface PdfSuccessPopupProps {
  open: boolean;
  onClose: () => void;
}

const PdfSuccessPopup: React.FC<PdfSuccessPopupProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-success-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Popup Card */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-scale-in">
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/50 via-primary to-primary-glow" />

        <div className="p-8 md:p-10 text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl text-primary">mark_email_read</span>
          </div>

          <h2
            id="pdf-success-title"
            className="text-2xl md:text-3xl font-bold text-foreground tracking-tight mb-3"
          >
            {t('pdfSuccess.title')}
          </h2>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-sm mx-auto mb-2">
            {t('pdfSuccess.message')}
          </p>
          <p className="text-muted text-sm">
            {t('pdfSuccess.hint')}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full md:w-auto px-8 py-3.5 rounded-xl bg-primary text-black font-semibold hover:bg-primary-glow transition-all duration-300 hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] active:scale-[0.98]"
          >
            {t('pdfSuccess.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfSuccessPopup;
