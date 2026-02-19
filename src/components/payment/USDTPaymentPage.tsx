import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useLocale } from '../../contexts/LocaleContext';
import { useTranslation } from '../../locales';
import { getApiUrl } from '../../lib/api';
import { Copy, Check, Loader2 } from 'lucide-react';

export interface USDTPaymentPageProps {
  orderId: string;
  address: string;
  amount: number;
  amountDisplay: string;
  productName: string;
  productType: 'liquidityscan_pro' | 'course';
  onSuccessRedirect?: string;
}

const POLL_INTERVAL_MS = 5000;

const USDTPaymentPage: React.FC<USDTPaymentPageProps> = ({
  orderId,
  address,
  amount,
  amountDisplay,
  productName,
  productType,
  onSuccessRedirect,
}) => {
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'confirming' | 'completed'>('pending');
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${getApiUrl()}/api/usdt/orders/${encodeURIComponent(orderId)}/status`);
      const data = await res.json();
      if (data.status === 'completed') {
        setStatus('completed');
        setPolling(false);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        if (onSuccessRedirect) {
          setTimeout(() => navigate(onSuccessRedirect), 2000);
        }
      } else if (data.status === 'confirming') {
        setStatus('confirming');
      }
    } catch {
      // ignore
    }
  }, [orderId, onSuccessRedirect, navigate]);

  useEffect(() => {
    if (!polling || status === 'completed') return;
    const tmr = setInterval(fetchStatus, POLL_INTERVAL_MS);
    fetchStatus();
    return () => clearInterval(tmr);
  }, [polling, status, fetchStatus]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const qrAddress = address;
  const qrPayment = `tron:${address}?amount=${amount}&token=USDT`;

  if (status === 'completed') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 text-primary mb-6">
            <Check className="w-10 h-10" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{t('usdt.paymentReceived')}</h1>
          <p className="text-muted mb-6">{t('usdt.accessGranted')}</p>
          {productType === 'liquidityscan_pro' && (
            <a
              href="https://liquidityscan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block py-3 px-6 rounded-xl font-semibold bg-primary text-[#020617] hover:bg-primary/90 transition-colors"
            >
              {t('usdt.goToLiquidityScan')}
            </a>
          )}
          {productType === 'course' && onSuccessRedirect && (
            <Link
              to={onSuccessRedirect}
              className="inline-block py-3 px-6 rounded-xl font-semibold bg-primary text-[#020617] hover:bg-primary/90 transition-colors"
            >
              {t('dashboard.startLearning')}
            </Link>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">{productName}</h1>
      <p className="text-muted mb-6">{t('usdt.payAmount')} <span className="font-semibold text-foreground">{amountDisplay} USDT</span> (TRC20)</p>

      <div className="space-y-6">
        {/* Section 1: Address only */}
        <div className="rounded-2xl border border-border bg-surface/80 p-6">
          <p className="text-sm font-medium text-foreground mb-3">{t('usdt.qrAddressOnly')}</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-white rounded-xl">
              <QRCodeSVG value={qrAddress} size={140} level="M" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted font-mono break-all mb-2">{address}</p>
              <button
                onClick={copyAddress}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surfaceElevated hover:bg-border/50 text-foreground text-sm font-medium transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                {copied ? t('usdt.copied') : t('usdt.copyAddress')}
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Address + amount */}
        <div className="rounded-2xl border border-border bg-surface/80 p-6">
          <p className="text-sm font-medium text-foreground mb-3">{t('usdt.qrWithAmount')}</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-white rounded-xl">
              <QRCodeSVG value={qrPayment} size={140} level="M" />
            </div>
            <p className="text-sm text-muted">{t('usdt.scanToPreFill')}</p>
          </div>
        </div>

        {/* Live status */}
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <AnimatePresence mode="wait">
            {status === 'pending' && (
              <motion.div
                key="pending"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('usdt.waitingPayment')}</p>
                  <p className="text-sm text-muted">{t('usdt.waitingHint')}</p>
                </div>
              </motion.div>
            )}
            {status === 'confirming' && (
              <motion.div
                key="confirming"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <Loader2 className="w-6 h-6 text-primary animate-spin flex-shrink-0" />
                <div>
                  <p className="font-medium text-foreground">{t('usdt.verifying')}</p>
                  <p className="text-sm text-muted">{t('usdt.verifyingHint')}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="text-sm text-muted mt-6 mb-4">{t('dashboard.accessAfterPaymentAuto')}</p>
      <Link
        to={productType === 'course' ? localizePath('/dashboard') : localizePath('/liquidityscan')}
        className="inline-block px-6 py-3 rounded-xl bg-surfaceElevated hover:bg-surface/80 text-foreground font-medium"
      >
        {productType === 'course' ? t('dashboard.backToDashboard') : t('usdt.backToLiquidityScan')}
      </Link>
    </div>
  );
};

export default USDTPaymentPage;
