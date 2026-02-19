import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { BookOpen, Check, Play, ChevronLeft, ChevronRight, CheckCircle, PlayCircle } from 'lucide-react';
import { authFetch, getApiUrl } from '../lib/api';
import { VideoEmbed } from '../components/VideoEmbed';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DescriptionContent } from '../components/ui/HtmlContent';

interface Course {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  is_paid?: boolean;
  price_display?: string | null;
}

interface LessonResource {
  id: number;
  title: string;
  url: string;
}

interface Lesson {
  id: number;
  course_id: number;
  title: string;
  description: string | null;
  position: number;
  video_type: 'youtube' | 'wistia';
  video_url: string;
  created_at: string;
  resources?: LessonResource[];
}

interface ProgressMap {
  [lessonId: number]: { completed: boolean; watch_time_seconds: number };
}

const CoursePage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { localizePath } = useLocale();
  const { t } = useTranslation();
  const openLessonId = (location.state as { openLessonId?: number } | null)?.openLessonId;
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [enrolling, setEnrolling] = useState(false);

  const id = courseId ? parseInt(courseId, 10) : NaN;
  const currentLesson = lessons.length > 0 && currentIndex >= 0 && currentIndex < lessons.length ? lessons[currentIndex] : null;
  const completedCount = lessons.filter((l) => progress[l.id]?.completed).length;
  const progressPercent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  useEffect(() => {
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const [courseRes, lessonsRes, progressRes, myRes] = await Promise.all([
          fetch(`${getApiUrl()}/api/courses/${id}`),
          fetch(`${getApiUrl()}/api/courses/${id}/lessons`),
          authFetch(`/api/courses/${id}/progress`),
          authFetch('/api/courses/my-courses'),
        ]);
        if (courseRes.ok) setCourse(await courseRes.json());
        if (lessonsRes.ok) {
          const d = await lessonsRes.json();
          setLessons(d.lessons || []);
        }
        if (progressRes.ok) {
          const d = await progressRes.json();
          setProgress(d.progress || {});
        }
        if (myRes.ok) {
          const d = await myRes.json();
          const enrolledIds = (d.courses || []).map((c: { id: number }) => c.id);
          setEnrolled(enrolledIds.includes(id));
        }
      } catch (_) {
        setCourse(null);
        setLessons([]);
        setProgress({});
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    if (lessons.length === 0) return;
    if (openLessonId != null) {
      const idx = lessons.findIndex((l) => l.id === openLessonId);
      if (idx >= 0) setCurrentIndex(idx);
      else setCurrentIndex(0);
    } else {
      const firstIncomplete = lessons.findIndex((l) => !progress[l.id]?.completed);
      setCurrentIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
  }, [lessons, openLessonId, progress]);

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await authFetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: id }),
      });
      if (res.ok) setEnrolled(true);
    } finally {
      setEnrolling(false);
    }
  };

  const handleMarkComplete = async (lesson: Lesson) => {
    await authFetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lesson_id: lesson.id, completed: true }),
    });
    setProgress((prev) => ({ ...prev, [lesson.id]: { ...prev[lesson.id], completed: true, watch_time_seconds: prev[lesson.id]?.watch_time_seconds ?? 0 } }));
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };
  const goNext = () => {
    if (currentIndex < lessons.length - 1) setCurrentIndex(currentIndex + 1);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen relative">
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
        <div className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col min-h-screen relative">
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
        <div className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8 flex flex-col items-center justify-center gap-4">
          <p className="text-muted">{t('course.courseNotFound')}</p>
          <button onClick={() => navigate(localizePath('/dashboard'))} className="px-4 py-2 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow">
            {t('course.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  if (!enrolled) {
    return (
      <div className="flex flex-col min-h-screen relative">
        <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
        <div className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => navigate(localizePath('/dashboard'))} className="text-muted hover:text-foreground text-sm mb-6 inline-flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> {t('course.backToDashboard')}
            </button>
            <div className="rounded-card border border-border bg-surface/80 overflow-hidden shadow-card">
              <div className="relative aspect-[21/9] bg-surfaceElevated">
                {course.image_url ? (
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${course.image_url})` }} />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <BookOpen className="w-20 h-20 text-muted opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground drop-shadow">{course.title}</h1>
                </div>
              </div>
              <div className="p-6 md:p-8">
                <div className="mb-6">{course.description ? <DescriptionContent content={course.description} /> : <span className="text-muted">—</span>}</div>
                {course.is_paid ? (
                  <Link
                    to={localizePath(`/dashboard/pay-course/${course.id}`)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow transition-colors"
                  >
                    {t('dashboard.payAndGetAccess')}
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-bold hover:bg-primary-glow disabled:opacity-50 transition-colors"
                  >
                    {enrolling ? t('course.enrolling') : t('course.enrollInThisCourse')}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" aria-hidden />
      <main className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
        <div className="max-w-[1440px] mx-auto space-y-6">
          {/* Breadcrumb + Prev/Next */}
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted flex-wrap">
              <Link to={localizePath('/dashboard/academy')} className="hover:text-primary transition-colors">{t('course.academy')}</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <Link to={localizePath('/dashboard/academy')} className="hover:text-primary transition-colors">{course.title}</Link>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-foreground">{currentLesson?.title ?? '—'}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-btn bg-white/5 border border-white/5 text-muted hover:text-foreground hover:bg-white/10 text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> {t('course.previous')}
              </button>
              <button
                onClick={goNext}
                disabled={currentIndex === lessons.length - 1}
                className="px-4 py-2 rounded-btn bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-2 transition-all shadow-glow-primary-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('course.nextLesson')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Left: video + lesson info + resources */}
            <div className="lg:col-span-2 space-y-6">
              {currentLesson ? (
                <>
                  {/* Video player */}
                  <div className="glass-panel rounded-card p-0 overflow-hidden relative aspect-video">
                    <VideoEmbed
                      videoType={currentLesson.video_type}
                      videoUrl={currentLesson.video_url}
                      title={currentLesson.title}
                      className="rounded-none"
                    />
                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
                      <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded text-xs font-medium border border-white/10">
                        {t('course.lesson')} {currentIndex + 1}
                      </span>
                      <div className="flex gap-2" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                      <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-xs font-medium text-gray-300 mt-2">
                        <span>{completedCount} / {lessons.length} lessons</span>
                      </div>
                    </div>
                  </div>

                  {/* Lesson title + meta + description */}
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">{currentLesson.title}</h2>
                    <div className="flex items-center gap-4 text-sm text-muted mb-4 flex-wrap">
                      <span className="flex items-center gap-1"><Play className="w-4 h-4 text-primary" /> {t('course.lesson')} {currentIndex + 1}</span>
                      <span className="flex items-center gap-1 text-accent">Intermediate</span>
                    </div>
                    <div className="text-muted leading-relaxed text-sm md:text-base">
                      {currentLesson.description ? <DescriptionContent content={currentLesson.description} /> : <span>{t('course.noDescription')}</span>}
                    </div>
                    {!(progress[currentLesson.id]?.completed) && (
                      <button
                        onClick={() => handleMarkComplete(currentLesson)}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-btn bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors"
                      >
                        <Check className="w-4 h-4" /> {t('course.markComplete')}
                      </button>
                    )}
                  </div>

                  <div className="border-t border-border pt-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">{t('course.lessonResources')}</h3>
                    {currentLesson.resources && currentLesson.resources.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {currentLesson.resources.map((r) => (
                          <a
                            key={r.id}
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass-panel p-4 rounded-xl flex items-center gap-4 hover:border-primary/30 transition-all group"
                          >
                            <span className="flex-1 min-w-0 text-sm font-medium text-foreground group-hover:text-primary truncate">{r.title}</span>
                            <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted">{t('course.noResources')}</p>
                    )}
                  </div>

                </>
              ) : (
                <div className="glass-panel rounded-card p-8 flex items-center justify-center aspect-video">
                  <p className="text-muted">{t('course.noLessons')}</p>
                </div>
              )}
            </div>

            {/* Right: sidebar - Course Content */}
            <div className="lg:col-span-1">
              <div className="glass-panel rounded-card flex flex-col lg:sticky lg:top-24 h-[calc(100vh-140px)] min-h-[320px]">
                <div className="p-5 border-b border-border bg-surface/50 shrink-0">
                  <h3 className="text-lg font-bold text-foreground mb-1">{t('course.courseContent')}</h3>
                  <div className="flex justify-between items-center text-xs text-muted">
                    <span>{lessons.length} Lessons</span>
                    <span className="text-primary font-mono">{progressPercent}% {t('course.complete')}</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-3">
                    <div className="bg-gradient-to-r from-accent to-primary h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 sidebar-scroll">
                  <div className="px-3 py-2">
                    <h4 className="text-xs font-bold text-muted uppercase tracking-wider">{t('course.lessons')}</h4>
                  </div>
                  {lessons.map((lesson, idx) => {
                    const completed = progress[lesson.id]?.completed ?? false;
                    const isActive = currentIndex === idx;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                          isActive ? 'bg-primary/10 border border-primary/20 shadow-glow-primary-sm' : 'hover:bg-white/5 border border-transparent'
                        } ${!isActive && !completed ? 'opacity-80' : ''}`}
                      >
                        <span className="min-w-6 flex justify-center shrink-0">
                          {completed ? (
                            <CheckCircle className="w-5 h-5 text-primary" />
                          ) : isActive ? (
                            <PlayCircle className="w-5 h-5 text-primary animate-pulse" />
                          ) : (
                            <PlayCircle className="w-5 h-5 text-muted" />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${completed && !isActive ? 'text-muted line-through decoration-muted' : 'text-foreground'}`}>
                            {lesson.title}
                          </p>
                          <span className={`text-[10px] ${isActive ? 'text-primary/80 font-mono' : 'text-muted'}`}>
                            {isActive ? t('course.nowPlaying') : `${t('course.lesson')} ${idx + 1}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoursePage;
