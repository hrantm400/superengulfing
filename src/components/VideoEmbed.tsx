import React from 'react';

export type VideoType = 'youtube' | 'wistia';

/**
 * Parse YouTube or Wistia URL to embed src.
 * YouTube: youtube.com/watch?v=ID, youtu.be/ID -> https://www.youtube.com/embed/ID
 * Wistia: fast.wistia.net/embed/iframe/ID, *.wistia.com/medias/ID -> https://fast.wistia.net/embed/iframe/ID
 */
export function getEmbedSrc(videoType: VideoType, videoUrl: string): string | null {
  if (!videoUrl || !videoType) return null;
  try {
    const url = new URL(videoUrl.trim());
    const host = url.hostname.toLowerCase();

    if (videoType === 'youtube') {
      if (host.includes('youtu.be')) {
        const id = url.pathname.slice(1).split('/')[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (host.includes('youtube.com')) {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }

    if (videoType === 'wistia') {
      if (host.includes('wistia.net') && url.pathname.includes('/embed/iframe/')) {
        const id = url.pathname.split('/embed/iframe/')[1]?.split('?')[0];
        return id ? `https://fast.wistia.net/embed/iframe/${id}` : null;
      }
      if (host.includes('wistia.com')) {
        const match = url.pathname.match(/\/medias\/([a-zA-Z0-9]+)/);
        const id = match ? match[1] : url.pathname.replace(/^\/+/, '').split('/').pop()?.split('?')[0];
        return id ? `https://fast.wistia.net/embed/iframe/${id}` : null;
      }
    }
  } catch (_) {
    return null;
  }
  return null;
}

interface VideoEmbedProps {
  videoType: VideoType;
  videoUrl: string;
  className?: string;
  title?: string;
}

export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  videoType,
  videoUrl,
  className = '',
  title = 'Video',
}) => {
  const src = getEmbedSrc(videoType, videoUrl);
  if (!src) {
    return (
      <div className={`bg-surface/80 border border-border rounded-xl flex items-center justify-center text-muted ${className}`}>
        Invalid video URL
      </div>
    );
  }
  return (
    <div className={`relative w-full rounded-xl overflow-hidden bg-black ${className}`} style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={src}
        title={title}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
};
