import React from 'react';
import DOMPurify from 'dompurify';
import MarkdownContent from './MarkdownContent';

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
    <div
      className={`markdown-prose prose-img:max-w-full prose-img:rounded-lg ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
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
