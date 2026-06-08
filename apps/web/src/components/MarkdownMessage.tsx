'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import CodeBlock from './CodeBlock';

/**
 * Detects the dominant script direction for a message.
 *
 * Strategy: count WORD-level runs (not individual characters) so that a
 * long English term like "SpringBoot" (1 Latin word) doesn't outweigh a
 * short Arabic word like "بيانات" (1 Arabic word). Code blocks and inline
 * code are stripped first because their identifiers aren't representative
 * of the human language used in the message.
 */
function detectDir(text: string): 'rtl' | 'ltr' {
  const prose = text
    .replace(/```[\s\S]*?```/g, '') // strip fenced code blocks
    .replace(/`[^`\n]*`/g, '');     // strip inline code

  const arabicWords = (prose.match(/[؀-ۿݐ-ݿࢠ-ࣿ]+/g) || []).length;
  const latinWords  = (prose.match(/[A-Za-z]+/g) || []).length;

  return arabicWords >= latinWords ? 'rtl' : 'ltr';
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0 text-start">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-3.5 mb-1.5 first:mt-0 text-start">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-3 mb-1 first:mt-0 text-start">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-2.5 mb-1 first:mt-0 text-start">{children}</h4>,
  p: ({ children }) => <p className="text-[15px] my-1.5 leading-relaxed first:mt-0 last:mb-0 text-start">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-blue-700 dark:text-blue-400">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
  // ps-5 = padding-inline-start gives the outside markers room so they stay
  // attached to the text (margin would detach them to the container edge).
  ul: ({ children }) => <ul className="list-disc ps-6 pe-2 my-1.5 space-y-1 marker:text-gray-400 dark:marker:text-gray-500">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ps-6 pe-2 my-1.5 space-y-1 marker:text-gray-400 dark:marker:text-gray-500">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pe-1"><div dir="auto">{children}</div></li>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 break-words">{children}</a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-s-4 border-gray-300 dark:border-slate-600 ps-3 my-2 italic text-gray-600 dark:text-gray-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-slate-600" />,
  code: ({ className, children }) => {
    const text = String(children ?? '').replace(/\n$/, '');
    const language = (className ?? '').replace('language-', '');
    const isInline = !className && !text.includes('\n');
    if (isInline) {
      return <code dir="ltr" className="bg-gray-100 dark:bg-slate-700 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[0.8em] font-mono">{children}</code>;
    }
    return <CodeBlock language={language}>{text}</CodeBlock>;
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => <th dir="auto" className="border border-blue-200 dark:border-slate-600 bg-blue-50 dark:bg-slate-700 px-3 py-2 text-start font-semibold text-blue-800 dark:text-blue-300">{children}</th>,
  td: ({ children }) => <td dir="auto" className="border border-gray-200 dark:border-slate-600 px-3 py-2 text-start">{children}</td>,
};

export default function MarkdownMessage({ content }: { content: string }) {
  const dir = detectDir(content);
  return (
    <div dir={dir} className="text-[15px] sm:text-base text-gray-800 dark:text-gray-200 text-start leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
