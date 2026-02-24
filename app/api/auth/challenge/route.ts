import { NextResponse } from 'next/server';
import {
  buildWalletAuthTypedData,
  createWalletAuthChallenge,
  signWalletChallengeToken,
} from '@/lib/auth-session';
import { persistAuthChallenge } from '@/lib/auth-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim().toLowerCase();
    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const challenge = createWalletAuthChallenge(walletAddress);
    await persistAuthChallenge({
      walletAddress: challenge.walletAddress,
      nonce: challenge.nonce,
      expiresAtEpochSeconds: challenge.expiresAt,
    });
    const challengeToken = await signWalletChallengeToken(challenge);
    const typedData = buildWalletAuthTypedData(challenge);

    return NextResponse.json({
      challengeToken,
      typedData,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to create auth challenge',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

