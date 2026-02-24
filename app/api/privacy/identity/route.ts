import { NextResponse } from 'next/server';
import { getWalletSessionFromRequest } from '@/lib/auth-session';
import { getEncryptedIdentityBackup, upsertEncryptedIdentityBackup } from '@/lib/privacy-store';
import { checkRateLimit } from '@/lib/rate-limit';

interface IdentityBody {
  walletAddress?: string;
  encryptedBlob?: string;
  nonce?: string;
  algorithm?: string;
  version?: number;
}

export async function GET(request: Request) {
  try {
    const session = await getWalletSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const backup = await getEncryptedIdentityBackup(session.walletAddress);
    return NextResponse.json({ backup });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch encrypted identity backup',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, 'privacy:identity:post', 10, 60_000);
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

    const body = (await request.json()) as IdentityBody;
    const walletAddress = body.walletAddress?.trim().toLowerCase();
    if (!walletAddress || !body.encryptedBlob || !body.nonce || !body.algorithm) {
      return NextResponse.json(
        { error: 'walletAddress, encryptedBlob, nonce, and algorithm are required' },
        { status: 400 }
      );
    }
    if (walletAddress !== session.walletAddress) {
      return NextResponse.json({ error: 'Wallet does not match authenticated session' }, { status: 403 });
    }
    const existing = await getEncryptedIdentityBackup(walletAddress);
    const sessionAgeSeconds = Math.floor(Date.now() / 1000) - session.issuedAt;
    if (existing && sessionAgeSeconds > 300) {
      return NextResponse.json(
        { error: 'Recent wallet re-authentication required before overwriting identity backup' },
        { status: 401 }
      );
    }

    await upsertEncryptedIdentityBackup({
      walletAddress,
      encryptedBlob: body.encryptedBlob,
      nonce: body.nonce,
      algorithm: body.algorithm,
      version: typeof body.version === 'number' ? body.version : 1,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to store encrypted identity backup',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

