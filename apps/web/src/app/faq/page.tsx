'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PublicNav from '@/components/PublicNav';
import Footer from '@/components/Footer';
import clsx from 'clsx';

const FAQS = [
  {
    category: 'Getting started',
    items: [
      { q: 'Is TokenAI free to use?', a: 'Yes! Every new account receives 500,000 free tokens on signup — no credit card required. That\'s enough for hundreds of conversations.' },
      { q: 'What AI models are available?', a: 'TokenAI currently supports GPT-4o mini (OpenAI), Claude Haiku (Anthropic), and Gemini Flash (Google). All models are available from the same token balance.' },
      { q: 'Do I need a separate account for each AI provider?', a: 'No. TokenAI handles all provider integrations. You just create one account and get access to all supported models instantly.' },
    ],
  },
  {
    category: 'Tokens & pricing',
    items: [
      { q: 'What are tokens?', a: 'Tokens are the units AI models use to measure text. Roughly 1 token = 4 characters of text. A typical message uses 200–500 tokens. TokenAI uses tokens as its internal currency — you buy a bundle and spend tokens as you chat.' },
      { q: 'Do tokens expire?', a: 'Never. Tokens you purchase stay in your wallet indefinitely. Take a break for 6 months — your balance will be exactly where you left it.' },
      { q: 'Which model gives the most tokens per dollar?', a: 'Gemini Flash is the cheapest at $0.15 per 1M tokens (6.6M tokens per dollar). GPT-4o mini costs $0.25/1M, and Claude Haiku costs $0.40/1M.' },
      { q: 'What happens when I run out of tokens?', a: 'Your chat input will be disabled and you\'ll see a "Top up to continue" button. No charges happen automatically — you\'re always in control.' },
      { q: 'Can I get a refund on unused tokens?', a: 'We don\'t currently offer refunds on purchased token bundles. However, tokens never expire so they\'ll always be available for future use.' },
    ],
  },
  {
    category: 'Privacy & security',
    items: [
      { q: 'Are my conversations private?', a: 'Yes. Your conversations are stored in your account only and protected by row-level security — other users cannot access your data, ever.' },
      { q: 'Does TokenAI use my conversations to train AI?', a: 'No. TokenAI routes your messages to AI providers via API. We do not use your conversation data for any training purposes.' },
      { q: 'How is my payment information handled?', a: 'Payments are processed entirely by Stripe — a PCI-compliant payment processor. TokenAI never stores your card details.' },
    ],
  },
  {
    category: 'Technical',
    items: [
      { q: 'What is the context window for conversations?', a: 'TokenAI sends the last 10 messages as context with each request. This keeps costs predictable while maintaining good conversation continuity.' },
      { q: 'Can I switch models mid-conversation?', a: 'Yes! You can switch the active model at any time using the model selector at the top of the chat. Your conversation history remains intact.' },
      { q: 'Is there an API I can use?', a: 'Not yet publicly, but it\'s on the roadmap. For now, all interaction happens through the web interface.' },
    ],
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={clsx('border border-white/10 rounded-xl overflow-hidden transition-all', open && 'border-blue-500/30')}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/3 transition-colors"
      >
        <span className="font-medium text-white pr-4">{q}</span>
        <ChevronDown className={clsx('w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-4">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <PublicNav />

      <div className="pt-28 pb-24 px-4">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Frequently asked questions</h1>
            <p className="text-gray-400 text-lg">Everything you need to know about TokenAI.</p>
          </div>

          {/* FAQ sections */}
          <div className="space-y-12">
            {FAQS.map((section) => (
              <div key={section.category}>
                <h2 className="text-lg font-bold text-blue-400 mb-4">{section.category}</h2>
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <FAQItem key={item.q} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-16 text-center bg-gray-900 border border-white/10 rounded-2xl p-8">
            <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
            <p className="text-gray-400 text-sm mb-6">Can&apos;t find the answer you&apos;re looking for? Start chatting with our AI — it might just answer you.</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
              Try TokenAI free <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
