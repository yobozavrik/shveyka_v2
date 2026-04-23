export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return new Response(JSON.stringify({ message: 'POST expected' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request) {
  const res = await fetch(new URL('/api/mobile/auth/login', request.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });

  return res;
}
