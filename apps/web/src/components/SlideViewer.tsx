'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, LayoutTemplate, Loader2, RefreshCw } from 'lucide-react';

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

async function buildPptx(title: string, slides: Slide[]): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.title = title;

  const BG      = '0F172A';
  const SURFACE = '1E293B';
  const ACCENT  = '14B8A6';
  const ACCENT2 = '818CF8';
  const TEXT_HI = 'F1F5F9';
  const TEXT_LO = '94A3B8';

  function plain(md: string) {
    return md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .trim();
  }

  function parseBullets(md: string): string[] {
    return md
      .split('\n')
      .map((l) => l.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1').trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('>'));
  }

  // ── Title slide ─────────────────────────────────────────────────────────
  {
    const tSlide = pptx.addSlide();

    tSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: BG }, line: { color: BG },
    });
    tSlide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.18, h: '100%',
      fill: { color: ACCENT }, line: { color: ACCENT },
    });
    tSlide.addShape(pptx.ShapeType.ellipse, {
      x: 7.8, y: -1.2, w: 3.5, h: 3.5,
      fill: { color: ACCENT2, transparency: 85 },
      line: { color: ACCENT2, transparency: 85 },
    });
    tSlide.addText('TokenAI', {
      x: 0.55, y: 0.9, w: 4, h: 0.3,
      fontSize: 10, bold: true, color: ACCENT, charSpacing: 3,
    });
    tSlide.addText(title, {
      x: 0.55, y: 1.3, w: 8.5, h: 2.2,
      fontSize: 42, bold: true, color: TEXT_HI, wrap: true, valign: 'top',
    });
    tSlide.addShape(pptx.ShapeType.rect, {
      x: 0.55, y: 3.6, w: 1.2, h: 0.06,
      fill: { color: ACCENT }, line: { color: ACCENT },
    });
    const firstBullets = parseBullets(slides[0]?.content ?? '');
    if (firstBullets[0]) {
      tSlide.addText(firstBullets[0], {
        x: 0.55, y: 3.85, w: 8, h: 0.5,
        fontSize: 14, color: TEXT_LO, italic: true, wrap: true,
      });
    }
    tSlide.addText(`${slides.length} slides`, {
      x: 8.5, y: 6.8, w: 1.5, h: 0.3,
      fontSize: 9, color: TEXT_LO, align: 'right',
    });
  }

  // ── Content slides ───────────────────────────────────────────────────────
  slides.forEach((s, i) => {
    const sl = pptx.addSlide();
    const bullets = parseBullets(s.content);
    const isLast = i === slides.length - 1;

    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: BG }, line: { color: BG },
    });
    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.35,
      fill: { color: SURFACE }, line: { color: SURFACE },
    });
    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.12, h: 1.35,
      fill: { color: isLast ? ACCENT2 : ACCENT },
      line:  { color: isLast ? ACCENT2 : ACCENT },
    });
    sl.addText(`${i + 1} / ${slides.length}`, {
      x: 8.5, y: 0.1, w: 1.5, h: 0.3,
      fontSize: 9, color: TEXT_LO, align: 'right',
    });
    sl.addText(plain(s.title), {
      x: 0.4, y: 0.25, w: 8.2, h: 0.85,
      fontSize: 26, bold: true,
      color: isLast ? ACCENT2 : ACCENT,
      wrap: true, valign: 'middle',
    });

    const maxBullets = Math.min(bullets.length, 6);
    const rowH = 0.72;
    const startY = 1.55;

    bullets.slice(0, maxBullets).forEach((bullet, bi) => {
      const y = startY + bi * rowH;
      if (bi % 2 === 0) {
        sl.addShape(pptx.ShapeType.rect, {
          x: 0.3, y: y - 0.06, w: 9.4, h: rowH - 0.06,
          fill: { color: SURFACE, transparency: 30 },
          line: { color: SURFACE, transparency: 50 },
          rectRadius: 0.05,
        });
      }
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
      sl.addText(bullet, {
        x: 0.9, y: y, w: 8.7, h: rowH - 0.1,
        fontSize: 13.5, color: TEXT_HI, wrap: true, valign: 'middle',
      });
    });

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
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SlideViewer({ content }: { content: string }) {
  const { title, slides } = parseSlides(content);
  const [status, setStatus] = useState<'building' | 'done' | 'error'>('building');
  const [errorMsg, setErrorMsg] = useState('');
  const didDownload = useRef(false);

  async function triggerDownload() {
    setStatus('building');
    setErrorMsg('');
    try {
      await buildPptx(title, slides);
      setStatus('done');
    } catch (err) {
      console.error('PPTX generation failed', err);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }

  // Auto-download once when the component mounts (streaming just finished)
  useEffect(() => {
    if (didDownload.current) return;
    didDownload.current = true;
    triggerDownload();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
          <LayoutTemplate className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{title}</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{slides.length} slides · PowerPoint</p>
        </div>
      </div>

      {/* Status */}
      <div className="px-4 py-4" style={{ background: 'var(--card-bg)' }}>
        {status === 'building' && (
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="w-4 h-4 animate-spin text-teal-600 flex-shrink-0" />
            <span>Building your PowerPoint file…</span>
          </div>
        )}

        {status === 'done' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Download started
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Check your Downloads folder for <strong>{title}.pptx</strong>
                </p>
              </div>
            </div>
            <button
              onClick={triggerDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 dark:text-teal-300 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Download again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to build the file. {errorMsg}
            </p>
            <button
              onClick={triggerDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
