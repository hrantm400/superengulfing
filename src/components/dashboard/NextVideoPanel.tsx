import React, { useEffect, useState } from 'react';
import { Link } from '@remix-run/react';
import { PlayCircle, ChevronRight } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { VideoEmbed } from '../VideoEmbed';
import type { VideoType } from '../VideoEmbed';

interface ResumeData {
  course_id: number;
  course_title: string;
  next_lesson_id: number | null;
  next_lesson_title: string | null;
  next_lesson_video_url: string | null;
  next_lesson_video_type: string | null;
  progress_percent: number;
  completed_lessons: number;
  total_lessons: number;
}

export const NextVideoPanel: React.FC = () => {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/courses/resume')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.resume) setResume(data.resume);
        else setResume(null);
      })
      .catch(() => setResume(null))
      .finally(() => setLoading(false));
  }, []);

  const hasVideo = resume?.next_lesson_id && resume?.next_lesson_video_url && resume?.next_lesson_video_type;

  if (loading) {
    return (
      <div className="w-full lg:w-64 xl:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col items-center justify-center p-5 bg-gradient-to-b from-surfaceElevated/80 to-surface/60 min-h-[200px]">
        <div className="w-10 h-10 rounded-lg bg-surfaceElevated animate-pulse mb-3" />
        <div className="h-3 w-20 bg-surfaceElevated rounded animate-pulse" />
      </div>
    );
  }

  if (!hasVideo) {
    return (
      <div className="w-full lg:w-64 xl:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col items-center justify-center p-5 bg-gradient-to-b from-surfaceElevated/80 to-surface/60">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
          <PlayCircle className="w-6 h-6 text-primary" />
        </div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Next video</p>
        <p className="text-muted text-xs text-center leading-snug">Start a course to see the next lesson here</p>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-64 xl:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-border flex flex-col bg-gradient-to-b from-surfaceElevated/80 to-surface/60 self-start">
      <div className="p-3 border-b border-border shrink-0">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Next video</p>
        <p className="text-foreground text-sm font-semibold line-clamp-2 leading-tight">{resume!.next_lesson_title}</p>
        <p className="text-muted text-xs mt-0.5 line-clamp-1">{resume!.course_title}</p>
      </div>
      <div className="p-3 flex flex-col shrink-0">
        <div className="rounded-lg overflow-hidden bg-black aspect-video w-full max-w-full">
          <VideoEmbed
            videoType={(resume!.next_lesson_video_type as VideoType) || 'youtube'}
            videoUrl={resume!.next_lesson_video_url!}
            title={resume!.next_lesson_title || 'Lesson'}
            className="rounded-lg"
          />
        </div>
        <Link
          to={`/dashboard/courses/${resume!.course_id}`}
          state={{ openLessonId: resume!.next_lesson_id }}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary-glow transition-colors shrink-0"
        >
          <PlayCircle className="w-4 h-4" />
          Continue
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
