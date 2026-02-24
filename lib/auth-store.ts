import { getSupabaseServerClient } from '@/lib/supabase-server';

const normalizeAddress = (value: string): string => value.trim().toLowerCase();

export const persistAuthChallenge = async (params: {
  walletAddress: string;
  nonce: string;
  expiresAtEpochSeconds: number;
}): Promise<void> => {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from('auth_challenges').insert({
    nonce: params.nonce,
    wallet_address: normalizeAddress(params.walletAddress),
    expires_at: new Date(params.expiresAtEpochSeconds * 1000).toISOString(),
  });
  if (error) {
    throw new Error(`Failed to persist auth challenge: ${error.message}`);
  }
};

export const consumeAuthChallenge = async (params: {
  walletAddress: string;
  nonce: string;
}): Promise<boolean> => {
  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('auth_challenges')
    .update({ used_at: nowIso })
    .eq('nonce', params.nonce)
    .eq('wallet_address', normalizeAddress(params.walletAddress))
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('nonce')
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to consume auth challenge: ${error.message}`);
  }
  return Boolean(data?.nonce);
};

