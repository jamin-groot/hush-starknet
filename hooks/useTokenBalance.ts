'use client';

import { useEffect, useState } from 'react';
import { Provider, Contract } from 'starknet';
import { useAccount } from '@starknet-react/core';

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
];

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1b11f5dbebf0c7db8d19a0e7c5d6c0f5c5b5c5b5c5'; // Sepolia STRK

export function useTokenBalance() {
  const { address } = useAccount();
  const [balance, setBalance] = useState('0.00');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    const fetchBalance = async () => {
      try {
        setLoading(true);

        const provider = new Provider({
          nodeUrl: 'https://starknet-sepolia.public.blastapi.io',
        });

        const contract = new Contract({ abi: ERC20_ABI, address: STRK_ADDRESS, providerOrAccount: provider });
        const result: any = await contract.balanceOf(address);

        const raw = result.balance.toString();
        const formatted = Number(raw) / 1e18;

        setBalance(formatted.toFixed(4));
      } catch (err) {
        console.error('STRK balance error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [address]);

  return { balance, loading };
}