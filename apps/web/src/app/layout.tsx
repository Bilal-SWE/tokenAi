import type { Metadata } from 'next';
import './globals.css';
import { AppPreferencesProvider } from '@/context/AppPreferencesContext';

export const metadata: Metadata = {
  title: 'TokenAI — Pay-as-you-go AI',
  description: 'Access GPT-4o mini, Claude Haiku, and Gemini Flash with a simple token wallet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="h-full antialiased">
        <AppPreferencesProvider>
          {children}
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
