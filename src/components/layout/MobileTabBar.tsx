import { NavLink } from 'react-router-dom';
import { Building2, CheckSquare, Handshake, LayoutDashboard, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Feste Navigationsleiste am unteren Rand — der Daumen erreicht sie, ohne
 * dass die Hand umgreifen muss. Bewusst nur fünf Ziele: mehr wird auf einem
 * Telefon zur Ratefläche. Alles Übrige liegt weiter im Seitenmenü.
 */
const ZIELE = [
  { to: '/', label: 'Übersicht', icon: LayoutDashboard, end: true },
  { to: '/kontakte', label: 'Kontakte', icon: Users },
  { to: '/deals', label: 'Deals', icon: Handshake },
  { to: '/firmen', label: 'Firmen', icon: Building2 },
  { to: '/aufgaben', label: 'Aufgaben', icon: CheckSquare },
];

export function MobileTabBar() {
  return (
    <nav
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      aria-label="Hauptnavigation"
    >
      <ul className="flex">
        {ZIELE.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  // 56px hoch: über der Mindestgröße für Touch-Ziele
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                  <span className="leading-none">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
