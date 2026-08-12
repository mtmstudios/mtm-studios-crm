import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  FolderKanban,
  Handshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CommandPalette } from './CommandPalette';
import { MobileTabBar } from './MobileTabBar';

const NAV = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/kontakte', label: 'Kontakte', icon: Users },
  { to: '/firmen', label: 'Firmen', icon: Building2 },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/projekte', label: 'Projekte', icon: FolderKanban },
  { to: '/aufgaben', label: 'Aufgaben', icon: CheckSquare },
  { to: '/posteingang', label: 'Posteingang', icon: Inbox },
  { to: '/kalender', label: 'Kalender', icon: CalendarDays },
  { to: '/berichte', label: 'Berichte', icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  // Navigation schließt das mobile Menü — sonst verdeckt es die Zielseite.
  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Abdunklung hinter dem mobilen Menü */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'pt-safe pb-safe fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0 lg:pt-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              C
            </span>
            CRM
          </NavLink>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="scrollbar-slim flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <NavLink
            to="/einstellungen"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              )
            }
          >
            <Settings className="h-4 w-4" />
            Einstellungen
          </NavLink>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur sm:px-4 lg:pt-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menü öffnen"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Suchen …</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground"
                  aria-label="Benutzermenü"
                >
                  {initials(profile?.full_name ?? profile?.email)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate text-sm font-medium">{profile?.full_name ?? '—'}</div>
                  <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Unten Platz für die Tab-Leiste, damit sie nichts verdeckt */}
        <main className="pb-nav min-w-0 flex-1 lg:pb-0">{children}</main>
      </div>

      <MobileTabBar />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
