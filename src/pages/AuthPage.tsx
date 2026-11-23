import React, { useState } from 'react';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-react';
import { useKabmeet } from '../context/KabmeetContext';
import { KabmeetSignalPrism } from '../components/KabmeetLoader';

export function AuthPage() {
  const { adminConfigured, login, register, claimAdmin, navigate } = useKabmeet();
  const [tab, setTab] = useState<'login' | 'register' | 'claim'>(
    adminConfigured ? 'login' : 'claim',
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [universityId, setUniversityId] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(email, password);
      } else if (tab === 'register') {
        await register({
          email,
          fullName,
          universityId: universityId.trim() || undefined,
          department: department.trim() || undefined,
          password,
        });
      } else {
        await claimAdmin({
          email: email.trim() || 'admin@ai.kab.ac.ug',
          fullName: fullName.trim() || 'Grace Tumusiime',
          password,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-kab-blue dark:text-signal-green">
            Kabale University · ai.kab.ac.ug/indabax
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">
            {tab === 'claim'
              ? 'Claim Admin Account'
              : tab === 'register'
                ? 'Join Kabmeet'
                : 'Sign in to Kabmeet'}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {tab === 'claim'
              ? 'First-run setup: set the administrator password to manage roles, communities, and classes.'
              : 'One account for IndabaX sessions, KAB AI workshops, and virtual classes.'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="mb-6 flex flex-wrap gap-1.5 rounded-xl bg-background p-1">
          {!adminConfigured && (
            <button
              type="button"
              onClick={() => {
                setTab('claim');
                setError(null);
              }}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                tab === 'claim'
                  ? 'bg-sun-yellow text-night-forest'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              <span>Setup Admin</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === 'login'
                ? 'bg-indaba-deep-green text-white'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Sign in</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === 'register'
                ? 'bg-indaba-deep-green text-white'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Register</span>
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-live-red/40 bg-live-red/10 px-4 py-3 text-xs font-medium text-live-red"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(tab === 'register' || tab === 'claim') && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-medium text-foreground">
                Full name
              </label>
              <input
                id="auth-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={tab === 'claim' ? 'Grace Tumusiime' : 'e.g. Brenda Natukunda'}
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-medium text-foreground">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={tab === 'claim' ? 'admin@ai.kab.ac.ug' : 'you@kab.ac.ug'}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
            />
          </div>

          {tab === 'register' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="auth-univ-id" className="block text-xs font-medium text-foreground">
                  University ID (optional)
                </label>
                <input
                  id="auth-univ-id"
                  type="text"
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                  placeholder="2025/BCS/104"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
                />
              </div>
              <div>
                <label htmlFor="auth-dept" className="block text-xs font-medium text-foreground">
                  Department
                </label>
                <input
                  id="auth-dept"
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Computer Science"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-foreground">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-signal-green text-xs font-semibold uppercase tracking-[0.08em] text-night-forest transition-transform duration-150 hover:brightness-95 active:scale-[0.98] disabled:opacity-70"
          >
            {submitting && <KabmeetSignalPrism size="xs" label="Signing in" />}
            <span>
              {submitting
                ? 'Please wait...'
                : tab === 'claim'
                  ? 'Claim Admin & Continue'
                  : tab === 'register'
                    ? 'Create Member Account'
                    : 'Sign in'}
            </span>
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
          <span>Just browsing public sessions?</span>
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="font-medium text-kab-blue hover:underline dark:text-signal-green"
          >
            Back to Discover
          </button>
        </div>
      </div>
    </div>
  );
}
