'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { Globe, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import CodeBlock from './CodeBlock';

interface SourceItem {
  id: number;
  title: string;
  url: string;
  domain: string;
}

/**
 * Detects the dominant script direction for a message.
 */
function detectDir(text: string): 'rtl' | 'ltr' {
  const prose = text
    .replace(/```[\s\S]*?```/g, '') // strip fenced code blocks
    .replace(/`[^`\n]*`/g, '');     // strip inline code

  const arabicWords = (prose.match(/[؀-ۿݐ-ݿࢠ-ࣿ]+/g) || []).length;
  const latinWords  = (prose.match(/[A-Za-z]+/g) || []).length;

  return arabicWords >= latinWords ? 'rtl' : 'ltr';
}

/**
 * Normalizes a URL for duplicate checking.
 */
function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '');
    const search = parsed.search || '';
    return `${host}${path}${search}`;
  } catch {
    return urlStr.toLowerCase().trim().replace(/\/+$/, '');
  }
}

/**
 * Extracts the sources block from markdown text and returns clean body + parsed sources array.
 */
function parseContentAndSources(text: string): { bodyText: string; sources: SourceItem[] } {
  if (!text) return { bodyText: '', sources: [] };

  // Match headers like "### 🌐 المصادر والمراجع" or "### المصادر" or "### Sources"
  const sourcesSectionRegex = /(?:###?\s*(?:🌐\s*)?(?:المصادر والمراجع|المصادر|Sources & References|Sources|References)[:\s]*)([\s\S]*)$/i;

  let match = text.match(sourcesSectionRegex);
  let bodyText = text;
  let sourcesBlock = '';

  if (match) {
    bodyText = text.slice(0, match.index).trim();
    sourcesBlock = match[1];
  } else {
    // Check if text ends with a list of markdown links at the bottom
    const trailingLinksRegex = /(?:\n\s*[-*•\d\.]+\s*\[[^\]]+\]\(https?:\/\/[^\s\)]+\)\s*)+$/i;
    const trailingMatch = text.match(trailingLinksRegex);
    if (trailingMatch) {
      bodyText = text.slice(0, trailingMatch.index).trim();
      sourcesBlock = trailingMatch[0];
    } else {
      return { bodyText: text, sources: [] };
    }
  }

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
  const sources: SourceItem[] = [];
  const idMap: Record<number, number> = {}; // maps originalID -> newID
  let linkMatch: RegExpExecArray | null;
  let originalID = 1;
  let newID = 1;

  while ((linkMatch = linkRegex.exec(sourcesBlock)) !== null) {
    const rawTitle = linkMatch[1].trim();
    const url = linkMatch[2].trim();
    let domain = '';
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      domain = 'web';
    }

    const title = rawTitle.replace(/^\d+[\.\)]\s*/, '');
    const normUrl = normalizeUrl(url);

    // Check if we already have a source with this normalized URL
    const existing = sources.find((s) => normalizeUrl(s.url) === normUrl);

    if (existing) {
      idMap[originalID] = existing.id;
    } else {
      const id = newID++;
      sources.push({ id, title: title || domain, url, domain });
      idMap[originalID] = id;
    }
    originalID++;
  }

  // Link any inline unlinked citation numbers like [1], [2], or lists like [1, 2, 3] in bodyText to their actual source URLs
  let linkedBodyText = bodyText;
  if (sources.length > 0) {
    linkedBodyText = linkedBodyText.replace(/\[([\d\s,]+)\](?!\()/g, (match, content) => {
      const parts = content.split(',');
      const links: string[] = [];
      const addedIds = new Set<number>();
      let allValid = true;

      for (const part of parts) {
        const trimmed = part.trim();
        const origNum = parseInt(trimmed, 10);
        if (isNaN(origNum)) {
          allValid = false;
          break;
        }

        // Map original ID to new ID
        const mappedId = idMap[origNum] || origNum;
        const src = sources.find((s) => s.id === mappedId);

        if (src) {
          if (!addedIds.has(src.id)) {
            links.push(`[${src.id}](${src.url})`);
            addedIds.add(src.id);
          }
        } else {
          links.push(trimmed);
        }
      }

      if (allValid && links.length > 0) {
        return links.join(' ');
      }
      return match;
    });
  }

  return { bodyText: linkedBodyText, sources };
}

const components: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2 first:mt-0 text-start">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-3.5 mb-1.5 first:mt-0 text-start">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-3 mb-1 first:mt-0 text-start">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-2.5 mb-1 first:mt-0 text-start">{children}</h4>,
  p: ({ children }) => <p className="text-[15px] my-1.5 leading-relaxed first:mt-0 last:mb-0 text-start">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-blue-700 dark:text-blue-400">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc ps-6 pe-2 my-1.5 space-y-1 marker:text-gray-400 dark:marker:text-gray-500">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ps-6 pe-2 my-1.5 space-y-1 marker:text-gray-400 dark:marker:text-gray-500">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pe-1"><div dir="auto">{children}</div></li>,
  a: ({ children, href }) => {
    const label = String(children ?? '').trim();
    const isNumber = /^\d+$/.test(label);

    if (isNumber) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open source [${label}]`}
          className="inline-flex items-center justify-center w-5 h-5 text-[11px] font-bold text-blue-600 dark:text-blue-300 bg-blue-100/90 dark:bg-blue-900/60 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 rounded-full mx-0.5 transition-all transform hover:scale-110 align-middle shadow-sm border border-blue-200 dark:border-blue-700"
        >
          {label}
        </a>
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium underline hover:text-blue-800 dark:hover:text-blue-200 break-words transition-colors"
      >
        <span>{children}</span>
        <ExternalLink className="w-3 h-3 inline flex-shrink-0 opacity-75" />
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-s-4 border-blue-400 dark:border-blue-600 ps-3.5 my-2.5 italic text-gray-600 dark:text-gray-400 bg-blue-50/50 dark:bg-blue-950/20 py-1.5 rounded-e-lg">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-slate-700" />,
  code: ({ className, children }) => {
    const text = String(children ?? '').replace(/\n$/, '');
    const language = (className ?? '').replace('language-', '');
    const isInline = !className && !text.includes('\n');
    if (isInline) {
      return <code dir="ltr" className="bg-gray-100 dark:bg-slate-700/80 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-gray-200/50 dark:border-slate-600/50">{children}</code>;
    }
    return <CodeBlock language={language}>{text}</CodeBlock>;
  },
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2.5 rounded-xl border border-gray-200 dark:border-slate-700">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => <th dir="auto" className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3.5 py-2.5 text-start font-semibold text-gray-900 dark:text-gray-100">{children}</th>,
  td: ({ children }) => <td dir="auto" className="border-b border-gray-100 dark:border-slate-800 px-3.5 py-2 text-start">{children}</td>,
};

