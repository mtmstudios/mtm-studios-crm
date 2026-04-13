import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ContactList from "@/pages/ContactList";
import ContactDetail from "@/pages/ContactDetail";
import CompanyList from "@/pages/CompanyList";
import CompanyDetail from "@/pages/CompanyDetail";
import DealPipeline from "@/pages/DealPipeline";
import DealDetail from "@/pages/DealDetail";
import ActivityList from "@/pages/ActivityList";
import VoiceLeads from "@/pages/VoiceLeads";
import Appointments from "@/pages/Appointments";
import Inbox from "@/pages/Inbox";
import Reputation from "@/pages/Reputation";
import Snapshots from "@/pages/Snapshots";
import ScanImport from "@/pages/ScanImport";
import BookingPage from "@/pages/BookingPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/contacts" element={<ContactList />} />
        <Route path="/contacts/:id" element={<ContactDetail />} />
        <Route path="/companies" element={<CompanyList />} />
        <Route path="/companies/:id" element={<CompanyDetail />} />
        <Route path="/deals" element={<DealPipeline />} />
        <Route path="/deals/:id" element={<DealDetail />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/activities" element={<ActivityList />} />
        <Route path="/voice-leads" element={<VoiceLeads />} />
        <Route path="/reputation" element={<Reputation />} />
        <Route path="/snapshots" element={<Snapshots />} />
        <Route path="/scan" element={<ScanImport />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/book/:slug" element={<BookingPage />} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
