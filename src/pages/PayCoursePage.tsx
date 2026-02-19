import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { authFetch, getApiUrl } from '../lib/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface CourseInfo {
  id: number;
  title: string;
  price_display: string | null;
  is_paid: boolean;
}

const PayCoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
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

  const handleConfirmPayment = async () => {
    if (!courseId || !course) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await authFetch('/api/course-payment-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: parseInt(courseId, 10) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t('dashboard.paymentFailed'));
        setConfirming(false);
        return;
      }
      navigate(localizePath(`/dashboard/courses/${courseId}`));
    } catch {
      setError(t('dashboard.paymentFailed'));
      setConfirming(false);
    }
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

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">{t('dashboard.payForCourse')}</h1>
      <p className="text-muted mb-6">{course.title}</p>
      {course.price_display && (
        <p className="text-lg font-semibold text-foreground mb-6">
          {t('dashboard.price')}: {course.price_display}
        </p>
      )}
      <p className="text-sm text-muted mb-6">
        {t('dashboard.completePaymentThenConfirm')}
      </p>
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={confirming}
          className="px-6 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow disabled:opacity-50"
        >
          {confirming ? t('dashboard.confirming') : t('dashboard.iveCompletedPayment')}
        </button>
        <Link
          to={localizePath('/dashboard')}
          className="px-6 py-3 rounded-xl bg-surfaceElevated hover:bg-surface/80 text-foreground font-medium text-center"
        >
          {t('dashboard.backToDashboard')}
        </Link>
      </div>
    </div>
  );
};

export default PayCoursePage;
