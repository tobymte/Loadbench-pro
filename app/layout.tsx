import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LoadBench Pro',
  description:
    'Safety-first reloading notebook. LoadBench Pro records what you do and the published source you cite — it does not recommend loads.',
};

// TODO(auth): wrap children with <ClerkProvider> once Clerk keys are configured.
// import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
