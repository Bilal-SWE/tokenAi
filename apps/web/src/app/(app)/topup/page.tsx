'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export default function TopupPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Payments coming soon</h2>
        <p className="text-gray-500 text-sm mb-6">
          We're working on adding payment options. In the meantime, you can use your free tokens to explore the platform.
        </p>
        <button
          onClick={() => router.push('/chat')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
        >
          Go to Chat
        </button>
      </div>
    </div>
  );
}
