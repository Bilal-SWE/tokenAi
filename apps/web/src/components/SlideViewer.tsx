'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, LayoutTemplate, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

/** Extract the // TITLE: comment from the first line, fall back to generic. */
function extractTitle(code: string): string {
  const match = code.match(/^\/\/\s*TITLE:\s*(.+)$/m);
  return match ? match[1].trim() : 'Presentation';
}

/** Strip any accidental markdown fences the AI may have added. */
function stripFences(code: string): string {
  return code
    .replace(/^```(?:javascript|js|typescript|ts)?\s*\n?/im, '')
    .replace(/\n?```\s*$/im, '')
    .trim();
}

async function buildAndDownload(rawContent: string): Promise<string> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new (PptxGenJS as new () => InstanceType<typeof PptxGenJS>)();
  pptx.layout = 'LAYOUT_16x9';

  const code = stripFences(rawContent);
  const title = extractTitle(code);

  // Execute the AI-generated pptxgenjs code in an async context.
  // The AI has access to `pptx` and `PptxGenJS` — nothing else.
  // eslint-disable-next-line no-new-func
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
    ...args: string[]
  ) => (...args: unknown[]) => Promise<void>;
  const fn = new AsyncFunction('pptx', 'PptxGenJS', code);
  await fn(pptx, PptxGenJS);

  await pptx.writeFile({ fileName: `${title}.pptx` });
  return title;
}

export default function SlideViewer({ content }: { content: string }) {
  const [status, setStatus] = useState<'building' | 'done' | 'error'>('building');
  const [title, setTitle] = useState('Presentation');
  const [errorMsg, setErrorMsg] = useState('');
  const didRun = useRef(false);

  async function run() {
    setStatus('building');
    setErrorMsg('');
    try {
      const resolvedTitle = await buildAndDownload(content);
      setTitle(resolvedTitle);
      setStatus('done');
    } catch (err) {
      console.error('Presentation build failed', err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  // Auto-download once on first mount (streaming just finished)
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
          <LayoutTemplate className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {status === 'done' ? title : 'PowerPoint Presentation'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {status === 'building' ? 'Generating file…' : status === 'done' ? '.pptx · Ready' : 'Error'}
          </p>
        </div>
      </div>

      {/* Body */}
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
              onClick={run}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 dark:text-teal-300 dark:bg-teal-900/30 dark:hover:bg-teal-900/50 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Download again
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">
                  Failed to build the file
                </p>
                {errorMsg && (
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 font-mono">{errorMsg}</p>
                )}
              </div>
            </div>
            <button
              onClick={run}
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
