import Link from 'next/link';
import { Zap, Twitter, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-white/5 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg">TokenAI</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Pay-as-you-go AI platform. Access GPT-4o, Claude, and Gemini with a simple token wallet.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="text-gray-500 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="text-gray-500 hover:text-white transition-colors"><Github className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-medium text-sm mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/register" className="hover:text-white transition-colors">Get started</Link></li>
              <li><Link href="/chat" className="hover:text-white transition-colors">Chat</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-medium text-sm mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/about" className="hover:text-white transition-colors">About us</Link></li>
              <li><Link href="/faq" className="hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-medium text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <p>© {new Date().getFullYear()} TokenAI. All rights reserved.</p>
          <p>Powered by OpenRouter · Supabase · Stripe</p>
        </div>
      </div>
    </footer>
  );
}
