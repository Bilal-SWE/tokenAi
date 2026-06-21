import Link from 'next/link';
import { Check, Zap } from 'lucide-react';
import PublicNav from '@/components/PublicNav';
import Footer from '@/components/Footer';
import { TOKEN_BUNDLES, AI_MODELS, IMAGE_MODELS, formatTokens } from '@tokenai/shared';
import type { ModelTier } from '@tokenai/shared';

const TIER_STYLE: Record<ModelTier, string> = {
  free: 'bg-green-500/15 text-green-400 border-green-500/20',
  standard: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  premium: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  ultra: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
};

export default function PricingPage() {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <PublicNav />

      <div className="pt-28 pb-24 px-4">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-xs font-medium px-4 py-2 rounded-full mb-6">
              <Zap className="w-3.5 h-3.5" /> No subscription, ever
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">Pay only for what you use</h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Buy a token bundle once. Use it across all AI models. Tokens never expire.
            </p>
          </div>

          {/* Bundles */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {TOKEN_BUNDLES.map((bundle) => (
              <div key={bundle.id} className={`relative rounded-2xl p-7 border flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                bundle.popular
                  ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-600/20'
                  : 'bg-gray-900 border-white/10 hover:border-white/20'
              }`}>
                {bundle.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full">
                    Best value
                  </div>
                )}
                <div className="mb-6">
                  <div className="text-gray-400 font-medium mb-1">{bundle.label}</div>
                  <div className="text-4xl font-bold text-white">${bundle.usd}</div>
                  <div className="text-blue-400 font-semibold mt-1">{formatTokens(bundle.tokens)} credits</div>
                  <div className="text-xs text-gray-500 mt-1">${(bundle.usd / bundle.tokens * 1_000_000).toFixed(2)} per 1M credits</div>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {[
                    `~${formatTokens(Math.floor(bundle.tokens / 1500))} cheap-model messages`,
                    'All 10 AI models',
                    'Vision + file + image generation',
                    'Free models included',
                    'Credits never expire',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`block text-center font-semibold py-3 rounded-xl transition-colors ${
                  bundle.popular
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                }`}>
                  Get started
                </Link>
              </div>
            ))}
          </div>

          {/* Model pricing table */}
          <div className="max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-center mb-3">Model pricing breakdown</h2>
            <p className="text-center text-gray-400 text-sm mb-8 max-w-xl mx-auto">
              The rate is how many credits each model costs relative to the cheapest one.
              A typical message is ~1,500 tokens — multiply by the rate to estimate credits.
            </p>
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 px-5 py-3 bg-white/5 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div className="col-span-5">Model</div>
                <div className="col-span-2 text-center">Tier</div>
                <div className="col-span-2 text-center">Rate</div>
                <div className="col-span-3 text-right">~Credits / msg</div>
              </div>
              {AI_MODELS.map((model, i) => (
                <div key={model.id} className={`grid grid-cols-12 px-5 py-4 items-center ${i < AI_MODELS.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="col-span-5 flex items-center gap-2">
                    <div>
                      <div className="font-medium text-white flex items-center gap-1.5">
                        {model.label}
                        {model.supportsVision && <span title="Supports image input">📷</span>}
                      </div>
                      <div className="text-xs text-gray-500">{model.provider} · {model.badge}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${TIER_STYLE[model.tier]}`}>
                      {model.tier}
                    </span>
                  </div>
                  <div className="col-span-2 text-center font-semibold text-white">
                    {Number(model.multiplier) === 0 ? 'Free' : `${model.multiplier}×`}
                  </div>
                  <div className="col-span-3 text-right font-semibold text-green-400">
                    {Number(model.multiplier) === 0 ? '0' : formatTokens(model.multiplier * 1500)}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mt-3">
              Free models have a daily message limit. Paid models are charged by exact usage.
            </p>
          </div>

          {/* Image generation pricing */}
          <div className="max-w-3xl mx-auto mb-20">
            <h2 className="text-2xl font-bold text-center mb-8">Image generation</h2>
            <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 px-6 py-3 bg-white/5 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div>Model</div>
                <div className="text-center">Quality</div>
                <div className="text-right">Credits / image</div>
              </div>
              {IMAGE_MODELS.map((m) => (
                <div key={m.id} className="grid grid-cols-3 px-6 py-4 items-center">
                  <div>
                    <div className="font-medium text-white">{m.label}</div>
                    <div className="text-xs text-gray-500">{m.provider}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-medium bg-white/5 px-2.5 py-1 rounded-full">{m.quality}</span>
                  </div>
                  <div className="text-right font-semibold text-green-400">{formatTokens(m.credits)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ mini */}
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">Pricing FAQs</h2>
            <div className="space-y-4">
              {[
                { q: 'Do credits expire?', a: 'No. Your credits stay in your wallet until you use them — no expiry date ever.' },
                { q: 'Why do models have different rates?', a: 'Each model has a different real cost. The rate (e.g. 50×) reflects how much more expensive a premium model like Claude Sonnet is versus the cheapest one. You always pay fairly for exactly what you use.' },
                { q: 'What happens when I run out?', a: 'Paid models are disabled and you\'ll see a prompt to top up — but you can always keep chatting on the free models (with a daily limit). No charges happen automatically.' },
                { q: 'Are there really free models?', a: 'Yes! Gemini 2.0 Flash, DeepSeek R1, and Llama 3.3 70B are free to use every day (subject to a daily message limit) — no credits deducted.' },
              ].map((item) => (
                <div key={item.q} className="bg-gray-900 border border-white/10 rounded-xl px-6 py-4">
                  <div className="font-medium text-white mb-2">{item.q}</div>
                  <div className="text-gray-400 text-sm">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
