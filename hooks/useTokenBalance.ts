'use client';

import { useEffect, useState } from 'react';
import { Contract } from 'starknet';
import { useAccount } from '@starknet-react/core';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
] as const;

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1b11f5dbebf0c7db8d19a0e7c5d6c0f5c5b5c5b5c5';
const STRK_DECIMALS = 18;
const STARKNET_SEPOLIA_CHAIN_ID = '0x534e5f5345504f4c4941';

type Uint256Like = {
  low: string | number | bigint;
  high: string | number | bigint;
};

const uint256ToBigInt = (value: Uint256Like): bigint => {
  const low = BigInt(value.low);
  const high = BigInt(value.high);

  return (high << BigInt(128)) + low;
};

const formatTokenBalance = (value: bigint, decimals: number): string => {
  const raw = value.toString().padStart(decimals + 1, '0');
  const whole = raw.slice(0, raw.length - decimals);
  const fractional = raw.slice(raw.length - decimals, raw.length - decimals + 4);

  return `${whole}.${fractional}`;
};

export function useTokenBalance() {
  const { address, isConnected, account } = useAccount();
  const [balance, setBalance] = useState('0.0000');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address || !account) {
      setBalance('0.0000');
      return;
    }

    let isCancelled = false;

    const fetchBalance = async () => {
      try {
        setLoading(true);

        const chainId = await account.getChainId();
        if (chainId !== STARKNET_SEPOLIA_CHAIN_ID) {
          setBalance('0.0000');
          return;
        }

        const contract = new Contract({
          abi: ERC20_ABI,
          address: STRK_ADDRESS,
          providerOrAccount: account,
        });

        const result = (await contract.balanceOf(address)) as {
          balance: Uint256Like;
        };

        const rawBalance = uint256ToBigInt(result.balance);
        const formattedBalance = formatTokenBalance(rawBalance, STRK_DECIMALS);

        if (!isCancelled) {
          setBalance(formattedBalance);
        }
      } catch (err) {
        console.error('STRK balance error:', err);
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
  }, [address, isConnected, account]);

  return { balance, loading };
}
