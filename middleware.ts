/**
 * Clerk middleware placeholder.
 *
 * The middleware is structured so that swapping in Clerk's `clerkMiddleware`
 * is a one-line change. While LOADBENCH_DISABLE_AUTH === "true" all routes are
 * accessible without auth so the scaffold renders end-to-end.
 *
 * To enable Clerk:
 *   1. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.
 *   2. Set LOADBENCH_DISABLE_AUTH=false.
 *   3. Uncomment the Clerk block below.
 */

import { NextRequest, NextResponse } from 'next/server';

// import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
//
// const isPublicRoute = createRouteMatcher([
//   '/',
//   '/safety',
//   '/sign-in(.*)',
//   '/sign-up(.*)',
//   '/api/health',
// ]);
//
// export default clerkMiddleware((auth, req) => {
//   if (!isPublicRoute(req)) auth().protect();
// });

export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|css|js)$).*)',
    '/(api|trpc)(.*)',
  ],
};
