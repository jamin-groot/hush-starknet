import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { TypedData } from 'starknet';

const CHALLENGE_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_COOKIE_NAME = 'hush_session';

const normalizeAddress = (value: string): string => value.trim().toLowerCase();

const getAuthSecret = (): Uint8Array => {
  const value = process.env.HUSH_AUTH_SECRET;
  if (!value) {
    throw new Error('Missing HUSH_AUTH_SECRET.');
  }
  return new TextEncoder().encode(value);
};

export interface WalletAuthChallengePayload {
  walletAddress: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

interface WalletSessionPayload {
  walletAddress: string;
  issuedAt: number;
}

export const buildWalletAuthTypedData = (
  payload: WalletAuthChallengePayload
): TypedData => ({
  types: {
    StarknetDomain: [
      { name: 'name', type: 'shortstring' },
      { name: 'version', type: 'shortstring' },
      { name: 'chainId', type: 'shortstring' },
    ],
    WalletAuth: [
      { name: 'wallet', type: 'ContractAddress' },
      { name: 'nonce', type: 'felt' },
      { name: 'issuedAt', type: 'felt' },
      { name: 'expiresAt', type: 'felt' },
    ],
  },
  primaryType: 'WalletAuth',
  domain: {
    name: 'HushPrivacyAuth',
    version: '1',
    chainId: 'SN_SEPOLIA',
  },
  message: {
    wallet: payload.walletAddress,
    nonce: payload.nonce,
    issuedAt: `${payload.issuedAt}`,
    expiresAt: `${payload.expiresAt}`,
  },
});

export const createWalletAuthChallenge = (walletAddress: string): WalletAuthChallengePayload => {
  const now = Math.floor(Date.now() / 1000);
  return {
    walletAddress: normalizeAddress(walletAddress),
    nonce: `0x${randomBytes(16).toString('hex')}`,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_SECONDS,
  };
};

export const signWalletChallengeToken = async (
  payload: WalletAuthChallengePayload
): Promise<string> => {
  return await new SignJWT({
    walletAddress: payload.walletAddress,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(payload.issuedAt)
    .setExpirationTime(payload.expiresAt)
    .sign(getAuthSecret());
};

export const verifyWalletChallengeToken = async (
  token: string
): Promise<WalletAuthChallengePayload> => {
  const { payload } = await jwtVerify(token, getAuthSecret());
  const walletAddress = String(payload.walletAddress ?? '');
  const nonce = String(payload.nonce ?? '');
  const issuedAt = Number(payload.issuedAt ?? payload.iat ?? 0);
  const expiresAt = Number(payload.expiresAt ?? payload.exp ?? 0);
  if (!walletAddress || !nonce || !issuedAt || !expiresAt) {
    throw new Error('Invalid auth challenge token');
  }
  if (Math.floor(Date.now() / 1000) > expiresAt) {
    throw new Error('Auth challenge expired');
  }
  return { walletAddress: normalizeAddress(walletAddress), nonce, issuedAt, expiresAt };
};

export const signWalletSessionToken = async (walletAddress: string): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ walletAddress: normalizeAddress(walletAddress) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .sign(getAuthSecret());
};

export const verifyWalletSessionToken = async (token: string): Promise<WalletSessionPayload> => {
  const { payload } = await jwtVerify(token, getAuthSecret());
  const walletAddress = String(payload.walletAddress ?? '');
  const issuedAt = Number(payload.iat ?? 0);
  if (!walletAddress) {
    throw new Error('Invalid wallet session');
  }
  return { walletAddress: normalizeAddress(walletAddress), issuedAt };
};

const getCookieFromHeader = (cookieHeader: string | null, key: string): string | null => {
  if (!cookieHeader) {
    return null;
  }
  const parts = cookieHeader.split(';').map((entry) => entry.trim());
  const matched = parts.find((entry) => entry.startsWith(`${key}=`));
  if (!matched) {
    return null;
  }
  return matched.slice(key.length + 1);
};

export const getWalletSessionFromRequest = async (
  request: Request
): Promise<WalletSessionPayload | null> => {
  const sessionToken = getCookieFromHeader(request.headers.get('cookie'), SESSION_COOKIE_NAME);
  if (!sessionToken) {
    return null;
  }
  try {
    return await verifyWalletSessionToken(sessionToken);
  } catch {
    return null;
  }
};

export const walletSessionCookieName = SESSION_COOKIE_NAME;

