import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from '@remix-run/react';
import { useLocale } from '../contexts/LocaleContext';
import { useTranslation } from '../locales';
import { Search, Play, Filter, BookOpen, ChevronRight, Timer, Flame } from 'lucide-react';
import { authFetch, getApiUrl } from '../lib/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

interface MyCourse {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  enrolled_at: string;
  total_lessons: number;
  completed_lessons: number;
  progress_percent: number;
}

interface CatalogCourse {
  id: number;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  lesson_count: string;
}

type FilterPill = 'all' | 'in_progress' | 'completed' | 'available';

const AcademyPage: React.FC = () => {
  const navigate = useNavigate();
  const { localizePath, locale } = useLocale();
  const { t } = useTranslation();
  const [myCourses, setMyCourses] = useState<MyCourse[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterPill>('all');
  const [enrollingId, setEnrollingId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [myRes, catalogRes] = await Promise.all([
          authFetch('/api/courses/my-courses'),
          fetch(`${getApiUrl()}/api/courses?locale=${locale}`),
        ]);
        if (myRes.ok) {
          const data = await myRes.json();
          setMyCourses(data.courses || []);
        }
        if (catalogRes.ok) {
          const data = await catalogRes.json();
          setCatalog(data.courses || []);
        }
      } catch (_) {
        setMyCourses([]);
        setCatalog([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [locale]);

  const enrolledIds = new Set(myCourses.map((c) => c.id));
  const availableCourses = catalog.filter((c) => !enrolledIds.has(c.id));
  const searchLower = search.trim().toLowerCase();

  const filteredEnrolled = useMemo(() => {
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

  const handleEnrollAndGo = async (courseId: number) => {
    setEnrollingId(courseId);
    try {
      const res = await authFetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId }),
      });
      if (res.ok) navigate(localizePath(`/dashboard/courses/${courseId}`));
    } finally {
      setEnrollingId(null);
    }
  };

  const overallProgress = myCourses.length
    ? Math.round(myCourses.reduce((a, c) => a + c.progress_percent, 0) / myCourses.length)
    : 0;

  const totalLessons = myCourses.reduce((a, c) => a + c.total_lessons, 0);
  const completedLessons = myCourses.reduce((a, c) => a + c.completed_lessons, 0);

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" aria-hidden />
      <main className="flex-1 relative z-10 pt-20 md:pt-24 px-4 md:px-6 lg:px-8 pb-4 md:pb-6 lg:pb-8">
        <div className="max-w-[1440px] mx-auto space-y-8">
          {/* Header: back link + search + filter */}
          <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
            <div>
              <Link to={localizePath('/dashboard')} className="text-muted hover:text-foreground text-sm mb-2 inline-block">
                ← {t('nav.dashboard')}
              </Link>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-hover:text-tech-blue transition-colors" />
                <input
                  type="text"
                  placeholder={t('academy.searchModules')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-surface/60 border border-border rounded-btn py-2.5 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:border-tech-blue/50 focus:ring-1 focus:ring-tech-blue/50 w-full md:w-64 transition-all placeholder:text-muted"
                />
              </div>
              <button
                type="button"
                className="p-2.5 rounded-btn bg-surface/60 border border-border hover:border-tech-blue/50 text-muted hover:text-foreground transition-all"
                aria-label="Filter"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: filter pills + course cards */}
            <div className="lg:col-span-8 space-y-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {(['all', 'in_progress', 'completed', 'available'] as const).map((pill) => (
                  <button
                    key={pill}
                    type="button"
                    onClick={() => setFilter(pill)}
                    className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${filter === pill
                        ? 'bg-tech-blue/10 border border-tech-blue/30 text-tech-blue shadow-glow-primary-sm'
                        : 'bg-white/5 border border-border text-muted hover:text-foreground hover:bg-white/10'
                      }`}
                  >
                    {pill === 'all' ? t('academy.allCourses') : pill === 'in_progress' ? t('academy.inProgress') : pill === 'completed' ? t('academy.completed') : t('academy.available')}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="glass-panel rounded-card p-8 flex items-center justify-center min-h-[200px]">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Enrolled courses */}
                  {filteredEnrolled.map((course) => (
                    <Link
                      key={course.id}
                      to={`/dashboard/courses/${course.id}`}
                      className="glass-card-tech rounded-card p-6 flex flex-col md:flex-row gap-6 group relative overflow-hidden block"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-tech-blue to-transparent opacity-50" />
                      <div className="w-full md:w-64 h-40 md:h-auto min-h-[160px] rounded-xl overflow-hidden relative flex-shrink-0 border border-border">
                        {course.image_url ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                            style={{ backgroundImage: `url(${course.image_url})` }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-surfaceElevated flex items-center justify-center">
                            <BookOpen className="w-12 h-12 text-muted" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                          {course.progress_percent >= 100 ? t('academy.completed') : t('academy.inProgress')}
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="size-12 rounded-full bg-tech-blue/90 flex items-center justify-center text-black shadow-glow-primary-sm">
                            <Play className="w-6 h-6 ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <h3 className="text-xl font-bold text-foreground group-hover:text-tech-blue transition-colors">{course.title}</h3>
                            <span className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-xs font-bold shrink-0">
                              {course.progress_percent >= 100 ? t('academy.done') : t('academy.level1')}
                            </span>
                          </div>
                          <p className="text-muted text-sm line-clamp-2 mb-4">{course.description || 'No description.'}</p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-6 text-xs text-muted font-mono">
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3.5 h-3.5" /> {course.completed_lessons}/{course.total_lessons} Lessons
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted">{course.progress_percent}% Complete</span>
                              <span className="text-tech-blue font-bold">Continue</span>
                            </div>
                            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-tech-blue to-primary h-full rounded-full transition-all shadow-glow-primary-sm"
                                style={{ width: `${course.progress_percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}

                  {/* Available courses */}
                  {filteredAvailable.map((course) => (
                    <div
                      key={course.id}
                      className="glass-card-tech rounded-card p-6 flex flex-col md:flex-row gap-6 group relative"
                    >
                      <div className="w-full md:w-64 h-40 md:h-auto min-h-[160px] rounded-xl overflow-hidden relative flex-shrink-0 border border-border">
                        {course.image_url ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                            style={{ backgroundImage: `url(${course.image_url})` }}
                          />
                        ) : (
                          <div className="absolute inset-0 bg-surfaceElevated flex items-center justify-center">
                            <BookOpen className="w-12 h-12 text-muted" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                        <div className="absolute top-2 left-2 bg-tech-blue/20 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold text-tech-blue uppercase tracking-wider border border-tech-blue/30">
                          New
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <h3 className="text-xl font-bold text-foreground group-hover:text-tech-blue transition-colors">{course.title}</h3>
                            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded text-xs font-bold shrink-0">
                              Level 1
                            </span>
                          </div>
                          <p className="text-muted text-sm line-clamp-2 mb-4">{course.description || 'No description.'}</p>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                          <div className="flex items-center gap-6 text-xs text-muted font-mono">
                            <span>{course.lesson_count || 0} Lessons</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEnrollAndGo(course.id)}
                            disabled={enrollingId === course.id}
                            className="px-6 py-2 rounded-btn bg-white/5 hover:bg-tech-blue/10 border border-border hover:border-tech-blue/50 text-foreground font-medium text-sm transition-all flex items-center gap-2 w-fit disabled:opacity-50"
                          >
                            {enrollingId === course.id ? t('dashboard.enrolling') : t('academy.enroll')}
                            <ChevronRight className="w-4 h-4 text-tech-blue" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredEnrolled.length === 0 && filteredAvailable.length === 0 && (
                    <div className="glass-panel rounded-card p-10 text-center text-muted">
                      <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>{t('academy.noCoursesMatch')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right sidebar: Learning Stats + Certificates + CTA */}
            <div className="lg:col-span-4 space-y-6">
              <div className="glass-panel rounded-card p-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 size-32 bg-tech-blue/20 rounded-full blur-3xl" aria-hidden />
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-foreground">Your Learning Stats</h3>
                </div>
                <div className="flex items-center gap-6 mb-8">
                  <div className="relative size-24 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full border-4 border-white/5" />
                    <div
                      className="absolute inset-0 rounded-full progress-circle flex items-center justify-center"
                      style={{ ['--progress' as string]: `${overallProgress}%` }}
                    >
                      <div className="bg-surface size-20 rounded-full flex flex-col items-center justify-center relative z-10">
                        <span className="text-xl font-bold text-foreground">{overallProgress}%</span>
                        <span className="text-[9px] text-muted uppercase tracking-wide">Overall</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <p className="text-xs text-muted mb-1">Lessons</p>
                      <p className="text-sm font-bold text-foreground">
                        {completedLessons} / {totalLessons} completed
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 border border-border hover:border-tech-blue/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Timer className="w-4 h-4 text-tech-blue" />
                      <span className="text-xs text-muted">Courses</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{myCourses.length}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-border hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="w-4 h-4 text-primary" />
                      <span className="text-xs text-muted">Completed</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {myCourses.filter((c) => c.progress_percent >= 100).length}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AcademyPage;
