import { useState, type FormEvent } from 'react';
import { authErrorMessage, useAuth } from '@/context/AuthContext';
import { Button, Field, Input } from '@/components/ui';

type Mode = 'signin' | 'signup' | 'reset';

export function Login() {
  const { signInEmail, signUpEmail, signInGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signin') await signInEmail(email, password);
      else if (mode === 'signup') { if (password.length < 8) throw Object.assign(new Error(), { code: 'auth/weak-password' }); await signUpEmail(email, password); }
      else { await resetPassword(email); setMsg({ text: 'If an account uses this email, a reset link is on its way.', tone: 'ok' }); }
    } catch (err) { setMsg({ text: authErrorMessage(err), tone: 'error' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10">
            <svg viewBox="0 0 32 32" className="size-7" aria-hidden><rect width="32" height="32" rx="7" fill="rgb(var(--accent))" /><rect x="7" y="17" width="4" height="8" rx="1" fill="white" /><rect x="14" y="12" width="4" height="13" rx="1" fill="white" /><rect x="21" y="7" width="4" height="18" rx="1" fill="white" /></svg>
            <span className="font-semibold tracking-[-0.01em]">Career Intel</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h1>
          <p className="text-sm text-muted mt-1.5">{mode === 'reset' ? 'We’ll email you a link to choose a new password.' : 'Your private job search workspace.'}</p>

          {mode !== 'reset' && (
            <>
              <Button className="w-full mt-8" onClick={async () => { setMsg(null); try { await signInGoogle(); } catch (err) { setMsg({ text: authErrorMessage(err), tone: 'error' }); } }}>
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 9.9L5.8 14Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>
                Continue with Google
              </Button>
              <div className="flex items-center gap-3 my-6 text-xs text-faint"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4 mt-6">
            <Field label="Email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            {mode !== 'reset' && (
              <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
                <Input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
            {msg && <p role="alert" className={msg.tone === 'error' ? 'text-sm text-bad' : 'text-sm text-good'}>{msg.text}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</Button>
          </form>

          <div className="mt-6 text-sm text-muted space-y-1.5">
            {mode === 'signin' && <><button className="link" onClick={() => setMode('reset')}>Forgot password?</button><p>New here? <button className="link" onClick={() => setMode('signup')}>Create an account</button></p></>}
            {mode !== 'signin' && <p><button className="link" onClick={() => setMode('signin')}>Back to sign in</button></p>}
          </div>
        </div>
      </div>
      <div className="hidden lg:flex flex-col justify-center border-l border-line bg-surface px-16">
        <div className="max-w-md">
          <p className="text-[1.75rem] leading-[1.25] font-semibold tracking-[-0.02em]">Every vacancy checked against the employer’s own listing. Every score traceable to your resume.</p>
          <div className="mt-10 space-y-5">
            {[
              ['Verified openings', 'Jobs are confirmed on the company’s careers board, and closed listings drop out of your feed automatically.'],
              ['Sponsorship read from the posting', 'Each international role is classified from what the employer actually wrote about visas.'],
              ['Honest match scores', 'Six weighted components, each with the evidence behind it. No inflated numbers.'],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3"><span className="mt-2 size-1.5 rounded-full bg-accent shrink-0" /><div><p className="text-sm font-medium">{t}</p><p className="text-sm text-muted mt-0.5">{d}</p></div></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
