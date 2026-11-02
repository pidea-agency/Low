import { useGetCurrentUser } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { useEffect } from 'react';
import { handleSessionTerminationCleanup } from '@/lib/poa-storage';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, error } = useGetCurrentUser();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (error || !user)) {
      handleSessionTerminationCleanup();
      setLocation('/login');
    }
  }, [user, isLoading, error, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return null;
  }

  return <>{children}</>;
}
