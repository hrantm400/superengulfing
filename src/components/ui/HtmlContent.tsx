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
  'strong', 'em', 'b', 'i', 'a', 'blockquote', 'code', 'pre', 'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

export function HtmlContent({ content, className = '' }: HtmlContentProps) {
  if (!content?.trim()) return null;
  const sanitized = DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
  if (!sanitized.trim()) return null;
  return (
    <div
      className={`markdown-prose ${className}`.trim()}
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
