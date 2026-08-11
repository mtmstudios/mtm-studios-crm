import { Suspense, lazy, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import Login from '@/pages/Login';

// Nur die Startseite wird sofort geladen; der Rest kommt beim Aufruf nach.
// Das hält das erste Bundle klein, ohne den Router zu verkomplizieren.
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ContactList = lazy(() => import('@/pages/contacts/ContactList'));
const ContactDetail = lazy(() => import('@/pages/contacts/ContactDetail'));
const CompanyList = lazy(() => import('@/pages/companies/CompanyList'));
const CompanyDetail = lazy(() => import('@/pages/companies/CompanyDetail'));
const DealBoard = lazy(() => import('@/pages/deals/DealBoard'));
const DealDetail = lazy(() => import('@/pages/deals/DealDetail'));
const ActivityList = lazy(() => import('@/pages/activities/ActivityList'));
const Inbox = lazy(() => import('@/pages/inbox/Inbox'));
const Calendar = lazy(() => import('@/pages/calendar/Calendar'));
const Reports = lazy(() => import('@/pages/reports/Reports'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const BookingPage = lazy(() => import('@/pages/public/BookingPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Beim Fensterwechsel nicht alles neu laden — das CRM wird oft
      // parallel zu anderen Programmen benutzt.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Auth- und Berechtigungsfehler nicht wiederholen
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
  },
});

function FullPageSpinner() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Blockiert alles hinter der Anmeldung und merkt sich das Ziel. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/anmelden" state={{ from: location }} replace />;
  return <>{children}</>;
}

function ProtectedRoutes() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kontakte" element={<ContactList />} />
            <Route path="/kontakte/:id" element={<ContactDetail />} />
            <Route path="/firmen" element={<CompanyList />} />
            <Route path="/firmen/:id" element={<CompanyDetail />} />
            <Route path="/deals" element={<DealBoard />} />
            <Route path="/deals/:id" element={<DealDetail />} />
            <Route path="/aufgaben" element={<ActivityList />} />
            <Route path="/posteingang" element={<Inbox />} />
            <Route path="/kalender" element={<Calendar />} />
            <Route path="/berichte" element={<Reports />} />
            <Route path="/einstellungen/*" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Toaster position="top-right" richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<FullPageSpinner />}>
              <Routes>
                <Route path="/anmelden" element={<Login />} />
                {/* Öffentlich: die Buchungsseite darf ohne Konto erreichbar sein */}
                <Route path="/termin/:slug" element={<BookingPage />} />
                <Route path="/*" element={<ProtectedRoutes />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
