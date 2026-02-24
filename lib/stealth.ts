import { CallData, ec, hash } from 'starknet';

export type StealthClaimStatus = 'pending' | 'claimable' | 'claimed' | 'failed';

export interface StealthMetadata {
  stealthAddress: string;
  stealthPrivateKey: string;
  stealthPublicKey: string;
  salt: string;
  classHash: string;
  derivationTag: string;
}

interface StealthEnvelope {
  type: 'stealth_payment';
  amount: string;
  note?: string;
  stealth: StealthMetadata;
}

// OpenZeppelin account class (already declared on Starknet Sepolia).
// You can override this via NEXT_PUBLIC_STEALTH_ACCOUNT_CLASS_HASH.
const DEFAULT_SEPOLIA_ACCOUNT_CLASS_HASH =
  '0x540d7f5ec7ecf317e68d48564934cb99259781b1ee3cedbbc37ec5337f8e688';
const CURVE_ORDER = BigInt(ec.starkCurve.CURVE.n.toString());
const ONE = BigInt(1);

const stripHexPrefix = (value: string): string => value.replace(/^0x/i, '');
const addHexPrefix = (value: string): string => (value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`);

const toHex = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
};

const toBigIntValue = (value: string | bigint | number): bigint => {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    return BigInt(value);
  }
  return BigInt(value);
};

export const normalizeStealthPrivateKey = (value: string | bigint | number): string => {
  const raw = toBigIntValue(value);
  // Normalize by Stark curve order first, then avoid zero scalar.
  let normalized = ((raw % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER;
  if (normalized === BigInt(0)) {
    normalized = ONE;
  }
  const privateKey = addHexPrefix(normalized.toString(16));
  const isValid = ec.starkCurve.utils.isValidPrivateKey(normalized);
  if (!isValid) {
    throw new Error('Derived stealth private key is outside Stark curve range');
  }
  return privateKey;
};

const randomPrivateKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return normalizeStealthPrivateKey(`0x${toHex(bytes)}`);
};

const getStealthClassHash = (): string => {
  const value =
    process.env.NEXT_PUBLIC_STEALTH_ACCOUNT_CLASS_HASH ??
    process.env.STEALTH_ACCOUNT_CLASS_HASH ??
    DEFAULT_SEPOLIA_ACCOUNT_CLASS_HASH;
  return addHexPrefix(value);
};

const toSalt = (value: string): string => {
  const stripped = stripHexPrefix(value);
  const last62 = stripped.slice(-62);
  return addHexPrefix(last62.padStart(62, '0'));
};

export const canUseStealthPayments = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_STEALTH_ACCOUNT_CLASS_HASH ??
      process.env.STEALTH_ACCOUNT_CLASS_HASH ??
      DEFAULT_SEPOLIA_ACCOUNT_CLASS_HASH
  );
};

export function createStealthMetadata(
  senderAddress: string,
  recipientAddress: string
): StealthMetadata {
  const entropySeed = randomPrivateKey();
  const sharedSecret = hash.computePoseidonHashOnElements([
    addHexPrefix(senderAddress),
    addHexPrefix(recipientAddress),
    entropySeed,
  ]);
  const keyMaterial = hash.computePedersenHash(
    addHexPrefix(toBigIntValue(sharedSecret).toString(16)),
    entropySeed
  );
  // sharedSecret -> Stark hash -> mod curve order -> validated private key
  const privateKey = normalizeStealthPrivateKey(keyMaterial);
  const publicKey = addHexPrefix(ec.starkCurve.getStarkKey(privateKey));
  const classHash = getStealthClassHash();
  const saltSeed = hash.computePoseidonHashOnElements([privateKey, publicKey, classHash]);
  const salt = toSalt(addHexPrefix(toBigIntValue(saltSeed).toString(16)));
  const constructorCalldata = CallData.compile({ publicKey });
  const stealthAddress = addHexPrefix(
    hash.calculateContractAddressFromHash(salt, classHash, constructorCalldata, 0)
  );
  const derivationTag = addHexPrefix(
    hash.computePedersenHashOnElements([
      addHexPrefix(senderAddress),
      addHexPrefix(recipientAddress),
      salt,
    ])
  );

  return {
    stealthAddress,
    stealthPrivateKey: privateKey,
    stealthPublicKey: publicKey,
    salt,
    classHash,
    derivationTag,
  };
}

export function buildStealthMessageBody(params: {
  amount: string;
  note?: string;
  stealth: StealthMetadata;
}): string {
  const payload: StealthEnvelope = {
    type: 'stealth_payment',
    amount: params.amount,
    note: params.note?.trim() || undefined,
    stealth: params.stealth,
  };
  return JSON.stringify(payload);
}

export function parseStealthMessageBody(value: string): StealthEnvelope | null {
  try {
    const parsed = JSON.parse(value) as Partial<StealthEnvelope>;
    if (!parsed || parsed.type !== 'stealth_payment') {
      return null;
    }
    if (!parsed.stealth?.stealthAddress || !parsed.stealth?.stealthPrivateKey) {
      return null;
    }
    if (
      typeof parsed.stealth.stealthPublicKey !== 'string' ||
      typeof parsed.stealth.salt !== 'string' ||
      typeof parsed.stealth.classHash !== 'string' ||
      typeof parsed.stealth.derivationTag !== 'string'
    ) {
      return null;
    }
    const normalizedPrivateKey = normalizeStealthPrivateKey(parsed.stealth.stealthPrivateKey);
    const normalizedStealth: StealthMetadata = {
      stealthAddress: addHexPrefix(parsed.stealth.stealthAddress),
      stealthPrivateKey: normalizedPrivateKey,
      stealthPublicKey: addHexPrefix(parsed.stealth.stealthPublicKey),
      salt: addHexPrefix(parsed.stealth.salt),
      classHash: addHexPrefix(parsed.stealth.classHash),
      derivationTag: addHexPrefix(parsed.stealth.derivationTag),
    };
    if (!parsed.amount || typeof parsed.amount !== 'string') {
      return null;
    }
    return {
      type: 'stealth_payment',
      amount: parsed.amount,
      note: parsed.note,
      stealth: normalizedStealth,
    };
  } catch {
    return null;
  }
}
