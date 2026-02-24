import { NextResponse } from 'next/server';
import type { Signature } from 'starknet';
import {
  buildWalletAuthTypedData,
  signWalletSessionToken,
  verifyWalletChallengeToken,
  walletSessionCookieName,
} from '@/lib/auth-session';
import { selectRpcProvider } from '@/lib/rpc-router';
import { consumeAuthChallenge } from '@/lib/auth-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      challengeToken?: string;
      signature?: Signature;
      walletAddress?: string;
    };

    if (!body.challengeToken || !body.signature || !body.walletAddress) {
      return NextResponse.json(
        { error: 'challengeToken, walletAddress and signature are required' },
        { status: 400 }
      );
    }

    const challenge = await verifyWalletChallengeToken(body.challengeToken);
    if (challenge.walletAddress !== body.walletAddress.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Wallet address mismatch' }, { status: 401 });
    }
    const typedData = buildWalletAuthTypedData(challenge);
    const { provider } = await selectRpcProvider();
    const valid = await provider.verifyMessageInStarknet(
      typedData,
      body.signature,
      challenge.walletAddress
    );

    if (!valid) {
      return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
    }
    const consumed = await consumeAuthChallenge({
      walletAddress: challenge.walletAddress,
      nonce: challenge.nonce,
    });
    if (!consumed) {
      return NextResponse.json({ error: 'Challenge expired or already used' }, { status: 401 });
    }

    const sessionToken = await signWalletSessionToken(challenge.walletAddress);
    const response = NextResponse.json({ ok: true, walletAddress: challenge.walletAddress });
    response.cookies.set(walletSessionCookieName, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to verify wallet session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

