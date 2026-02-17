import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/** Collapse 3+ newlines to 2 so we don't get empty paragraphs; trim lines */
function normalizeContent(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n');
}

const proseClasses =
  'markdown-prose text-muted leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ' +
  '[&_p]:mb-1.5 [&_p:last-child]:mb-0 ' +
  '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_li]:leading-snug ' +
  '[&_strong]:font-semibold [&_strong]:text-foreground ' +
  '[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_h1,_h2,_h3]:font-bold [&_h1,_h2,_h3]:text-foreground [&_h1,_h2,_h3]:mt-3 [&_h1,_h2,_h3]:mb-1 ' +
  '[&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-90 [&_a]:break-words ' +
  '[&_code]:bg-white/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_pre]:bg-white/5 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-2 [&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote]:text-muted';

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  const normalized = content?.trim() ? normalizeContent(content) : '';
  if (!normalized) return null;
  return (
    <div className={`markdown-prose ${proseClasses} ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{normalized}</ReactMarkdown>
    </div>
  );
};

export default MarkdownContent;
