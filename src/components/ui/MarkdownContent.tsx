import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** Collapse 3+ newlines to 2 so we don't get empty paragraphs; trim trailing spaces on lines */
function normalizeContent(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n');
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  const normalized = content?.trim() ? normalizeContent(content) : '';
  if (!normalized) return null;
  return (
    <div className={`markdown-prose ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalized}</ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
