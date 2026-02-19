import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useLocale } from '../../contexts/LocaleContext';
import { useTranslation } from '../../locales';
import { getApiUrl } from '../../lib/api';
import { Copy, Check, Loader2, ShieldCheck, Clock, Coins, ScanLine } from 'lucide-react';

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
  const [tab, setTab] = useState<'addr' | 'qr'>('addr');
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes

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
  const qrValue = tab === 'addr' ? qrAddress : qrPayment;

  useEffect(() => {
    if (status === 'completed') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const timerProgress = 100 - (timeLeft / (20 * 60 || 1)) * 100;

  const isPending = status === 'pending';
  const isConfirming = status === 'confirming';
  const statusLabel = isPending
    ? t('usdt.waitingPayment')
    : isConfirming
    ? t('usdt.verifying')
    : t('usdt.paymentReceived');
  const statusColor =
    status === 'completed'
      ? 'text-emerald-400'
      : isConfirming
      ? 'text-amber-400'
      : 'text-amber-400';

  return (
    <div className="px-4 py-10 flex justify-center">
      <div
        className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden font-sans text-white shadow-2xl"
        style={{ backgroundColor: '#09090b' }}
      >
        {/* ambient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 blur-3xl -left-40 top-10" />
          <div className="absolute w-[400px] h-[400px] bg-emerald-400/10 blur-3xl -right-32 bottom-0" />
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start p-6 md:p-10">
          {/* left */}
          <div className="lg:col-span-5 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-semibold text-lg tracking-tight">SuperEngulfing • USDT</span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-[0.2em] pl-1">
                USDT TRC20 Checkout
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{productName}</h2>
            </div>

            <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-2xl shadow-2xl p-6 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-[0.08]">
                <Coins className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <p className="text-zinc-400 text-sm font-medium mb-2">Total amount due</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight font-mono text-white">
                    {amountDisplay}
                  </span>
                  <span className="text-xl font-semibold text-zinc-500">USDT</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1 font-mono">
                  {t('usdt.payAmount')} · TRC20 on Tron
                </p>
                <div className="mt-5 pt-5 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Network</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    TRC20
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-4 flex items-center gap-3">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <svg className="w-full h-full text-zinc-700" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.25"
                      fill="none"
                    />
                    <circle
                      r="15.9155"
                      cx="18"
                      cy="18"
                      stroke="#22c55e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      fill="none"
                      style={{
                        strokeDasharray: '100 100',
                        strokeDashoffset: timerProgress,
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                      }}
                    />
                  </svg>
                  <Clock className="w-4 h-4 text-zinc-400 absolute" />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Expires</p>
                  <p className="text-lg font-mono font-bold leading-none">
                    {minutes}:{seconds}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center border border-white/10">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shadow-[0_0_12px_rgba(34,197,94,0.6)] ${
                      status === 'completed'
                        ? 'bg-emerald-400'
                        : 'bg-amber-400 animate-pulse'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500 font-bold">Status</p>
                  <p className={`text-sm font-semibold leading-none ${statusColor}`}>{statusLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* right */}
          <div className="lg:col-span-7 rounded-[26px] bg-white/5 border border-white/10 backdrop-blur-2xl p-1 flex flex-col min-h-[460px] relative">
            {/* success overlay */}
            {status === 'completed' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 border border-emerald-500/30">
                  <Check className="w-10 h-10 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{t('usdt.paymentReceived')}</h2>
                <p className="text-zinc-300 text-sm mb-6">{t('usdt.accessGranted')}</p>
                <div className="flex flex-col gap-3 items-center">
                  {productType === 'liquidityscan_pro' && (
                    <a
                      href="https://liquidityscan.io"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-400 text-black font-semibold hover:bg-emerald-300 transition-colors"
                    >
                      {t('usdt.goToLiquidityScan')}
                    </a>
                  )}
                  {productType === 'course' && onSuccessRedirect && (
                    <Link
                      to={onSuccessRedirect}
                      className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-400 text-black font-semibold hover:bg-emerald-300 transition-colors"
                    >
                      {t('dashboard.startLearning')}
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="relative z-10 p-6 md:p-10 flex-1 flex flex-col items-center justify-center">
              {/* tabs */}
              <div className="w-full max-w-xs mx-auto mb-8">
                <div className="relative flex items-center rounded-2xl bg-black/40 border border-white/10 p-1">
                  <div
                    className="absolute top-1.5 bottom-1.5 w-1/2 rounded-xl bg-zinc-900 border border-white/10 transition-transform duration-300"
                    style={{
                      transform: tab === 'addr' ? 'translateX(0)' : 'translateX(100%)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setTab('addr')}
                    className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      tab === 'addr' ? 'text-white' : 'text-zinc-400'
                    }`}
                  >
                    Address only
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('qr')}
                    className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      tab === 'qr' ? 'text-white' : 'text-zinc-400'
                    }`}
                  >
                    Add amount
                  </button>
                </div>
              </div>

              {/* QR */}
              <div className="group relative mb-8 transition-transform duration-300 hover:scale-[1.02]">
                <div className="relative rounded-2xl bg-white p-4 shadow-2xl overflow-hidden">
                  <QRCodeSVG value={qrValue} size={192} level="M" />
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80 animate-[pulse_2.4s_ease-in-out_infinite]" />
                </div>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-semibold uppercase tracking-wide text-zinc-300 shadow-xl flex items-center gap-2">
                  <ScanLine className="w-3 h-3 text-emerald-400" />
                  <span>{tab === 'addr' ? 'Address only' : 'Auto-fill amount'}</span>
                </div>
              </div>

              {/* address */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between px-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">
                    USDT TRC20 address
                  </span>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-xl flex items-center p-1 pr-2">
                  <div className="flex-1 px-3 py-3 overflow-hidden">
                    <p className="font-mono text-sm text-zinc-100 truncate select-all">{address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="relative p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                  <AnimatePresence mode="wait">
                    {isPending && (
                      <motion.div
                        key="pending"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-start gap-3 text-sm"
                      >
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin mt-[2px]" />
                        <div>
                          <p className="font-medium text-zinc-100">{t('usdt.waitingPayment')}</p>
                          <p className="text-xs text-zinc-400 mt-1">{t('usdt.waitingHint')}</p>
                        </div>
                      </motion.div>
                    )}
                    {isConfirming && (
                      <motion.div
                        key="confirming"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-start gap-3 text-sm"
                      >
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin mt-[2px]" />
                        <div>
                          <p className="font-medium text-zinc-100">{t('usdt.verifying')}</p>
                          <p className="text-xs text-zinc-400 mt-1">{t('usdt.verifyingHint')}</p>
                        </div>
                      </motion.div>
                    )}
                    {status === 'completed' && (
                      <motion.div
                        key="done"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="flex items-start gap-3 text-sm"
                      >
                        <Check className="w-4 h-4 text-emerald-400 mt-[2px]" />
                        <div>
                          <p className="font-medium text-zinc-100">{t('usdt.paymentReceived')}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <p className="text-[11px] text-zinc-500 mt-4">
                  {t('dashboard.accessAfterPaymentAuto')}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Link
                    to={productType === 'course' ? localizePath('/dashboard') : localizePath('/liquidityscan')}
                    className="inline-flex px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-zinc-100 font-medium transition-colors"
                  >
                    {productType === 'course'
                      ? t('dashboard.backToDashboard')
                      : t('usdt.backToLiquidityScan')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default USDTPaymentPage;
