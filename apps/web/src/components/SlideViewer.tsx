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
      const PptxGenJS = (await import('pptxgenjs')).default;
      const pptx = new PptxGenJS();
      pptx.layout = 'LAYOUT_16x9';
      pptx.title = title;

      // ── Design tokens ───────────────────────────────────────────────────
      const BG       = '0F172A'; // slate-900 — consistent dark background
      const SURFACE  = '1E293B'; // slate-800 — card / panel background
      const ACCENT   = '14B8A6'; // teal-500  — primary accent
      const ACCENT2  = '818CF8'; // indigo-400 — secondary accent
      const TEXT_HI  = 'F1F5F9'; // slate-100 — primary text
      const TEXT_LO  = '94A3B8'; // slate-400 — secondary / meta text

      /** Strip markdown syntax and return plain text */
      function plain(md: string) {
        return md
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*(.+?)\*\*/g, '$1')
          .replace(/\*(.+?)\*/g, '$1')
          .replace(/`(.+?)`/g, '$1')
          .trim();
      }

      /** Parse content block into individual bullet strings */
      function parseBullets(md: string): string[] {
        return md
          .split('\n')
          .map((l) => l.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim())
          .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('>'));
      }

      // ── Slide 0: Title slide ─────────────────────────────────────────────
      {
        const tSlide = pptx.addSlide();

        // Full dark background
        tSlide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: '100%',
          fill: { color: BG }, line: { color: BG },
        });

        // Left accent bar
        tSlide.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.18, h: '100%',
          fill: { color: ACCENT }, line: { color: ACCENT },
        });

        // Decorative circle (top-right)
        tSlide.addShape(pptx.ShapeType.ellipse, {
          x: 7.8, y: -1.2, w: 3.5, h: 3.5,
          fill: { color: ACCENT2, transparency: 85 },
          line: { color: ACCENT2, transparency: 85 },
        });

        // Platform label
        tSlide.addText('TokenAI', {
          x: 0.55, y: 0.9, w: 4, h: 0.3,
          fontSize: 10, bold: true, color: ACCENT,
          charSpacing: 3,
        });

        // Main title
        tSlide.addText(title, {
          x: 0.55, y: 1.3, w: 8.5, h: 2.2,
          fontSize: 42, bold: true, color: TEXT_HI,
          wrap: true, valign: 'top',
        });

        // Divider
        tSlide.addShape(pptx.ShapeType.rect, {
          x: 0.55, y: 3.6, w: 1.2, h: 0.06,
          fill: { color: ACCENT }, line: { color: ACCENT },
        });

        // Subtitle from first slide's first bullet
        const firstBullets = parseBullets(slides[0]?.content ?? '');
        if (firstBullets[0]) {
          tSlide.addText(firstBullets[0], {
            x: 0.55, y: 3.85, w: 8, h: 0.5,
            fontSize: 14, color: TEXT_LO, italic: true, wrap: true,
          });
        }

        // Slide count badge
        tSlide.addText(`${slides.length} slides`, {
          x: 8.5, y: 6.8, w: 1.5, h: 0.3,
          fontSize: 9, color: TEXT_LO, align: 'right',
        });
      }

      // ── Content slides ───────────────────────────────────────────────────
      slides.forEach((s, i) => {
        const sl = pptx.addSlide();
        const bullets = parseBullets(s.content);
        const isLast = i === slides.length - 1;

        // Background
        sl.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: '100%',
          fill: { color: BG }, line: { color: BG },
        });

        // Top header panel
        sl.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: '100%', h: 1.35,
          fill: { color: SURFACE }, line: { color: SURFACE },
        });

        // Accent left strip in header
        sl.addShape(pptx.ShapeType.rect, {
          x: 0, y: 0, w: 0.12, h: 1.35,
          fill: { color: isLast ? ACCENT2 : ACCENT },
          line:  { color: isLast ? ACCENT2 : ACCENT },
        });

        // Slide number (top-right)
        sl.addText(`${i + 1} / ${slides.length}`, {
          x: 8.5, y: 0.1, w: 1.5, h: 0.3,
          fontSize: 9, color: TEXT_LO, align: 'right',
        });

        // Slide title
        sl.addText(plain(s.title), {
          x: 0.4, y: 0.25, w: 8.2, h: 0.85,
          fontSize: 26, bold: true, color: isLast ? ACCENT2 : ACCENT,
          wrap: true, valign: 'middle',
        });

        // Content area: render bullets as individual rows
        const maxBullets = Math.min(bullets.length, 6);
        const rowH = 0.72;
        const startY = 1.55;

        bullets.slice(0, maxBullets).forEach((bullet, bi) => {
          const y = startY + bi * rowH;

          // Row background (alternating)
          if (bi % 2 === 0) {
            sl.addShape(pptx.ShapeType.rect, {
              x: 0.3, y: y - 0.06, w: 9.4, h: rowH - 0.06,
              fill: { color: SURFACE, transparency: 30 },
              line: { color: SURFACE, transparency: 50 },
              rectRadius: 0.05,
            });
          }

          // Numbered badge
          sl.addShape(pptx.ShapeType.ellipse, {
            x: 0.38, y: y + 0.03, w: 0.42, h: 0.42,
            fill: { color: isLast ? ACCENT2 : ACCENT, transparency: bi > 0 ? 20 : 0 },
            line: { color: isLast ? ACCENT2 : ACCENT, transparency: bi > 0 ? 20 : 0 },
          });
          sl.addText(`${bi + 1}`, {
            x: 0.38, y: y + 0.03, w: 0.42, h: 0.42,
            fontSize: 10, bold: true, color: BG,
            align: 'center', valign: 'middle',
          });

          // Bullet text
          sl.addText(bullet, {
            x: 0.9, y: y, w: 8.7, h: rowH - 0.1,
            fontSize: 13.5, color: TEXT_HI,
            wrap: true, valign: 'middle',
          });
        });

        // If fewer than 3 bullets, add a quote/note section
        if (bullets.length < 3 && s.notes) {
          const noteY = startY + maxBullets * rowH + 0.2;
          sl.addShape(pptx.ShapeType.rect, {
            x: 0.3, y: noteY, w: 0.06, h: 0.9,
            fill: { color: ACCENT }, line: { color: ACCENT },
          });
          sl.addText(plain(s.notes).slice(0, 180), {
            x: 0.55, y: noteY, w: 9.1, h: 0.9,
            fontSize: 12, color: TEXT_LO, italic: true, wrap: true,
          });
        }

        if (s.notes) sl.addNotes(s.notes);
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
