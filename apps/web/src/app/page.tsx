import Link from 'next/link';
import { Zap, MessageSquare, Shield, CreditCard, ChevronRight, Check, Star } from 'lucide-react';
import PublicNav from '@/components/PublicNav';
import Footer from '@/components/Footer';
import { TOKEN_BUNDLES, AI_MODELS, formatTokens } from '@tokenai/shared';

export default function LandingPage() {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <PublicNav />

      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 pb-24 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium px-4 py-2 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            5,000 free tokens on signup — no credit card required
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            AI without the
            <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-300 bg-clip-text text-transparent">
              monthly subscription
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Access GPT-4o mini, Claude Haiku, and Gemini Flash on a single platform.
            Buy tokens once, use them across all models. Pay only for what you use.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/register"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5">
              Start for free
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200">
              See pricing
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
            {[
              { label: 'Free tokens on signup', value: "5K" },
              { label: 'AI models available', value: '3+' },
              { label: 'No monthly fee', value: '$0' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-white">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">One platform, all the best AI models, zero subscriptions.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: CreditCard,
                color: 'blue',
                title: 'Pay as you go',
                desc: 'Buy token bundles starting from $5. No monthly commitment, no surprises. Tokens never expire.',
              },
              {
                icon: MessageSquare,
                color: 'indigo',
                title: 'All models, one wallet',
                desc: 'Switch between GPT-4o mini, Claude Haiku, and Gemini Flash mid-conversation. One balance covers all.',
              },
              {
                icon: Shield,
                color: 'violet',
                title: 'Secure & private',
                desc: 'Row-level security on every data record. Your conversations are private and protected.',
              },
            ].map((f) => (
              <div key={f.title} className="bg-gray-900/60 border border-white/5 rounded-2xl p-6 hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-600/5">
                <div className={`w-11 h-11 rounded-xl bg-${f.color}-600/10 border border-${f.color}-500/20 flex items-center justify-center mb-4`}>
                  <f.icon className={`w-5 h-5 text-${f.color}-400`} />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MODELS ───────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Choose your AI model</h2>
            <p className="text-gray-400 text-lg">All models accessible from a single token wallet.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {AI_MODELS.map((model) => (
              <div key={model.id} className="bg-gray-900 border border-white/10 rounded-2xl p-6 hover:border-blue-500/40 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-blue-400 bg-blue-400/10 px-2.5 py-1 rounded-full">{model.badge}</span>
                  <span className="text-xs text-gray-500">{model.provider}</span>
                </div>
                <h3 className="text-white font-bold text-xl mb-1 flex items-center gap-2">
                  {model.label}
                  {model.supportsVision && <span className="text-sm" title="Supports image input">📷</span>}
                </h3>
                <p className="text-gray-400 text-sm mb-4 truncate">{model.id}</p>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tier</span>
                    <span className="text-white font-medium capitalize">{model.tier}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Rate</span>
                    <span className="text-green-400 font-medium">
                      {Number(model.multiplier) === 0 ? 'Free' : `${model.multiplier}× credits`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-gray-400 text-lg">No hidden fees. No subscription traps. Just tokens.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOKEN_BUNDLES.map((bundle) => (
              <div key={bundle.id} className={`relative bg-gray-900 rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${
                bundle.popular
                  ? 'border-blue-500 shadow-lg shadow-blue-600/20'
                  : 'border-white/10 hover:border-white/20'
              }`}>
                {bundle.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="text-gray-400 text-sm font-medium mb-2">{bundle.label}</div>
                <div className="text-3xl font-bold text-white mb-1">${bundle.usd}</div>
                <div className="text-blue-400 font-semibold mb-4">{formatTokens(bundle.tokens)} tokens</div>
                <div className="text-xs text-gray-500 mb-5">${(bundle.usd / bundle.tokens * 1_000_000).toFixed(2)} per 1M tokens</div>
                <Link href="/register"
                  className={`block text-center text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                    bundle.popular
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-gray-900/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Loved by developers</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Sarah K.', role: 'Software Engineer', text: 'Finally, an AI tool that doesn\'t charge me $20/month when I only use it occasionally. TokenAI is perfect for my workflow.' },
              { name: 'Ahmed R.', role: 'Product Manager', text: 'Switching between Claude and GPT in the same conversation is a game changer. Best AI platform I\'ve tried.' },
              { name: 'Maria L.', role: 'Freelance Writer', text: 'The pay-as-you-go model is exactly what I needed. 5K free tokens got me started and I love the transparency.' },
            ].map((t) => (
              <div key={t.name} className="bg-gray-900 border border-white/10 rounded-2xl p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />)}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">&quot;{t.text}&quot;</p>
                <div>
                  <div className="text-white font-medium text-sm">{t.name}</div>
                  <div className="text-gray-500 text-xs">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ PREVIEW ──────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Have questions?</h2>
          <p className="text-gray-400 mb-8">Check out our FAQ or reach out directly.</p>
          <Link href="/faq"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium px-6 py-3 rounded-xl transition-colors">
            View all FAQs <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-10 sm:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Start chatting for free</h2>
              <p className="text-blue-100 text-lg mb-8">5,000 tokens. No credit card. No expiry.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register"
                  className="inline-flex items-center justify-center gap-2 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl text-base transition-all hover:shadow-xl hover:-translate-y-0.5">
                  Create free account <ChevronRight className="w-5 h-5" />
                </Link>
                <Link href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base transition-colors border border-white/20">
                  Sign in
                </Link>
              </div>
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-blue-100">
                {['No subscription', 'No expiry', 'Cancel anytime'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5"><Check className="w-4 h-4" />{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
