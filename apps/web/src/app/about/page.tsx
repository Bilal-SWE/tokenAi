import Link from 'next/link';
import { Zap, Target, Heart, Globe } from 'lucide-react';
import PublicNav from '@/components/PublicNav';
import Footer from '@/components/Footer';

export default function AboutPage() {
  return (
    <div className="bg-gray-950 text-white min-h-screen">
      <PublicNav />

      <div className="pt-28 pb-24 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Hero */}
          <div className="text-center mb-20">
            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">About TokenAI</h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
              We built TokenAI because we were tired of paying $20/month for AI tools we only use a few times a week.
              There had to be a better way — and there is.
            </p>
          </div>

          {/* Story */}
          <div className="bg-gray-900/60 border border-white/5 rounded-3xl p-8 sm:p-12 mb-12">
            <h2 className="text-2xl font-bold mb-6">Our story</h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                Most AI platforms lock you into monthly subscriptions whether you use them or not.
                Power users get great value, but casual users end up paying for days they never even open the app.
              </p>
              <p>
                TokenAI flips this model. You buy tokens once — they never expire — and consume them at your own pace.
                Using AI heavily this week? Great. Taking a break next month? No charge.
              </p>
              <p>
                We also believe you shouldn&apos;t be forced to pick one AI provider. Different models excel at different tasks.
                TokenAI gives you access to GPT-4o mini, Claude Haiku, and Gemini Flash all from one wallet.
              </p>
            </div>
          </div>

          {/* Values */}
          <div className="grid sm:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Target,
                title: 'Transparency',
                desc: 'Every token cost is visible upfront. No hidden fees, no surprise charges. You always know exactly what you\'re spending.',
              },
              {
                icon: Heart,
                title: 'User first',
                desc: 'Features are built around how people actually use AI — in bursts, across different models, without commitment.',
              },
              {
                icon: Globe,
                title: 'Accessible',
                desc: 'Powerful AI shouldn\'t require expensive subscriptions. TokenAI starts free and scales with your actual usage.',
              },
            ].map((v) => (
              <div key={v.title} className="bg-gray-900 border border-white/10 rounded-2xl p-6 text-center">
                <div className="w-10 h-10 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{v.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-3xl p-10">
            <h2 className="text-2xl font-bold mb-3">Ready to try it?</h2>
            <p className="text-gray-400 mb-6">Start with 500,000 free tokens — no credit card needed.</p>
            <Link href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3 rounded-xl transition-all hover:-translate-y-0.5">
              Create free account
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
