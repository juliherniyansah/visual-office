'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

const OfficeCanvas = dynamic(() => import('@/components/office/OfficeCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-gray-100">
      <p className="text-gray-500">Loading workspace...</p>
    </div>
  ),
});

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-900">Visual Office</h1>
          {user && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{user.email}</span>
              <span className="text-gray-400">•</span>
              <span className="capitalize">{user.role}</span>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Logout
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        <OfficeCanvas />
      </main>
    </div>
  );
}
