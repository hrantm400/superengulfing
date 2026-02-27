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
    // Create default full-price order on first load
    createOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, course?.is_paid]);

  const createOrder = () => {
    if (!courseId) return;
    setError(null);
    setOrder(null);
    authFetch('/api/usdt/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_type: 'course',
        product_id: parseInt(courseId, 10),
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
        <div className="mt-3">
          <button
            type="button"
            onClick={() => createOrder()}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-[#020617] hover:bg-primary/90 transition-colors"
          >
            Pay full price
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      <USDTPaymentPage
        orderId={order.order_id}
        address={order.address}
        amount={order.amount}
        amountDisplay={order.amount_display}
        productName={course.title}
        productType="course"
        onSuccessRedirect={localizePath('/dashboard')}
      />
    </div>
  );
};

export default PayCoursePage;
