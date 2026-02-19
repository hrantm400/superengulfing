import React, { useState, useEffect, useMemo } from 'react';
import { Link } from '@remix-run/react';
import { BookOpen, ChevronRight, Search, Play } from 'lucide-react';
import { authFetch, getApiUrl } from '../../lib/api';
import { useLocale } from '../../contexts/LocaleContext';
import { useTranslation } from '../../locales';
import LoadingSpinner from '../ui/LoadingSpinner';
import { DescriptionContent } from '../ui/HtmlContent';

export interface MyCourse {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  enrolled_at: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percent: number;
}

export interface CatalogCourse {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  lesson_count: string;
  is_paid?: boolean;
  price_display?: string | null;
}

type FilterTab = 'all' | 'in_progress' | 'completed' | 'available';

function CircularProgress({ percent, size = 48, strokeWidth = 4 }: { percent: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-surfaceElevated" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-primary transition-all duration-500"
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{percent}%</span>
    </div>
  );
}

interface CoursesSectionProps {
  /** Compact layout when rendered inside the dashboard card */
  embedded?: boolean;
}

export const CoursesSection: React.FC<CoursesSectionProps> = ({ embedded = false }) => {
  const { localizePath, locale } = useLocale();
  const { t } = useTranslation();
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [resume, setResume] = useState<{ course_id: number; next_lesson_id: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [myRes, catalogRes, resumeRes] = await Promise.all([
          authFetch('/api/courses/my-courses'),
          fetch(`${getApiUrl()}/api/courses?locale=${locale}`),
          authFetch('/api/courses/resume'),
        ]);
        if (myRes.ok) {
          const data = await myRes.json();
          setMyCourses(data.courses || []);
        }
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          setCatalog(data.courses || []);
        }
        if (resumeRes.ok) {
          const data = await resumeRes.json();
          if (data.resume) setResume({ course_id: data.resume.course_id, next_lesson_id: data.resume.next_lesson_id ?? null });
          else setResume(null);
        }
      } catch (_) {
        setMyCourses([]);
        setCatalog([]);
        setResume(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locale]);

  const enrolledIds = new Set(myCourses.map((c) => c.id));
  const availableCourses = catalog.filter((c) => !enrolledIds.has(c.id));

  const searchLower = search.trim().toLowerCase();
  const filteredMy = useMemo(() => {
    let list = myCourses;
    if (filter === 'in_progress') list = list.filter((c) => c.progress_percent > 0 && c.progress_percent < 100);
    else if (filter === 'completed') list = list.filter((c) => c.progress_percent >= 100);
    else if (filter === 'available') return [];
    if (searchLower) list = list.filter((c) => c.title.toLowerCase().includes(searchLower));
    return list;
  }, [myCourses, filter, searchLower]);

  const filteredAvailable = useMemo(() => {
    if (filter !== 'all' && filter !== 'available') return [];
    let list = availableCourses;
    if (searchLower) list = list.filter((c) => c.title.toLowerCase().includes(searchLower));
    return list;
  }, [availableCourses, filter, searchLower]);

  const handleEnroll = async (courseId: number) => {
    setEnrollingId(courseId);
    try {
      const res = await authFetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (res.ok) {
        const myRes = await authFetch('/api/courses/my-courses');
        if (myRes.ok) {
          const data = await myRes.json();
          setMyCourses(data.courses || []);
        }
        const resumeRes = await authFetch('/api/courses/resume');
        if (resumeRes.ok) {
          const data = await resumeRes.json();
          if (data.resume) setResume({ course_id: data.resume.course_id, next_lesson_id: data.resume.next_lesson_id ?? null });
          else setResume(null);
        }
      }
    } finally {
      setEnrollingId(null);
    }
  };

  const getStatusBadge = (course: MyCourse) => {
    if (course.progress_percent >= 100) return { label: t('dashboard.completed'), className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    if (course.progress_percent > 0) return { label: t('dashboard.inProgress'), className: 'bg-primary/20 text-primary border-primary/40' };
    return { label: t('dashboard.notStarted'), className: 'bg-muted/20 text-muted border-border' };
  };

  const space = embedded ? 'space-y-4' : 'space-y-6';
  const titleSize = embedded ? 'text-lg' : 'text-2xl';
  const subTitleClass = embedded ? 'text-xs' : 'text-sm';
  const gridCols = embedded ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
  const gap = embedded ? 'gap-4' : 'gap-6';
  const cardRound = embedded ? 'rounded-xl' : 'rounded-card';
  const cardPadding = embedded ? 'p-3' : 'p-4';
  const thumbAspect = embedded ? 'aspect-video' : 'aspect-[4/3]';

  if (loading) {
    return (
      <div className={`${space} animate-fade-in-up opacity-0 [animation-fill-mode:forwards] flex flex-col items-center justify-center min-h-[200px]`} style={{ animationDelay: '0.15s' }}>
        <LoadingSpinner />
      </div>
    );
  }

  // Embedded: only course grid, no search/filters/available
  if (embedded) {
    return (
      <div className={`${space} animate-fade-in-up opacity-0 [animation-fill-mode:forwards] min-h-0 flex flex-col`} style={{ animationDelay: '0.15s' }}>
        <div className="shrink-0 mb-1">
          <h2 className={`${titleSize} font-bold text-foreground`}>{t('dashboard.courses')}</h2>
        </div>
        <div className="min-h-0 overflow-auto flex-1">
          {myCourses.length === 0 ? (
            <div className={`${cardRound} border border-border bg-surface/60 p-6 text-center`}>
              <BookOpen className="w-10 h-10 text-muted mx-auto mb-3 opacity-60" />
              <p className="text-sm font-medium text-foreground mb-1">{t('dashboard.noCoursesYet')}</p>
              <p className="text-xs text-muted">{t('dashboard.openFullScreen')}</p>
            </div>
          ) : (
            <div className={`grid ${gridCols} ${gap}`}>
              {myCourses.map((course) => {
                const badge = getStatusBadge(course);
                const nextLessonId = resume?.course_id === course.id ? resume?.next_lesson_id : undefined;
                return (
                  <Link
                    key={course.id}
                    to={localizePath(`/dashboard/courses/${course.id}`)}
                    state={nextLessonId != null ? { openLessonId: nextLessonId } : undefined}
                    className={`group ${cardRound} border border-border bg-surface/80 overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 flex flex-col`}
                  >
                    <div className={`relative ${thumbAspect} bg-surfaceElevated overflow-hidden`}>
                      {course.image_url ? (
                        <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url(${course.image_url})` }} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen className="w-10 h-10 text-muted opacity-50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${badge.className}`}>
                          {badge.label}
                        </span>
                        <h3 className="text-white mt-1 line-clamp-2 drop-shadow text-sm font-semibold">{course.title}</h3>
                        <p className="text-white/80 text-xs mt-0.5">{course.completed_lessons} / {course.total_lessons} {t('dashboard.lessons')}</p>
                      </div>
                    </div>
                    <div className={`${cardPadding} flex items-center justify-between gap-2 border-t border-border`}>
                      <CircularProgress percent={course.progress_percent} size={36} strokeWidth={3} />
                      <span className="flex-1 min-w-0 text-muted truncate text-xs">{course.progress_percent}%</span>
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-black font-bold group-hover:bg-primary-glow transition-colors px-2 py-1.5 text-xs">
                        {course.progress_percent > 0 ? <><Play className="w-3 h-3" /> {t('dashboard.continue')}</> : <>{t('dashboard.start')}</>}
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${space} animate-fade-in-up opacity-0 [animation-fill-mode:forwards] min-h-0 flex flex-col`} style={{ animationDelay: '0.15s' }}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className={`${titleSize} font-bold text-foreground mb-0.5`}>{t('dashboard.courses')}</h2>
          <p className={`${subTitleClass} text-muted`}>{t('dashboard.yourCoursesAndProgress')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="text"
              placeholder={t('dashboard.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg bg-surface border border-border text-foreground placeholder:text-muted text-sm w-48 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex rounded-lg bg-surfaceElevated/80 border border-border p-0.5">
            {(['all', 'in_progress', 'completed', 'available'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-md font-medium transition-colors px-3 py-1.5 text-sm ${
                  filter === tab ? 'bg-primary text-black' : 'text-muted hover:text-foreground'
                }`}
              >
                {tab === 'all' ? t('dashboard.all') : tab === 'in_progress' ? t('dashboard.inProgress') : tab === 'completed' ? t('dashboard.done') : t('dashboard.available')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* My courses cards */}
      {(filter === 'all' || filter === 'in_progress' || filter === 'completed') && (
        <div>
          {filteredMy.length === 0 ? (
            <div className={`${cardRound} border border-border bg-surface/60 ${embedded ? 'p-6' : 'p-10'} text-center`}>
              <BookOpen className={`text-muted mx-auto mb-3 opacity-60 ${embedded ? 'w-10 h-10' : 'w-12 h-12'}`} />
              <p className={`font-medium mb-1 ${embedded ? 'text-sm' : 'text-foreground'}`}>
                {filter === 'all' ? t('dashboard.noCoursesYet') : filter === 'in_progress' ? t('dashboard.noCoursesInProgress') : t('dashboard.noCompletedCourses')}
              </p>
              <p className={`text-muted ${embedded ? 'text-xs' : 'text-sm'}`}>
                {filter === 'all' && myCourses.length === 0
                  ? t('dashboard.enrollFromAvailable')
                  : t('dashboard.switchFilterOrEnroll')}
              </p>
            </div>
          ) : (
            <div className={`grid ${gridCols} ${gap}`}>
              {filteredMy.map((course) => {
                const badge = getStatusBadge(course);
                const nextLessonId = resume?.course_id === course.id ? resume?.next_lesson_id : undefined;
                return (
                  <Link
                    key={course.id}
                    to={localizePath(`/dashboard/courses/${course.id}`)}
                    state={nextLessonId != null ? { openLessonId: nextLessonId } : undefined}
                    className={`group ${cardRound} border border-border bg-surface/80 overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 flex flex-col`}
                  >
                    <div className={`relative ${thumbAspect} bg-surfaceElevated overflow-hidden`}>
                      {course.image_url ? (
                        <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url(${course.image_url})` }} />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BookOpen className={`text-muted opacity-50 ${embedded ? 'w-10 h-10' : 'w-16 h-16'}`} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className={`absolute bottom-0 left-0 right-0 ${embedded ? 'p-2' : 'p-4'}`}>
                        <span className={`inline-block px-2 py-0.5 rounded ${embedded ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider border ${badge.className}`}>
                          {badge.label}
                        </span>
                        <h3 className={`text-white mt-1 line-clamp-2 drop-shadow ${embedded ? 'text-sm font-semibold' : 'text-lg font-bold'}`}>{course.title}</h3>
                        <p className="text-white/80 text-xs mt-0.5">{course.completed_lessons} / {course.total_lessons} {t('dashboard.lessons')}</p>
                      </div>
                    </div>
                    <div className={`${cardPadding} flex items-center justify-between gap-2 border-t border-border`}>
                      <CircularProgress percent={course.progress_percent} size={embedded ? 36 : 44} strokeWidth={3} />
                      <span className={`flex-1 min-w-0 text-muted truncate ${embedded ? 'text-xs' : 'text-sm'}`}>{course.progress_percent}%</span>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-lg bg-primary text-black font-bold group-hover:bg-primary-glow transition-colors ${embedded ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
                        {course.progress_percent > 0 ? <><Play className="w-3 h-3" /> {t('dashboard.continue')}</> : <>{t('dashboard.start')}</>}
                        <ChevronRight className={embedded ? 'w-3 h-3' : 'w-4 h-4'} />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Available courses */}
      {(filter === 'all' || filter === 'available') && (
        <div className={embedded ? 'mt-2 pt-3 border-t border-border' : ''}>
          <h3 className={`font-bold text-foreground mb-3 ${embedded ? 'text-sm' : 'text-lg'}`}>{t('dashboard.availableCourses')}</h3>
          {filteredAvailable.length === 0 ? (
            <div className={`${cardRound} border border-border bg-surface/60 ${embedded ? 'p-4' : 'p-8'} text-center text-muted text-sm`}>
              {availableCourses.length === 0 ? t('dashboard.noOtherCourses') : t('dashboard.noMatch')}
            </div>
          ) : (
            <div className={`grid ${gridCols} ${gap}`}>
              {filteredAvailable.map((course) => (
                <div
                  key={course.id}
                  className={`group ${cardRound} border border-border bg-surface/80 overflow-hidden shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 flex flex-col`}
                >
                  <div className={`relative ${thumbAspect} bg-surfaceElevated overflow-hidden`}>
                    {course.image_url ? (
                      <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" style={{ backgroundImage: `url(${course.image_url})` }} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className={`text-muted opacity-50 ${embedded ? 'w-10 h-10' : 'w-16 h-16'}`} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className={`absolute bottom-0 left-0 right-0 ${embedded ? 'p-2' : 'p-4'}`}>
                      <span className={`inline-block px-2 py-0.5 rounded ${embedded ? 'text-[9px]' : 'text-[10px]'} font-bold uppercase tracking-wider bg-muted/30 text-muted border border-border`}>
                        {course.is_paid ? t('dashboard.paid') : t('dashboard.available')}
                      </span>
                      <h3 className={`text-white mt-1 line-clamp-2 drop-shadow ${embedded ? 'text-sm font-semibold' : 'text-lg font-bold'}`}>{course.title}</h3>
                      <p className="text-white/80 text-xs mt-0.5">{course.lesson_count || 0} {t('dashboard.lessons')}{course.is_paid && course.price_display ? ` · ${course.price_display}` : ''}</p>
                    </div>
                  </div>
                  <div className={`${cardPadding} border-t border-border`}>
                    {!embedded && <div className="text-sm text-muted line-clamp-2 mb-3 min-h-[2.5rem]">{course.description ? <DescriptionContent content={course.description} /> : '—'}</div>}
                    {course.is_paid ? (
                      <Link
                        to={localizePath(`/dashboard/pay-course/${course.id}`)}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow transition-colors ${embedded ? 'py-2 text-xs' : 'px-4 py-3 text-sm'}`}
                      >
                        {t('dashboard.payAndGetAccess')}
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={enrollingId === course.id}
                        className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow transition-colors disabled:opacity-50 ${embedded ? 'py-2 text-xs' : 'px-4 py-3 text-sm'}`}
                      >
                        {enrollingId === course.id ? t('dashboard.enrolling') : t('dashboard.enroll')}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
