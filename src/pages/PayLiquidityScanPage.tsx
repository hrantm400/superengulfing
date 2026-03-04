import React, { useState, useEffect } from 'react';
import { authFetch, getApiUrl } from '../lib/api';
import { useLocale } from '../contexts/LocaleContext';
import USDTPaymentPage from '../components/payment/USDTPaymentPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useTranslation } from '../locales';

const PayLiquidityScanPage: React.FC = () => {
  const { t } = useTranslation();
  const { localizePath } = useLocale();
  const [network, setNetwork] = useState<'trc20' | 'bep20'>('trc20');
  const [order, setOrder] = useState<{
    order_id: string;
    address: string;
    amount: number;
    amount_display: string;
    qr_address: string;
    qr_payment: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOrder(null);
    authFetch('/api/usdt/create-order', {
      method: 'POST',
      body: JSON.stringify({ product_type: 'liquidityscan_pro', network }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.order_id && data.address) {
          setOrder(data);
        } else {
          setError(data.error || 'Failed to create order');
        }
      })
      .catch((e) => setError(e.message || 'Network error'))
      .finally(() => setLoading(false));
  }, [network]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <p className="text-red-400 mb-4">{error || 'Failed to create order'}</p>
        <a href={localizePath('/liquidityscan')} className="text-primary hover:underline">
          {t('usdt.backToLiquidityScan')}
        </a>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-8">
      <div className="max-w-4xl mx-auto px-4 mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-zinc-900/80 border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
          <span className="font-semibold uppercase tracking-wide text-zinc-500">Network</span>
          <button
            type="button"
            onClick={() => setNetwork('trc20')}
            className={`px-3 py-1 rounded-full font-semibold ${
              network === 'trc20' ? 'bg-emerald-500 text-black' : 'text-zinc-300 hover:text-white'
            }`}
          >
            TRC20 (Tron)
          </button>
          <button
            type="button"
            onClick={() => setNetwork('bep20')}
            className={`px-3 py-1 rounded-full font-semibold ${
              network === 'bep20' ? 'bg-emerald-500 text-black' : 'text-zinc-300 hover:text-white'
            }`}
          >
            BEP20 (BSC)
          </button>
        </div>
      </div>

      <USDTPaymentPage
        orderId={order.order_id}
        address={order.address}
        amount={order.amount}
        amountDisplay={order.amount_display}
        productName="LiquidityScan PRO"
        productType="liquidityscan_pro"
        network={network}
      />
    </div>
  );
};

export default PayLiquidityScanPage;
