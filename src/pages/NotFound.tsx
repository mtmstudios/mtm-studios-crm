import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-1 text-lg font-semibold">Seite nicht gefunden</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Adresse gibt es nicht (mehr).
        </p>
        <Button className="mt-4" asChild>
          <Link to="/">Zur Übersicht</Link>
        </Button>
      </div>
    </div>
  );
}
