import React, { useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import MarkdownContent from './MarkdownContent';
import { X } from 'lucide-react';

/** Heuristic: content looks like HTML (e.g. from TipTap / paste from Google Docs). */
export function isLikelyHtml(content: string | null): boolean {
  if (!content?.trim()) return false;
  const t = content.trim();
  return t.startsWith('<') && t.includes('>');
}

interface HtmlContentProps {
  content: string;
  className?: string;
}

const ALLOWED_TAGS = [
  'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
  'strong', 'em', 'b', 'i', 'a', 'blockquote', 'code', 'pre', 'span', 'img',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt'];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i;
const UPLOADS_PATH = /\/uploads\//i;

function isImageUrl(href: string): boolean {
  try {
    const url = href.trim();
    if (!url) return false;
    return IMAGE_EXT.test(url) || UPLOADS_PATH.test(url);
  } catch {
    return false;
  }
}

export function HtmlContent({ content, className = '' }: HtmlContentProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target;
    if (target instanceof HTMLImageElement && target.src) {
      e.preventDefault();
      setLightboxSrc(target.src);
    }
  }, []);

  if (!content?.trim()) return null;
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    HOOKS: {
      afterSanitizeAttributes(node) {
        if (node.tagName === 'A' && node.getAttribute('href')) {
          const href = node.getAttribute('href') || '';
          if (isImageUrl(href)) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
          }
        }
      },
    },
  });
  if (!sanitized.trim()) return null;
  return (
    <>
      <div
        role="presentation"
        className={`markdown-prose prose-img:max-w-full prose-img:rounded-lg prose-img:cursor-zoom-in ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: sanitized }}
        onClick={handleContentClick}
      />
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxSrc(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setLightboxSrc(null)}
          aria-label="Close"
        >
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightboxSrc(null)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

/** Renders description: HTML (sanitized) or Markdown depending on content. */
export function DescriptionContent({
  content,
  className = '',
}: {
  content: string | null;
  className?: string;
}) {
  if (!content?.trim()) return null;
  if (isLikelyHtml(content)) return <HtmlContent content={content} className={className} />;
  return <MarkdownContent content={content} className={className} />;
}

export default HtmlContent;
