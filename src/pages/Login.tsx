import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'anmelden' | 'registrieren';

/** Supabase-Fehlermeldungen sind englisch — die häufigsten übersetzen. */
function translate(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-Mail-Adresse oder Passwort ist falsch.',
    'Email not confirmed': 'Bitte zuerst die E-Mail-Adresse bestätigen.',
    'User already registered': 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
    'Password should be at least 6 characters':
      'Das Passwort muss mindestens 6 Zeichen lang sein.',
  };
  return map[message] ?? message;
}

export default function Login() {
  const { session, loading, signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('anmelden');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'anmelden') {
        await signIn(email, password);
      } else {
        await signUp(email, password, fullName);
        toast.success('Konto angelegt. Bitte E-Mail-Postfach prüfen.');
      }
    } catch (err) {
      toast.error(translate((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      toast.error('Bitte zuerst die E-Mail-Adresse eintragen.');
      return;
    }
    try {
      await resetPassword(email);
      toast.success('Wenn ein Konto existiert, ist eine E-Mail unterwegs.');
    } catch (err) {
      toast.error(translate((err as Error).message));
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
            C
          </span>
          <span className="text-lg font-semibold tracking-tight">CRM</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="anmelden">Anmelden</TabsTrigger>
              <TabsTrigger value="registrieren">Registrieren</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <TabsContent value="registrieren" className="mt-0 space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={mode === 'registrieren'}
                  autoComplete="name"
                />
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Passwort</Label>
                  {mode === 'anmelden' && (
                    <button
                      type="button"
                      onClick={forgot}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Vergessen?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete={mode === 'anmelden' ? 'current-password' : 'new-password'}
                />
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'anmelden' ? 'Anmelden' : 'Konto anlegen'}
              </Button>
            </form>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
