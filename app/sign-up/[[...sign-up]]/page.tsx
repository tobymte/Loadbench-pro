import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-400">LoadBench Pro</p>
          <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-muted">
            Start a private, safety-first load notebook.
          </p>
        </div>
        <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
      </div>
    </main>
  );
}
