import { auth, currentUser } from '@clerk/nextjs/server';

export type AdminCheckResult = {
  isAdmin: boolean;
  email: string | null;
  // True when admin gating is satisfied by the local-dev fallback rather
  // than a matching Clerk email — surfaces this in the UI so an operator
  // can tell production gating from local scaffolding.
  viaLocalDevFallback: boolean;
  // Human-readable explanation when isAdmin === false; null when isAdmin.
  reason: string | null;
};

// Parse the comma-separated LOADBENCH_ADMIN_EMAILS env var. Trims, lowercases,
// drops blanks. Returns an empty array when the env var is unset.
export function getAdminEmails(): string[] {
  const raw = process.env.LOADBENCH_ADMIN_EMAILS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

// Check whether the current Clerk user is in the configured admin list.
//
// When LOADBENCH_DISABLE_AUTH=true (local scaffolding) the check returns
// admin = true with viaLocalDevFallback = true so a developer can exercise
// the admin UI before Clerk is wired up. In production builds, where
// LOADBENCH_DISABLE_AUTH is unset, this fallback never fires.
export async function getAdminContext(): Promise<AdminCheckResult> {
  const adminEmails = getAdminEmails();

  if (process.env.LOADBENCH_DISABLE_AUTH === 'true') {
    return {
      isAdmin: true,
      email: 'dev-admin@loadbench.local',
      viaLocalDevFallback: true,
      reason: null,
    };
  }

  const { userId } = await auth();
  if (!userId) {
    return {
      isAdmin: false,
      email: null,
      viaLocalDevFallback: false,
      reason: 'UNAUTHENTICATED',
    };
  }

  if (adminEmails.length === 0) {
    return {
      isAdmin: false,
      email: null,
      viaLocalDevFallback: false,
      reason:
        'LOADBENCH_ADMIN_EMAILS is not set. Add a comma-separated list of admin emails to enable manual entitlement controls.',
    };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  if (!email) {
    return {
      isAdmin: false,
      email: null,
      viaLocalDevFallback: false,
      reason: 'No primary email on the authenticated Clerk user.',
    };
  }

  if (!adminEmails.includes(email)) {
    return {
      isAdmin: false,
      email,
      viaLocalDevFallback: false,
      reason: `${email} is not in LOADBENCH_ADMIN_EMAILS.`,
    };
  }

  return {
    isAdmin: true,
    email,
    viaLocalDevFallback: false,
    reason: null,
  };
}
