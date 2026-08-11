import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/crm/primitives';
import TeamSettings from './TeamSettings';
import PipelineSettings from './PipelineSettings';
import BookingSettings from './BookingSettings';

const TABS = [
  { to: 'team', label: 'Team' },
  { to: 'pipelines', label: 'Pipelines' },
  { to: 'buchung', label: 'Buchungsseite' },
];

export default function Settings() {
  return (
    <>
      <PageHeader title="Einstellungen" />

      <div className="border-b border-border px-4 sm:px-6">
        <nav className="-mb-px flex gap-4 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        <Routes>
          <Route index element={<Navigate to="team" replace />} />
          <Route path="team" element={<TeamSettings />} />
          <Route path="pipelines" element={<PipelineSettings />} />
          <Route path="buchung" element={<BookingSettings />} />
        </Routes>
      </div>
    </>
  );
}
