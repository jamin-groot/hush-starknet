import { NextResponse } from 'next/server';
import {
  getMessagesForWalletPage,
  getMessagesForRecipientPage,
  saveEncryptedMessage,
  updateEncryptedMessage,
} from '@/lib/privacy-store';
import { getWalletSessionFromRequest } from '@/lib/auth-session';
import { checkRateLimit } from '@/lib/rate-limit';

interface MessageBody {
  id?: string;
  txHash?: string;
  kind?: 'payment_note' | 'chat' | 'request';
  requestId?: string;
  paidTxHash?: string;
  amount?: string;
  status?: 'pending' | 'paid' | 'expired' | 'rejected';
  expiresAt?: number;
  isStealth?: boolean;
  stealthAddress?: string;
  claimStatus?: 'pending' | 'claimable' | 'claimed' | 'failed';
  claimTxHash?: string;
  stealthDeployTxHash?: string;
  stealthSalt?: string;
  stealthClassHash?: string;
  stealthPublicKey?: string;
  derivationTag?: string;
  payload?: unknown;
  createdAt?: number;
}

export async function GET(request: Request) {
  try {
    const session = await getWalletSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get('recipient')?.trim().toLowerCase();
    const includeSent = searchParams.get('includeSent') === 'true';
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;

    if (!recipient) {
      return NextResponse.json({ error: 'recipient is required' }, { status: 400 });
    }
    if (recipient !== session.walletAddress) {
      return NextResponse.json({ error: 'Recipient does not match authenticated wallet' }, { status: 403 });
    }

    const page = includeSent
      ? await getMessagesForWalletPage(recipient, { includeSent: true, cursor, limit })
      : await getMessagesForRecipientPage(recipient, { cursor, limit });
    return NextResponse.json({ messages: page.messages, nextCursor: page.nextCursor });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request, 'privacy:messages:post', 30, 60_000);
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
    const body = (await request.json()) as MessageBody;
    const payloadMeta =
      body.payload && typeof body.payload === 'object'
        ? ((body.payload as { meta?: { type?: 'payment_note' | 'chat' | 'request' } }).meta ?? undefined)
        : undefined;

    if (!body.payload) {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 });
    }
    const senderAddress =
      body.payload && typeof body.payload === 'object'
        ? (body.payload as { senderAddress?: string }).senderAddress?.trim().toLowerCase()
        : null;
    if (!senderAddress || senderAddress !== session.walletAddress) {
      return NextResponse.json({ error: 'Sender does not match authenticated wallet' }, { status: 403 });
    }

    await saveEncryptedMessage({
      id: body.id ?? `msg-${Date.now()}`,
      txHash: body.txHash,
      kind: body.kind ?? payloadMeta?.type ?? (body.txHash ? 'payment_note' : 'chat'),
      requestId: body.requestId,
      amount: body.amount,
      status: body.status,
      expiresAt: body.expiresAt,
      paidTxHash: body.paidTxHash,
      isStealth: body.isStealth,
      stealthAddress: body.stealthAddress,
      claimStatus: body.claimStatus,
      claimTxHash: body.claimTxHash,
      stealthDeployTxHash: body.stealthDeployTxHash,
      stealthSalt: body.stealthSalt,
      stealthClassHash: body.stealthClassHash,
      stealthPublicKey: body.stealthPublicKey,
      derivationTag: body.derivationTag,
      payload: body.payload,
      createdAt: typeof body.createdAt === 'number' ? body.createdAt : Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const rate = checkRateLimit(request, 'privacy:messages:patch', 60, 60_000);
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
    const body = (await request.json()) as MessageBody;

    if (!body.id && !body.requestId) {
      return NextResponse.json({ error: 'id or requestId is required' }, { status: 400 });
    }

    const updated = await updateEncryptedMessage(
      { id: body.id, requestId: body.requestId },
      {
        status: body.status,
        paidTxHash: body.paidTxHash,
        txHash: body.txHash,
        expiresAt: body.expiresAt,
        claimStatus: body.claimStatus,
        claimTxHash: body.claimTxHash,
        stealthDeployTxHash: body.stealthDeployTxHash,
      }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
