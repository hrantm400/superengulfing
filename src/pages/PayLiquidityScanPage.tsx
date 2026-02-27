import React, { useState, useEffect } from 'react';
import { useSearchParams } from '@remix-run/react';
import { authFetch, getApiUrl } from '../lib/api';
import { useLocale } from '../contexts/LocaleContext';
import USDTPaymentPage from '../components/payment/USDTPaymentPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useTranslation } from '../locales';

const PayLiquidityScanPage: React.FC = () => {
  const { t } = useTranslation();
  const { localizePath } = useLocale();
  const [searchParams] = useSearchParams();
  const isTest = searchParams.get('test') === '1';
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
    authFetch('/api/usdt/create-order', {
      method: 'POST',
      body: JSON.stringify({ product_type: 'liquidityscan_pro', test: isTest }),
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
  }, []);

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
      <USDTPaymentPage
        orderId={order.order_id}
        address={order.address}
        amount={order.amount}
        amountDisplay={order.amount_display}
        productName={isTest ? 'LiquidityScan PRO — Test $10' : 'LiquidityScan PRO'}
        productType="liquidityscan_pro"
      />
    </div>
  );
};

export default PayLiquidityScanPage;
