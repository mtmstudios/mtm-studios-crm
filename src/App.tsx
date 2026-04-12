import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
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
import BookingPage from "@/pages/BookingPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public booking page - outside AppLayout */}
            <Route path="/book/:slug" element={<BookingPage />} />
            {/* App routes */}
            <Route path="/*" element={
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
                  <Route path="/activities" element={<ActivityList />} />
                  <Route path="/voice-leads" element={<VoiceLeads />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            } />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
