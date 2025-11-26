import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify cron request authentication
 *
 * Supports two authentication methods:
 * 1. Vercel's automatic cron authentication (Authorization: Bearer <CRON_SECRET>)
 * 2. Manual x-cron-secret header (for testing)
 *
 * @returns true if authenticated, false otherwise
 */
export function verifyCronAuth(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error('CRON_SECRET environment variable not configured');
    return false;
  }

  // Check Vercel's automatic Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token === expectedSecret) {
      return true;
    }
  }

  // Check manual x-cron-secret header (for local testing)
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret === expectedSecret) {
    return true;
  }

  return false;
}

/**
 * Create an unauthorized response for failed cron auth
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or missing cron authentication',
    },
    { status: 401 }
  );
}

/**
 * Wrapper for cron route handlers that handles authentication
 *
 * Usage:
 * ```ts
 * export const GET = withCronAuth(async (request) => {
 *   // Your cron logic here
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withCronAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    if (!verifyCronAuth(request)) {
      return unauthorizedResponse();
    }
    return handler(request);
  };
}
