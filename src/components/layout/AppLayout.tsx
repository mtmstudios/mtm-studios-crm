import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Building2, Handshake, CalendarCheck, Mic, Calendar, MessageSquare, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/contacts", icon: Users, label: "Kontakte" },
  { to: "/companies", icon: Building2, label: "Unternehmen" },
  { to: "/deals", icon: Handshake, label: "Deals" },
  { to: "/appointments", icon: Calendar, label: "Termine" },
  { to: "/inbox", icon: MessageSquare, label: "Posteingang" },
  { to: "/activities", icon: CalendarCheck, label: "Aktivitäten" },
  { to: "/voice-leads", icon: Mic, label: "Voice Leads" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-background/80 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col transition-transform md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 flex items-center justify-between">
          <span className="text-xl font-bold text-primary tracking-tight">MTM CRM</span>
          <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground border-l-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "")} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground truncate">Benutzer</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center px-4 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-sm font-semibold text-primary">MTM CRM</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
