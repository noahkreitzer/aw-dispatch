import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SITE_PASSWORD = 'aws';
const AUTH_KEY = 'aw-dispatch-auth';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.toLowerCase() === SITE_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setAuthed(true);
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Anthracite Waste Services" className="h-20 w-20 rounded mb-3" />
          <h1 className="font-heading text-xl font-bold">AW DISPATCH</h1>
          <p className="text-sm text-muted-foreground font-mono">Enter password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`font-mono ${error ? 'border-red-500 ring-red-500' : ''}`}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs font-mono">Wrong password</p>}
          <Button type="submit" className="w-full bg-[#F5C400] text-[#1A1A1A] hover:bg-[#F5C400]/90 font-bold">
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
}
