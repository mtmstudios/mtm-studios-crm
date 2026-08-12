import { Suspense, lazy, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
const ProjectList = lazy(() => import('@/pages/projects/ProjectList'));
const ProjectDetail = lazy(() => import('@/pages/projects/ProjectDetail'));
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
/**
 * Ein angemeldetes, aber noch nicht freigeschaltetes Konto sieht wegen RLS
 * überall nichts. Ohne diesen Hinweis wirkte das wie ein kaputtes CRM statt
 * wie eine ausstehende Freigabe.
 */
function WartetAufFreischaltung() {
  const { profile, signOut } = useAuth();
  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Clock className="h-5 w-5" />
        </span>
        <h1 className="text-lg font-semibold">Konto wartet auf Freischaltung</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile?.email} ist angelegt, aber noch nicht freigegeben. Ein Administrator
          schaltet den Zugang unter{' '}
          <span className="whitespace-nowrap">Einstellungen → Team</span> frei.
        </p>
        <Button variant="outline" size="sm" className="mt-5" onClick={() => void signOut()}>
          Abmelden
        </Button>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/anmelden" state={{ from: location }} replace />;
  // profile ist während des Nachladens null — das deckt bereits loading ab
  if (profile && !profile.is_active) return <WartetAufFreischaltung />;
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
            <Route path="/projekte" element={<ProjectList />} />
            <Route path="/projekte/:id" element={<ProjectDetail />} />
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
