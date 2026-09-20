import { NextResponse } from 'next/server'

/** Deploy identifier for the stale-tab guard — long-lived tabs keep running
 *  the bundle they loaded, which after a redeploy produces dead buttons and
 *  phantom freezes (Round 5 blockers 1 & 2 root cause). */
export async function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID ?? 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
