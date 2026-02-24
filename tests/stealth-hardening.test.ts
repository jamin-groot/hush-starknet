import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeSpendableWei,
  hasPositiveReceiverDelta,
  pickTransferAmountWei,
} from '@/lib/stealth-claim-utils';
import {
  createWalletAuthChallenge,
  signWalletChallengeToken,
  signWalletSessionToken,
  verifyWalletChallengeToken,
  verifyWalletSessionToken,
} from '@/lib/auth-session';
import { getRpcUrlCandidates } from '@/lib/rpc-router';

describe('stealth claim fee math', () => {
  it('computes spendable amount with deploy+transfer fees and safety buffer', () => {
    const spendable = computeSpendableWei({
      balanceWei: 1_000_000_000_000_000_000n,
      deployFeeWei: 10_000_000_000_000_000n,
      transferFeeWei: 3_000_000_000_000_000n,
      safetyBufferWei: 2_000_000_000_000_000n,
    });
    expect(spendable).toBe(985_000_000_000_000_000n);
  });

  it('caps transfer amount by spendable', () => {
    expect(pickTransferAmountWei(5n, 3n)).toBe(3n);
    expect(pickTransferAmountWei(2n, 3n)).toBe(2n);
  });

  it('checks positive receiver delta', () => {
    expect(hasPositiveReceiverDelta(100n, 101n)).toBe(true);
    expect(hasPositiveReceiverDelta(100n, 100n)).toBe(false);
  });
});

describe('rpc router configuration', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STARKNET_RPC_URL = 'https://primary-rpc.example';
    process.env.NEXT_PUBLIC_STARKNET_RPC_FALLBACKS =
      'https://fallback1.example, https://fallback2.example';
  });

  it('builds ordered unique RPC candidates', () => {
    const urls = getRpcUrlCandidates();
    expect(urls).toEqual([
      'https://primary-rpc.example',
      'https://fallback1.example',
      'https://fallback2.example',
    ]);
  });
});

describe('wallet auth tokens', () => {
  beforeEach(() => {
    process.env.HUSH_AUTH_SECRET = 'test-secret-value-for-hush-auth';
  });

  it('round-trips challenge token', async () => {
    const challenge = createWalletAuthChallenge('0xabc');
    const token = await signWalletChallengeToken(challenge);
    const decoded = await verifyWalletChallengeToken(token);
    expect(decoded.walletAddress).toBe('0xabc');
    expect(decoded.nonce).toBe(challenge.nonce);
  });

  it('round-trips session token', async () => {
    const token = await signWalletSessionToken('0xabc');
    const decoded = await verifyWalletSessionToken(token);
    expect(decoded.walletAddress).toBe('0xabc');
  });
});

