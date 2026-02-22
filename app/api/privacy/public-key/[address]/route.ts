import { NextResponse } from 'next/server';
import { getPublicKey } from '@/lib/privacy-store';

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { address } = await params;
    const key = await getPublicKey(address);

    if (!key) {
      return NextResponse.json({ error: 'Public key not found' }, { status: 404 });
    }

    return NextResponse.json({ publicKeyJwk: key });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch public key', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
