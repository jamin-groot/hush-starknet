import { NextResponse } from 'next/server';
import { upsertPublicKey } from '@/lib/privacy-store';

interface RegisterKeyBody {
  address?: string;
  publicKeyJwk?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterKeyBody;
    const address = typeof body.address === 'string' ? body.address.trim().toLowerCase() : '';

    if (!address || !body.publicKeyJwk) {
      return NextResponse.json({ error: 'address and publicKeyJwk are required' }, { status: 400 });
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
