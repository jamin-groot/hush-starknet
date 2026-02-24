import { getSupabaseServerClient } from '@/lib/supabase-server';

export interface StoredEncryptedMessage {
  id: string;
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
  payload: unknown;
  createdAt: number;
}

const normalizeAddress = (value: string): string => value.trim().toLowerCase();
const generateMessageId = (): string =>
  `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function upsertPublicKey(address: string, publicKeyJwk: unknown): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('privacy_public_keys')
    .upsert(
      {
        address: normalizeAddress(address),
        public_key_jwk: publicKeyJwk,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'address' }
    );
  if (error) {
    throw new Error(`Failed to upsert public key: ${error.message}`);
  }
}

export async function getPublicKey(address: string): Promise<unknown | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('privacy_public_keys')
    .select('public_key_jwk')
    .eq('address', normalizeAddress(address))
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch public key: ${error.message}`);
  }
  return data?.public_key_jwk ?? null;
}

export async function saveEncryptedMessage(message: StoredEncryptedMessage): Promise<void> {
  const normalized: StoredEncryptedMessage = {
    ...message,
    id: message.id || generateMessageId(),
    kind: message.kind ?? 'payment_note',
  };
  const payload =
    normalized.payload && typeof normalized.payload === 'object'
      ? (normalized.payload as Record<string, unknown>)
      : {};
  const senderAddress =
    typeof payload.senderAddress === 'string' ? normalizeAddress(payload.senderAddress) : null;
  const recipientAddress =
    typeof payload.recipientAddress === 'string' ? normalizeAddress(payload.recipientAddress) : null;

  const supabase = getSupabaseServerClient();
  let existingId: string | null = null;
  if (normalized.txHash) {
    const { data: existingByHash, error: hashLookupError } = await supabase
      .from('encrypted_messages')
      .select('id')
      .eq('tx_hash', normalized.txHash)
      .limit(1)
      .maybeSingle();
    if (hashLookupError) {
      throw new Error(`Failed to check existing txHash: ${hashLookupError.message}`);
    }
    existingId = existingByHash?.id ?? null;
  }

  const upsertPayload = {
    id: existingId ?? normalized.id,
    tx_hash: normalized.txHash ?? null,
    kind: normalized.kind ?? null,
    request_id: normalized.requestId ?? null,
    paid_tx_hash: normalized.paidTxHash ?? null,
    amount: normalized.amount ?? null,
    status: normalized.status ?? null,
    expires_at: normalized.expiresAt ?? null,
    is_stealth: normalized.isStealth ?? false,
    stealth_address: normalized.stealthAddress ?? null,
    claim_status: normalized.claimStatus ?? null,
    claim_tx_hash: normalized.claimTxHash ?? null,
    stealth_deploy_tx_hash: normalized.stealthDeployTxHash ?? null,
    stealth_salt: normalized.stealthSalt ?? null,
    stealth_class_hash: normalized.stealthClassHash ?? null,
    stealth_public_key: normalized.stealthPublicKey ?? null,
    derivation_tag: normalized.derivationTag ?? null,
    payload_json: normalized.payload,
    sender_address: senderAddress,
    recipient_address: recipientAddress,
    ephemeral_pubkey: normalized.stealthPublicKey ?? null,
    metadata_json: {
      kind: normalized.kind ?? null,
      requestId: normalized.requestId ?? null,
      txHash: normalized.txHash ?? null,
    },
    created_at: new Date(normalized.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('encrypted_messages').upsert(upsertPayload, {
    onConflict: 'id',
  });
  if (error) {
    throw new Error(`Failed to persist encrypted message: ${error.message}`);
  }
}

export async function updateEncryptedMessage(
  match: { id?: string; requestId?: string },
  updates: Partial<
    Pick<
      StoredEncryptedMessage,
      | 'status'
      | 'paidTxHash'
      | 'txHash'
      | 'expiresAt'
      | 'claimStatus'
      | 'claimTxHash'
      | 'stealthDeployTxHash'
    >
  >
): Promise<StoredEncryptedMessage | null> {
  if (!match.id && !match.requestId) {
    return null;
  }
  const supabase = getSupabaseServerClient();
  const query = supabase.from('encrypted_messages').select('*').limit(1);
  if (match.id) {
    query.eq('id', match.id);
  } else if (match.requestId) {
    query.eq('request_id', match.requestId);
  }
  const { data: current, error: fetchError } = await query.maybeSingle();
  if (fetchError) {
    throw new Error(`Failed to fetch message for update: ${fetchError.message}`);
  }
  if (!current) {
    return null;
  }

  const updatePayload = {
    status: updates.status,
    paid_tx_hash: updates.paidTxHash,
    tx_hash: updates.txHash,
    expires_at: updates.expiresAt,
    claim_status: updates.claimStatus,
    claim_tx_hash: updates.claimTxHash,
    stealth_deploy_tx_hash: updates.stealthDeployTxHash,
    updated_at: new Date().toISOString(),
  };

  const updateQuery = supabase.from('encrypted_messages').update(updatePayload).select('*').limit(1);
  if (match.id) {
    updateQuery.eq('id', match.id);
  } else if (match.requestId) {
    updateQuery.eq('request_id', match.requestId);
  }
  const { data: updated, error: updateError } = await updateQuery.maybeSingle();
  if (updateError) {
    throw new Error(`Failed to update encrypted message: ${updateError.message}`);
  }
  if (!updated) {
    return null;
  }
  return mapRowToMessage(updated);
}

export async function getMessagesForRecipient(recipientAddress: string): Promise<StoredEncryptedMessage[]> {
  const out: StoredEncryptedMessage[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await getMessagesForRecipientPage(recipientAddress, { cursor, limit: 200 });
    out.push(...page.messages);
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
  return out;
}

interface WalletMessageFilters {
  includeSent?: boolean;
}

export async function getMessagesForWallet(
  walletAddress: string,
  filters?: WalletMessageFilters
): Promise<StoredEncryptedMessage[]> {
  const out: StoredEncryptedMessage[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await getMessagesForWalletPage(walletAddress, {
      ...(filters ?? {}),
      cursor,
      limit: 200,
    });
    out.push(...page.messages);
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }
  return out;
}

interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

interface WalletMessagePage {
  messages: StoredEncryptedMessage[];
  nextCursor: string | null;
}

const mapRowToMessage = (row: Record<string, unknown>): StoredEncryptedMessage => ({
  id: String(row.id),
  txHash: (row.tx_hash as string | null) ?? undefined,
  kind: (row.kind as StoredEncryptedMessage['kind'] | null) ?? undefined,
  requestId: (row.request_id as string | null) ?? undefined,
  paidTxHash: (row.paid_tx_hash as string | null) ?? undefined,
  amount: (row.amount as string | null) ?? undefined,
  status: (row.status as StoredEncryptedMessage['status'] | null) ?? undefined,
  expiresAt: (row.expires_at as number | null) ?? undefined,
  isStealth: (row.is_stealth as boolean | null) ?? undefined,
  stealthAddress: (row.stealth_address as string | null) ?? undefined,
  claimStatus: (row.claim_status as StoredEncryptedMessage['claimStatus'] | null) ?? undefined,
  claimTxHash: (row.claim_tx_hash as string | null) ?? undefined,
  stealthDeployTxHash: (row.stealth_deploy_tx_hash as string | null) ?? undefined,
  stealthSalt: (row.stealth_salt as string | null) ?? undefined,
  stealthClassHash: (row.stealth_class_hash as string | null) ?? undefined,
  stealthPublicKey: (row.stealth_public_key as string | null) ?? undefined,
  derivationTag: (row.derivation_tag as string | null) ?? undefined,
  payload: row.payload_json,
  createdAt: new Date(String(row.created_at)).getTime(),
});

const applyPagination = (
  query: {
    lt: (field: string, value: string) => unknown;
    order: (field: string, options: { ascending: boolean }) => unknown;
    limit: (value: number) => unknown;
  },
  cursor: string | undefined,
  limit: number
) => {
  if (cursor) {
    query.lt('created_at', cursor);
  }
  query.order('created_at', { ascending: false }).limit(limit + 1);
};

export async function getMessagesForRecipientPage(
  recipientAddress: string,
  options: PaginationOptions
): Promise<WalletMessagePage> {
  const normalized = normalizeAddress(recipientAddress);
  const supabase = getSupabaseServerClient();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const query = supabase
    .from('encrypted_messages')
    .select('*')
    .eq('recipient_address', normalized);
  applyPagination(query, options.cursor, limit);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch recipient messages: ${error.message}`);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(pageRows[pageRows.length - 1]?.created_at ?? '') : null;
  return {
    messages: pageRows.map(mapRowToMessage),
    nextCursor: nextCursor || null,
  };
}

export async function getMessagesForWalletPage(
  walletAddress: string,
  filters?: WalletMessageFilters & PaginationOptions
): Promise<WalletMessagePage> {
  const normalized = normalizeAddress(walletAddress);
  const includeSent = filters?.includeSent ?? false;
  const supabase = getSupabaseServerClient();
  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 200);
  let query = supabase.from('encrypted_messages').select('*');
  if (includeSent) {
    query = query.or(`recipient_address.eq.${normalized},sender_address.eq.${normalized}`);
  } else {
    query = query.eq('recipient_address', normalized);
  }
  applyPagination(query, filters?.cursor, limit);
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch wallet messages: ${error.message}`);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(pageRows[pageRows.length - 1]?.created_at ?? '') : null;
  return {
    messages: pageRows.map(mapRowToMessage),
    nextCursor: nextCursor || null,
  };
}

export async function upsertEncryptedIdentityBackup(record: {
  walletAddress: string;
  encryptedBlob: string;
  nonce: string;
  algorithm: string;
  version: number;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('encrypted_identities')
    .upsert(
      {
        wallet_address: normalizeAddress(record.walletAddress),
        encrypted_blob: record.encryptedBlob,
        nonce: record.nonce,
        algorithm: record.algorithm,
        version: record.version,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' }
    );
  if (error) {
    throw new Error(`Failed to upsert encrypted identity: ${error.message}`);
  }
}

export async function getEncryptedIdentityBackup(walletAddress: string): Promise<{
  encryptedBlob: string;
  nonce: string;
  algorithm: string;
  version: number;
} | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('encrypted_identities')
    .select('encrypted_blob, nonce, algorithm, version')
    .eq('wallet_address', normalizeAddress(walletAddress))
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to fetch encrypted identity: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return {
    encryptedBlob: String(data.encrypted_blob),
    nonce: String(data.nonce),
    algorithm: String(data.algorithm),
    version: Number(data.version),
  };
}
