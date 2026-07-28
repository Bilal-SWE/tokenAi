'use client';

import { useState } from 'react';
import {
  Terminal, Copy, Check, Zap, Code2, FileCode2, GitBranch,
  Sparkles, Globe, Lock, ChevronRight, AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy command"
      className={clsx(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
        copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-white/10 hover:bg-white/20 text-gray-300 border border-white/10 hover:border-white/20'
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function CodeBlock({ command, comment }: { command: string; comment?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-gray-950/80 backdrop-blur-sm">
      {comment && (
        <div className="px-4 py-2 border-b border-white/5 text-xs text-gray-500 font-mono">
          {comment}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-violet-400 font-mono text-sm select-none">$</span>
        <code className="flex-1 font-mono text-sm text-gray-100 tracking-wide">{command}</code>
        <CopyButton text={command} />
      </div>
    </div>
  );
}

const STEPS = [
  {
    num: '01',
    icon: <Terminal className="w-5 h-5" />,
    title: 'Install the CLI tool',
    desc: 'Install the TokenAI Coder tool globally via npm once on your system',
    color: 'from-violet-500 to-indigo-500',
    commands: [{ cmd: 'npm install -g @tokenai/coder', comment: '# Install the tool globally on your system' }],
  },
  {
    num: '02',
    icon: <Lock className="w-5 h-5" />,
    title: 'Log in to your account',
    desc: 'Log in with your TokenAI credentials — your token balance will be used directly',
    color: 'from-blue-500 to-cyan-500',
    commands: [{ cmd: 'tokenai login', comment: '# You will be prompted for your email and password' }],
  },
  {
    num: '03',
    icon: <FileCode2 className="w-5 h-5" />,
    title: 'Go to your project and start coding',
    desc: 'Navigate to any local project folder and write your requests in English or Arabic',
    color: 'from-emerald-500 to-teal-500',
    commands: [
      { cmd: 'cd my-project', comment: '# Navigate to your project directory' },
      { cmd: 'tokenai "add login function to auth.ts"', comment: '# Write your request directly' },
    ],
  },
];

const EXAMPLES = [
  { icon: <Code2 className="w-4 h-4" />, label: 'Modify Code', cmd: 'tokenai "fix error on line 42 of main.py"' },
  { icon: <FileCode2 className="w-4 h-4" />, label: 'Add Tests', cmd: 'tokenai "add unit tests for utils.ts"' },
  { icon: <Globe className="w-4 h-4" />, label: 'Explain Code', cmd: 'tokenai "explain what this file does" --file app.js' },
  { icon: <GitBranch className="w-4 h-4" />, label: 'Refactoring', cmd: 'tokenai "convert this code from JavaScript to TypeScript"' },
];

const FEATURES = [
  { icon: <Zap className="w-4 h-4" />, title: 'No Monthly Subscription', desc: 'Only pay for the exact tokens you consume' },
  { icon: <Lock className="w-4 h-4" />, title: 'Secure API Keys', desc: 'No need for a personal API key — your TokenAI account is enough' },
  { icon: <Code2 className="w-4 h-4" />, title: 'All Models Supported', desc: 'Access GPT-4o, Claude, Gemini, and more from the same CLI' },
  { icon: <Globe className="w-4 h-4" />, title: 'Any Language', desc: 'Submit prompts in English, Arabic, or any preferred language' },
];

export default function CoderPage() {
  return (
    <div className="min-h-full overflow-y-auto" style={{ background: 'var(--page-bg)', color: 'var(--text-primary)' }}>
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-12">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Coming Soon — TokenAI Coder
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            AI Coding Agent{' '}
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-blue-400 bg-clip-text text-transparent">
              No Subscription
            </span>
          </h1>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            A command-line tool (CLI) that reads your project files, executes AI commands, and updates code directly — no subscription, just pay as you go using tokens.
          </p>
        </div>

        {/* Coming Soon Banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Tool currently under construction 🚧</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              The steps and commands outlined below represent the final release plan. Feel free to explore how it works.
            </p>
          </div>
        </div>



        {/* Features */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Why TokenAI Coder?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-4 rounded-xl border" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center flex-shrink-0">{f.icon}</div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card-bg)' }}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            How does it work under the hood?
          </h2>
          <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {[
              { s: '1', t: 'Type your request in your terminal: tokenai "add login function to auth.ts"' },
              { s: '2', t: 'The tool reads the relevant files directly from your workspace' },
              { s: '3', t: 'It securely sends the files and request to the TokenAI API' },
              { s: '4', t: 'The API verifies your balance and invokes the requested AI model' },
              { s: '5', t: 'The generated code modifications are automatically applied to your local files' },
            ].map((item) => (
              <div key={item.s} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.s}</span>
                <span className="leading-relaxed">{item.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center pb-6">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Out of tokens?</p>
          <a
            href="/topup"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/25 hover:-translate-y-0.5"
          >
            <Zap className="w-4 h-4" />
            Top up your wallet now
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

      </div>
    </div>
  );
}
