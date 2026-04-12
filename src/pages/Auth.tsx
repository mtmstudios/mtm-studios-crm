import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        toast.success("Erfolgreich angemeldet");
      } else {
        await signUp(email, password);
        toast.success("Konto erstellt! Bitte bestätige deine E-Mail.");
      }
    } catch (err: any) {
      toast.error(err.message || "Fehler bei der Anmeldung");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-2">MTM CRM</h1>
          <p className="text-secondary-foreground text-sm">
            {isLogin ? "Melde dich an, um fortzufahren" : "Erstelle ein neues Konto"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-card border-border rounded-md"
          />
          <Input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="bg-card border-border rounded-md"
          />
          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
            {loading ? "Laden..." : isLogin ? "Anmelden" : "Registrieren"}
          </Button>
        </form>

        <p className="text-center text-sm text-secondary-foreground mt-4">
          {isLogin ? "Noch kein Konto?" : "Bereits registriert?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
            {isLogin ? "Registrieren" : "Anmelden"}
          </button>
        </p>
      </div>
    </div>
  );
}
