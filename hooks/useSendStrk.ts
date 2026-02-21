'use client';

import { useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { cairo, Contract, validateAndParseAddress } from 'starknet';

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1b11f5dbebf0c7db8d19a0e7c5d6c0f5c5b5c5b5c5';
const STRK_DECIMALS = 18;

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'felt' },
      { name: 'amount', type: 'Uint256' },
    ],
    outputs: [{ name: 'success', type: 'felt' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
] as const;

const toWei = (value: string, decimals = STRK_DECIMALS): bigint => {
  const normalized = value.trim();
  if (!/^\d*(\.\d*)?$/.test(normalized) || normalized === '' || normalized === '.') {
    throw new Error('Invalid amount');
  }

  const [wholePart = '0', fractionalPart = ''] = normalized.split('.');
  const paddedFraction = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

  const normalizedWhole = (wholePart || '0').replace(/^0+/, '') || '0';
  const asInteger = `${normalizedWhole}${paddedFraction}`.replace(/^0+/, '') || '0';

  return BigInt(asInteger);
};

const uint256ToBigInt = (value: { low: bigint | string | number; high: bigint | string | number }) => {
  const low = BigInt(value.low);
  const high = BigInt(value.high);
  return (high << BigInt(128)) + low;
};

export function useSendStrk() {
  const { account, isConnected, address } = useAccount();
  const [isSending, setIsSending] = useState(false);

  const sendStrk = async (recipient: string, amount: string): Promise<string> => {
    if (!isConnected || !account || !address) {
      throw new Error('Wallet not connected');
    }

    let parsedRecipient: string;
    try {
      parsedRecipient = validateAndParseAddress(recipient);
    } catch {
      throw new Error('Invalid recipient address');
    }

    const amountWei = toWei(amount);
    if (amountWei <= BigInt(0)) {
      throw new Error('Invalid amount');
    }

    setIsSending(true);

    try {
      const contract = new Contract({ abi: ERC20_ABI, address: STRK_ADDRESS, providerOrAccount: account });
      const balanceResponse = (await contract.balanceOf(address)) as {
        balance: { low: string | number | bigint; high: string | number | bigint };
      };
      const balance = uint256ToBigInt(balanceResponse.balance);

      if (amountWei > balance) {
        throw new Error('Insufficient balance');
      }

      const tx = await contract.transfer(parsedRecipient, cairo.uint256(amountWei));
      return tx.transaction_hash;
    } finally {
      setIsSending(false);
    }
  };

  return {
    sendStrk,
    isSending,
  };
}
