import { NextResponse } from 'next/server';
import {
  getMessagesForRecipient,
  getMessagesForWallet,
  saveEncryptedMessage,
  updateEncryptedMessage,
} from '@/lib/privacy-store';

interface MessageBody {
  id?: string;
  txHash?: string;
  kind?: 'payment_note' | 'chat' | 'request';
  requestId?: string;
  paidTxHash?: string;
  amount?: string;
  status?: 'pending' | 'paid' | 'expired' | 'rejected';
  expiresAt?: number;
  payload?: unknown;
  createdAt?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get('recipient')?.trim().toLowerCase();
    const includeSent = searchParams.get('includeSent') === 'true';

    if (!recipient) {
      return NextResponse.json({ error: 'recipient is required' }, { status: 400 });
    }

    const messages = includeSent
      ? await getMessagesForWallet(recipient, { includeSent: true })
      : await getMessagesForRecipient(recipient);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load messages', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MessageBody;

    if (!body.payload) {
      return NextResponse.json({ error: 'payload is required' }, { status: 400 });
    }

    await saveEncryptedMessage({
      id: body.id ?? `msg-${Date.now()}`,
      txHash: body.txHash,
      kind: body.kind ?? (body.txHash ? 'payment_note' : 'chat'),
      requestId: body.requestId,
      amount: body.amount,
      status: body.status,
      expiresAt: body.expiresAt,
      paidTxHash: body.paidTxHash,
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