function SourcesGrid({ sources }: { sources: SourceItem[] }) {
  const [showSources, setShowSources] = useState(true);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="my-4 pt-3 border-t border-gray-200/70 dark:border-slate-700/70">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wide">
            Sources & References ({sources.length})
          </span>
        </div>

        {/* Toggle all button directly next to header */}
        <button
          type="button"
          onClick={() => setShowSources((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm"
        >
          <span>{showSources ? 'Hide References' : `Show References (${sources.length})`}</span>
          {showSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Cards Grid — displayed when showSources is true */}
      {showSources && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-all duration-300 animate-fade-in">
          {sources.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              title={s.title}
              className="group relative flex items-center gap-2.5 p-2.5 rounded-xl border bg-white/80 dark:bg-slate-800/80 border-gray-200/80 dark:border-slate-700/80 hover:border-blue-500/60 dark:hover:border-blue-400/60 hover:shadow-md hover:shadow-blue-500/5 hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Source Index Badge */}
              <span className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 border border-blue-200 dark:border-blue-800">
                {s.id}
              </span>

              {/* Favicon Icon */}
              <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-slate-700/80 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200/60 dark:border-slate-600/60">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=64`}
                  alt={s.domain}
                  className="w-3.5 h-3.5 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const sibling = e.currentTarget.nextElementSibling;
                    if (sibling) sibling.classList.remove('hidden');
                  }}
                />
                <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 hidden" />
              </div>

              {/* Title & Domain */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {s.title}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                  {s.domain}
                </div>
              </div>

              <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarkdownMessage({ content }: { content: string }) {
  const dir = detectDir(content);
  const { bodyText, sources } = parseContentAndSources(content);

  return (
    <div dir={dir} className="text-sm sm:text-[15px] md:text-base text-gray-800 dark:text-gray-200 text-start leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {bodyText}
      </ReactMarkdown>

      {/* Modern Visual Sources Grid */}
      <SourcesGrid sources={sources} />
    </div>
  );
}
