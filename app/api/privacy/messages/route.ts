import { NextResponse } from 'next/server';
import { getMessagesForRecipient, saveEncryptedMessage } from '@/lib/privacy-store';

interface MessageBody {
  txHash?: string;
  payload?: unknown;
  createdAt?: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recipient = searchParams.get('recipient')?.trim().toLowerCase();

    if (!recipient) {
      return NextResponse.json({ error: 'recipient is required' }, { status: 400 });
    }

    const messages = await getMessagesForRecipient(recipient);
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

    if (!body.txHash || !body.payload) {
      return NextResponse.json({ error: 'txHash and payload are required' }, { status: 400 });
    }

    await saveEncryptedMessage({
      txHash: body.txHash,
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
