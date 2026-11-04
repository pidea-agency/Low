import React, { useState, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthGuard } from '@/components/auth-guard';
import { SuperAdminGuard, AdminGuard } from '@/components/admin-guard';
import { RequireRole } from '@/components/require-role';
import { Sidebar } from '@/components/sidebar';
import { ErrorBoundary } from '@/components/error-boundary';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Scale } from 'lucide-react';
import { GlobalSearch } from '@/components/global-search';
import { useGetCurrentUser } from '@workspace/api-client-react';

const NotFound = React.lazy(() => import('@/pages/not-found'));
const LoginPage = React.lazy(() => import('@/pages/login'));
const AdminLoginPage = React.lazy(() => import('@/pages/admin-login'));
const SuperAdminPage = React.lazy(() => import('@/pages/super-admin'));
const OfficeMembersPage = React.lazy(() => import('@/pages/users'));
const DashboardPage = React.lazy(() => import('@/pages/dashboard'));
const ChatPage = React.lazy(() => import('@/pages/chat'));
const SessionsPage = React.lazy(() => import('@/pages/sessions'));
const SessionDetailPage = React.lazy(() => import('@/pages/session-detail'));
const SettingsPage = React.lazy(() => import('@/pages/settings'));
const SubscriptionPage = React.lazy(() => import('@/pages/subscription'));
const ReportsPage = React.lazy(() => import('@/pages/reports'));
const SessionReportPage = React.lazy(() => import('@/pages/session-report'));
const PoaPage = React.lazy(() => import('@/pages/poa'));
const JudgmentsPage = React.lazy(() => import('@/pages/judgments'));
const TasksPage = React.lazy(() => import('@/pages/tasks'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden flex-col md:flex-row" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:block">
        <Sidebar />
      </aside>

      {/* Mobile Top Header & Drawer */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card shrink-0 gap-2" dir="rtl">
        <div className="flex items-center gap-2 min-w-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent shrink-0"
                aria-label="فتح القائمة الجانبية"
                data-testid="button-mobile-menu-trigger"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="p-0 w-72 border-none bg-transparent shadow-2xl">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xs truncate">إدارة الجلسات</span>
          </div>
        </div>

        <div className="w-36 sm:w-48">
          <GlobalSearch className="bg-muted text-foreground border-border hover:bg-accent" />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-background">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex h-full items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function AdminRedirect() {
  const { data: user, isLoading } = useGetCurrentUser();
  if (isLoading) return null;
  if ((user as any)?.role === 'super_admin') return <Redirect to="/super-admin" />;
  if ((user as any)?.role === 'admin') return <Redirect to="/users" />;
  return <Redirect to="/admin/login" />;
}

function Router() {
  return (
    <Switch>
      {/* Staff Login */}
      <Route path="/login">
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
          <LoginPage />
        </Suspense>
      </Route>

      {/* Admin Portal Gateway Login */}
      <Route path="/admin/login">
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
          <AdminLoginPage />
        </Suspense>
      </Route>

      {/* Super Admin Portal (Platform Management) */}
      <Route path="/super-admin">
        <SuperAdminGuard>
          <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <SuperAdminPage />
          </Suspense>
        </SuperAdminGuard>
      </Route>

      {/* Office Members (Admin Only) */}
      <Route path="/users">
        <AdminGuard>
          <AppShell>
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <OfficeMembersPage />
            </Suspense>
          </AppShell>
        </AdminGuard>
      </Route>

      {/* Dynamic /admin redirect based on role */}
      <Route path="/admin">
        <AdminRedirect />
      </Route>

      {/* Staff Workspace Pages */}
      <Route path="/">
        <AuthGuard>
          <AppShell>
            <DashboardPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/chat">
        <AuthGuard>
          <AppShell>
            <ChatPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/sessions">
        <AuthGuard>
          <AppShell>
            <SessionsPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/sessions/:id">
        <AuthGuard>
          <AppShell>
            <SessionDetailPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/settings">
        <RequireRole roles={['admin']}>
          <AppShell>
            <SettingsPage />
          </AppShell>
        </RequireRole>
      </Route>
      <Route path="/subscription">
        <RequireRole roles={['admin']}>
          <AppShell>
            <SubscriptionPage />
          </AppShell>
        </RequireRole>
      </Route>
      <Route path="/reports">
        <AuthGuard>
          <AppShell>
            <ReportsPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/reports/:id">
        <AuthGuard>
          <AppShell>
            <SessionReportPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/poa">
        <AuthGuard>
          <AppShell>
            <PoaPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/judgments">
        <AuthGuard>
          <AppShell>
            <JudgmentsPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route path="/tasks">
        <AuthGuard>
          <AppShell>
            <TasksPage />
          </AppShell>
        </AuthGuard>
      </Route>
      <Route>
        <Suspense fallback={<div />}>
          <NotFound />
        </Suspense>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
