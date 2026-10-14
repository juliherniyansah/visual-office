// Auth middleware for Next.js protected routes
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

export function useAuth() {
  const router = useRouter();
  const { isAuthenticated, checkAuth, user } = useAuthStore();

  useEffect(() => {
    const isValid = checkAuth();
    if (!isValid) {
      router.push('/login');
    }
  }, [checkAuth, router]);

  return { isAuthenticated, user };
}

export function ProtectedRoute<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}
