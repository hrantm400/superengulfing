import React, { useState, useEffect } from 'react';
import { useParams, Link } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { authFetch, getApiUrl } from '../lib/api';
import USDTPaymentPage from '../components/payment/USDTPaymentPage';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface CourseInfo {
  id: number;
  title: string;
  price_display: string | null;
  is_paid: boolean;
}

const PayCoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [order, setOrder] = useState<{
    order_id: string;
    address: string;
    amount: number;
    amount_display: string;
    qr_address: string;
    qr_payment: string;
  } | null>(null);
  const [network, setNetwork] = useState<'trc20' | 'bep20'>('trc20');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      setError('Invalid course');
      return;
    }
    fetch(`${getApiUrl()}/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((data) => setCourse({ id: data.id, title: data.title, price_display: data.price_display, is_paid: data.is_paid }))
      .catch(() => setError('Course not found'))
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !course?.is_paid) return;
    // Create default full-price order on first load for selected network
    createOrder(network);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, course?.is_paid, network]);

  const createOrder = (net: 'trc20' | 'bep20') => {
    if (!courseId) return;
    setError(null);
    setOrder(null);
    authFetch('/api/usdt/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_type: 'course',
        product_id: parseInt(courseId, 10),
        network: net,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.order_id && data.address) {
          setOrder(data);
        } else {
          setError(data.error || 'Failed to create order');
        }
      })
      .catch((e) => setError(e.message || 'Network error'));
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Course not found'}</p>
        <Link to={localizePath('/dashboard')} className="text-primary hover:underline">
          {t('dashboard.backToDashboard')}
        </Link>
      </div>
    );
  }

  if (!course.is_paid) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-muted mb-4">This course is free. You can enroll from the dashboard.</p>
        <Link to={localizePath('/dashboard')} className="text-primary hover:underline">
          {t('dashboard.backToDashboard')}
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-20 pb-8">
      <div className="mb-4 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.payForCourse')}</h1>
        <p className="text-muted">{course.title}</p>
        {course.price_display && (
          <p className="text-sm text-foreground">
            <span className="font-semibold">{t('dashboard.price')}:</span> {course.price_display}
          </p>
        )}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      <div className="mb-4">
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
        productName={course.title}
        productType="course"
        network={network}
        onSuccessRedirect={localizePath('/dashboard')}
      />
    </div>
  );
};

export default PayCoursePage;
