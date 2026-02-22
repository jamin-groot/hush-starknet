'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { CallData, RpcProvider } from 'starknet';

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STRK_DECIMALS = 18;
const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941';
const RPC_ENDPOINTS = [
  'https://starknet-sepolia-rpc.publicnode.com',
  'https://rpc.starknet-testnet.lava.build:443',
] as const;

type ContractCaller = {
  callContract: (request: {
    contractAddress: string;
    entrypoint: string;
    calldata: string[];
  }) => Promise<unknown>;
};

const parseUint256FromCall = (result: unknown): bigint => {
  if (Array.isArray(result) && result.length >= 2) {
    return (BigInt(result[1]) << BigInt(128)) + BigInt(result[0]);
  }

  if (result && typeof result === 'object') {
    const value = result as Record<string, unknown>;

    if (value.low !== undefined && value.high !== undefined) {
      return (BigInt(value.high as string | number | bigint) << BigInt(128)) + BigInt(value.low as string | number | bigint);
    }

    if (value.balance && typeof value.balance === 'object') {
      const balance = value.balance as Record<string, unknown>;
      if (balance.low !== undefined && balance.high !== undefined) {
        return (BigInt(balance.high as string | number | bigint) << BigInt(128)) + BigInt(balance.low as string | number | bigint);
      }
    }
  }

  throw new Error('Unexpected Uint256 response');
};

const formatTokenBalance = (rawBalance: bigint, decimals: number): string => {
  const raw = rawBalance.toString().padStart(decimals + 1, '0');
  const whole = raw.slice(0, raw.length - decimals);
  const fractional = raw.slice(raw.length - decimals, raw.length - decimals + 4);
  return `${whole}.${fractional}`;
};

const fetchBalanceWithCaller = async (caller: ContractCaller, address: string): Promise<bigint> => {
  const calldata = CallData.compile({ account: address });

  for (const entrypoint of ['balance_of', 'balanceOf'] as const) {
    try {
      const result = await caller.callContract({
        contractAddress: STRK_ADDRESS,
        entrypoint,
        calldata,
      });
      return parseUint256FromCall(result);
    } catch {
      // Try the next entrypoint/provider.
    }
  }

  throw new Error('Failed to read STRK balance');
};

export function useTokenBalance() {
  const { address, account, isConnected } = useAccount();
  const [balance, setBalance] = useState('0.0000');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setBalance('0.0000');
      return;
    }

    let isCancelled = false;

    const fetchBalance = async () => {
      if (!isCancelled) {
        setLoading(true);
      }

      try {
        const callers: ContractCaller[] = [
          ...RPC_ENDPOINTS.map((nodeUrl) => new RpcProvider({ nodeUrl })),
        ];

        if (account && typeof account.callContract === 'function') {
          const chainId = await account.getChainId();
          if (chainId !== STARKNET_SEPOLIA_CHAIN_ID) {
            if (!isCancelled) {
              setBalance('0.0000');
            }
            return;
          }

          callers.push(account as unknown as ContractCaller);
        }

        let rawBalance: bigint | null = null;

        for (const caller of callers) {
          try {
            rawBalance = await fetchBalanceWithCaller(caller, address);
            break;
          } catch {
            // Try next RPC/account caller.
          }
        }

        if (rawBalance === null) {
          throw new Error('All balance providers failed');
        }

        if (!isCancelled) {
          setBalance(formatTokenBalance(rawBalance, STRK_DECIMALS));
        }
      } catch (error) {
        console.error('STRK balance error:', error);
        if (!isCancelled) {
          setBalance('0.0000');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isConnected, address, account]);

  return { balance, loading };
}
