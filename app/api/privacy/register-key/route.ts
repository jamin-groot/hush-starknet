import { NextResponse } from 'next/server';
import { upsertPublicKey } from '@/lib/privacy-store';
import { getWalletSessionFromRequest } from '@/lib/auth-session';
import { checkRateLimit } from '@/lib/rate-limit';

interface RegisterKeyBody {
  address?: string;
  publicKeyJwk?: unknown;
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, 'privacy:register-key:post', 20, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      );
    }
    const session = await getWalletSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = (await request.json()) as RegisterKeyBody;
    const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';

    if (!address || !body.publicKeyJwk) {
      return NextResponse.json({ error: 'address and publicKeyJwk are required' }, { status: 400 });
    }
    if (address !== session.walletAddress) {
      return NextResponse.json({ error: 'Address does not match authenticated wallet' }, { status: 403 });
    }

    await upsertPublicKey(address, body.publicKeyJwk);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to register key', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
