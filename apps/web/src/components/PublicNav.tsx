'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Zap } from 'lucide-react';
import clsx from 'clsx';

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { href: '/pricing', label: 'Pricing' },
    { href: '/about', label: 'About' },
    { href: '/faq', label: 'FAQ' },
  ];

  return (
    <nav className={clsx(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-gray-900/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-lg">TokenAI</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === l.href ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                )}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* CTA buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-gray-300 hover:text-white text-sm font-medium transition-colors px-4 py-2">
              Sign in
            </Link>
            <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Get started free
            </Link>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setOpen(!open)} className="md:hidden text-gray-300 hover:text-white p-2">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-900/98 backdrop-blur-md border-t border-white/10 px-4 py-4 space-y-2">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block px-4 py-2 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors">
              {l.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <Link href="/login" onClick={() => setOpen(false)}
              className="block px-4 py-2 text-center text-gray-300 hover:text-white text-sm font-medium border border-white/20 rounded-lg transition-colors">
              Sign in
            </Link>
            <Link href="/register" onClick={() => setOpen(false)}
              className="block px-4 py-2 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
