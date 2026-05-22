import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-400">LoadBench Pro</p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Access your private reloading notebook.
          </p>
        </div>
        <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
      </div>
    </main>
  );
}
