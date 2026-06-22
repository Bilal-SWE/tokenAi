'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutTemplate, Copy, Check, AlignLeft, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';

interface Slide {
  title: string;
  content: string;
  notes: string;
}

function parseSlides(markdown: string): { title: string; slides: Slide[] } {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const presentationTitle = titleMatch ? titleMatch[1].trim() : 'Presentation';

  const sections = markdown.split(/\n---+\n/);
  const slides: Slide[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    const titleLine = trimmed.match(/^##\s+(.+)$/m);
    if (!titleLine) continue;

    const slideTitle = titleLine[1].trim();
    const notesMatch = trimmed.match(/^>\s*\*\*(?:Notes?|Speaker notes?):\*\*\s*(.+)$/m);
    const notes = notesMatch ? notesMatch[1].trim() : '';

    const content = trimmed
      .replace(/^##\s+.+$/m, '')
      .replace(/^>.*$/gm, '')
      .trim();

    slides.push({ title: slideTitle, content, notes });
  }

  if (slides.length === 0) {
    return { title: presentationTitle, slides: [{ title: presentationTitle, content: markdown, notes: '' }] };
  }

  return { title: presentationTitle, slides };
}

const slideColors = [
  'from-blue-600 to-blue-700',
  'from-violet-600 to-violet-700',
  'from-emerald-600 to-emerald-700',
  'from-orange-600 to-orange-700',
  'from-teal-600 to-teal-700',
  'from-rose-600 to-rose-700',
  'from-sky-600 to-sky-700',
  'from-indigo-600 to-indigo-700',
];

export default function SlideViewer({ content }: { content: string }) {
  const [current, setCurrent] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const { title, slides } = parseSlides(content);
  const slide = slides[current];
  const color = slideColors[current % slideColors.length];

  async function copyAll() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function downloadPptx() {
    setDownloading(true);
    try {
      // Dynamic import so pptxgenjs doesn't bloat the initial bundle
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.title = title;

      // Accent colours matching slideColors
      const accentColors = [
        '2563EB', '7C3AED', '059669', 'EA580C',
        '0D9488', 'E11D48', '0284C7', '4F46E5',
      ];

      slides.forEach((s, i) => {
        const slide = pptx.addSlide();
        const accent = accentColors[i % accentColors.length];

        // Background
        slide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: '100%',
          fill: { color: accent },
        });

        // Slide number badge
        slide.addText(`${i + 1} / ${slides.length}`, {
          x: 0.3, y: 0.2, w: 1.5, h: 0.3,
          fontSize: 9, color: 'FFFFFF', bold: false,
          transparency: 40,
        });

        // Title
        slide.addText(s.title, {
          x: 0.5, y: 0.6, w: 9, h: 1.0,
          fontSize: 28, bold: true, color: 'FFFFFF',
          wrap: true,
        });

        // Divider line
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 1.7, w: 9, h: 0.03,
          fill: { color: 'FFFFFF', transparency: 60 },
          line: { color: 'FFFFFF', transparency: 60 },
        });

        // Content: strip markdown syntax for clean .pptx text
        const plainText = s.content
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/^[-*+]\s+/gm, '• ')
          .replace(/^\d+\.\s+/gm, (m) => m)
          .trim();

        slide.addText(plainText, {
          x: 0.5, y: 1.85, w: 9, h: 4.0,
          fontSize: 14, color: 'FFFFFF',
          transparency: 10,
          wrap: true, valign: 'top',
        });

        // Speaker notes
        if (s.notes) {
          slide.addNotes(s.notes);
        }
      });

      await pptx.writeFile({ fileName: `${title}.pptx` });
    } finally {
      setDownloading(false);
    }
  }

  if (rawView) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">Markdown source</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setRawView(false)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <LayoutTemplate className="w-3 h-3" /> Slides view
            </button>
            <button
              onClick={downloadPptx}
              disabled={downloading}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3 h-3" />
              {downloading ? 'Exporting…' : '.pptx'}
            </button>
            <button
              onClick={copyAll}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed whitespace-pre-wrap">{content}</pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 truncate max-w-[200px]">{title}</span>
          <span className="text-xs text-gray-400">· {slides.length} slides</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setRawView(true)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <AlignLeft className="w-3 h-3" /> Markdown
          </button>
          <button
            onClick={downloadPptx}
            disabled={downloading}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            {downloading ? 'Exporting…' : 'Download .pptx'}
          </button>
          <button
            onClick={copyAll}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Slide card */}
      <div className={clsx('rounded-2xl overflow-hidden bg-gradient-to-br text-white shadow-lg', color)}>
        {/* Slide header */}
        <div className="px-6 py-5 border-b border-white/20">
          <div className="text-xs font-medium text-white/60 mb-1">
            Slide {current + 1} / {slides.length}
          </div>
          <h3 className="text-lg font-bold leading-tight">{slide.title}</h3>
        </div>

        {/* Slide body */}
        <div className="px-6 py-5 min-h-[140px]">
          <div className="text-sm leading-relaxed text-white/90 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                ul: ({ children }) => <ul className="list-disc ps-4 space-y-1 my-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ps-4 space-y-1 my-2">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                p: ({ children }) => <p className="my-1">{children}</p>,
                h4: ({ children }) => <h4 className="font-semibold text-white/80 mt-3 mb-1 text-xs uppercase tracking-wide">{children}</h4>,
              }}
            >
              {slide.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>

        {/* Slide dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={clsx(
                'rounded-full transition-all',
                i === current ? 'w-4 h-2 bg-blue-600' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
              )}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))}
          disabled={current === slides.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Speaker notes */}
      {slide.notes && (
        <div>
          <button
            onClick={() => setShowNotes((n) => !n)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showNotes ? 'Hide' : 'Show'} speaker notes
          </button>
          {showNotes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-800 leading-relaxed">
              {slide.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
