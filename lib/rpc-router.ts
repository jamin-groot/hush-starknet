import { RpcProvider } from 'starknet';

const DEFAULT_TIMEOUT_MS = 8_000;
const endpointHealth = new Map<
  string,
  { successCount: number; failureCount: number; lastLatencyMs: number; lastError: string | null }
>();

const parseCsv = (value: string | undefined): string[] => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const getRpcUrlCandidates = (): string[] => {
  const primary = process.env.NEXT_PUBLIC_STARKNET_RPC_URL ?? process.env.STARKNET_RPC_URL;
  const fallbackCsv =
    process.env.NEXT_PUBLIC_STARKNET_RPC_FALLBACKS ?? process.env.STARKNET_RPC_FALLBACKS;
  const candidates = unique([...(primary ? [primary] : []), ...parseCsv(fallbackCsv)]);
  return candidates;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('RPC health check timeout')), timeoutMs);
    });
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export interface SelectedRpcProvider {
  provider: RpcProvider;
  nodeUrl: string;
  chainId: string;
}

export const selectRpcProvider = async (
  overrideUrls?: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SelectedRpcProvider> => {
  const urls = overrideUrls && overrideUrls.length > 0 ? overrideUrls : getRpcUrlCandidates();
  if (urls.length === 0) {
    throw new Error(
      'No Starknet RPC configured. Set NEXT_PUBLIC_STARKNET_RPC_URL and optional NEXT_PUBLIC_STARKNET_RPC_FALLBACKS.'
    );
  }

  let lastError: unknown = null;
  for (const nodeUrl of urls) {
    const provider = new RpcProvider({ nodeUrl });
    const start = Date.now();
    try {
      const chainId = await withTimeout(provider.getChainId(), timeoutMs);
      const latency = Date.now() - start;
      const previous = endpointHealth.get(nodeUrl) ?? {
        successCount: 0,
        failureCount: 0,
        lastLatencyMs: 0,
        lastError: null,
      };
      endpointHealth.set(nodeUrl, {
        successCount: previous.successCount + 1,
        failureCount: previous.failureCount,
        lastLatencyMs: latency,
        lastError: null,
      });
      console.log('[hush:rpc-health:success]', {
        nodeUrl,
        latencyMs: latency,
        successCount: previous.successCount + 1,
      });
      return { provider, nodeUrl, chainId };
    } catch (error) {
      lastError = error;
      const latency = Date.now() - start;
      const previous = endpointHealth.get(nodeUrl) ?? {
        successCount: 0,
        failureCount: 0,
        lastLatencyMs: 0,
        lastError: null,
      };
      endpointHealth.set(nodeUrl, {
        successCount: previous.successCount,
        failureCount: previous.failureCount + 1,
        lastLatencyMs: latency,
        lastError: error instanceof Error ? error.message : 'unknown',
      });
      console.warn('[hush:rpc-health:failure]', {
        nodeUrl,
        latencyMs: latency,
        failureCount: previous.failureCount + 1,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  throw new Error(
    `Unable to reach configured Starknet RPC endpoints. Last error: ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`
  );
};

export const getRpcHealthMetrics = (): Record<
  string,
  { successCount: number; failureCount: number; lastLatencyMs: number; lastError: string | null }
> => {
  return Object.fromEntries(endpointHealth.entries());
};

export const buildRpcProviders = (): RpcProvider[] => {
  const urls = getRpcUrlCandidates();
  return urls.map((nodeUrl) => new RpcProvider({ nodeUrl }));
};

export const getPrimaryRpcUrl = (): string => {
  const urls = getRpcUrlCandidates();
  if (urls.length > 0) {
    return urls[0];
  }
  // Local fallback avoids build-time crashes while still requiring env-based dedicated RPC in production.
  return 'http://127.0.0.1:5050/rpc';
};

