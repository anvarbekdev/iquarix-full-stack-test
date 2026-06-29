// Thin proxy to the backend.  Runs server-side at request time so
// BACKEND_URL is always the runtime env value (not baked at build time).
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: RouteContext, method: string): Promise<NextResponse> {
  const { path } = await ctx.params;
  const search = req.nextUrl.search;
  const url = `${BACKEND}/api/${path.join('/')}${search}`;

  try {
    const init: RequestInit = { method, cache: 'no-store' };
    if (method === 'POST') {
      init.headers = { 'Content-Type': 'application/json' };
      init.body = await req.text();
    }
    const res = await fetch(url, init);
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 });
  }
}

export function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx, 'GET');
}

export function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, ctx, 'POST');
}
