'use client';

import { useCallback, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { cairo, Contract, RpcProvider, validateAndParseAddress } from 'starknet';

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STRK_DECIMALS = 18;
const RPC_ENDPOINTS = [
  'https://starknet-sepolia-rpc.publicnode.com',
  'https://rpc.starknet-testnet.lava.build:443',
] as const;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

type TransferLifecycle = 'idle' | 'pending' | 'success' | 'failure';

const ERC20_ABI = [
  {
    name: 'Uint256',
    type: 'struct',
    size: 2,
    members: [
      { name: 'low', type: 'felt' },
      { name: 'high', type: 'felt' },
    ],
  },
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
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const isSuccessStatus = (status: unknown): boolean => {
  if (!status || typeof status !== 'object') {
    return false;
  }

  const state = status as Record<string, unknown>;
  const finality = String(state.finality_status ?? '').toUpperCase();
  const execution = String(state.execution_status ?? '').toUpperCase();
  const txStatus = String(state.tx_status ?? '').toUpperCase();

  return (
    finality.includes('ACCEPTED_ON_L2') ||
    finality.includes('ACCEPTED_ON_L1') ||
    execution.includes('SUCCEEDED') ||
    txStatus.includes('ACCEPTED')
  );
};

const isFailureStatus = (status: unknown): boolean => {
  if (!status || typeof status !== 'object') {
    return false;
  }

  const state = status as Record<string, unknown>;
  const finality = String(state.finality_status ?? '').toUpperCase();
  const execution = String(state.execution_status ?? '').toUpperCase();
  const txStatus = String(state.tx_status ?? '').toUpperCase();

  return (
    finality.includes('REJECTED') ||
    execution.includes('REVERTED') ||
    execution.includes('REJECTED') ||
    txStatus.includes('REJECTED') ||
    txStatus.includes('REVERTED')
  );
};

const resolveTransaction = async (transactionHash: string): Promise<void> => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    for (const nodeUrl of RPC_ENDPOINTS) {
      try {
        const provider = new RpcProvider({ nodeUrl });
        const status = await provider.getTransactionStatus(transactionHash);

        if (isSuccessStatus(status)) {
          return;
        }

        if (isFailureStatus(status)) {
          throw new Error(`Transaction failed with status: ${JSON.stringify(status)}`);
        }
      } catch (error) {
        if (error instanceof Error && /rejected|reverted|failed/i.test(error.message)) {
          throw error;
        }
      }
    }

    await sleep(POLL_INTERVAL_MS * (attempt < 4 ? 1 : 2));
  }

  throw new Error('Transaction confirmation timed out');
};

export function useSendStrk() {
  const { account, isConnected, address } = useAccount();
  const [lifecycle, setLifecycle] = useState<TransferLifecycle>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const resetLifecycle = useCallback(() => {
    setLifecycle('idle');
    setTransactionHash(null);
    setLastError(null);
  }, []);

  const sendStrk = useCallback(async (recipient: string, amount: string, availableBalance: string): Promise<string> => {
    if (lifecycle === 'pending') {
      throw new Error('Transaction already pending. Please wait for confirmation.');
    }

    if (!isConnected || !account || !address) {
      throw new Error('Wallet not connected');
    }

    let parsedRecipient: string;
    try {
      parsedRecipient = validateAndParseAddress(recipient);
    } catch {
      throw new Error('Invalid recipient address');
    }

    if (!amount || typeof amount !== 'string' || amount.trim() === '') {
      throw new Error('Invalid amount');
    }
    console.log('amount before conversion:', amount);
    console.log('raw balance for send validation:', availableBalance);

    const amountWei = toWei(amount);
    if (amountWei <= BigInt(0)) {
      throw new Error('Invalid amount');
    }

    if (!availableBalance || typeof availableBalance !== 'string' || availableBalance.trim() === '') {
      throw new Error('Invalid available balance');
    }

    const availableWei = toWei(availableBalance);
    if (amountWei > availableWei) {
      throw new Error('Insufficient balance');
    }

    setLifecycle('pending');
    setLastError(null);

    try {
      const contract = new Contract({ abi: ERC20_ABI, address: STRK_ADDRESS, providerOrAccount: account });
      const amountUint256 = cairo.uint256(amountWei);
      console.log('amount passed to transfer:', amountUint256);
      const tx = await contract.transfer(parsedRecipient, amountUint256);
      const hash = tx.transaction_hash;
      setTransactionHash(hash);

      await resolveTransaction(hash);

      setLifecycle('success');
      return hash;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send transaction';
      setLastError(message);
      setLifecycle('failure');
      console.error('[hush] STRK lifecycle failure:', error);
      throw new Error(message);
    }
  }, [account, address, isConnected, lifecycle]);

  return {
    sendStrk,
    isSending: lifecycle === 'pending',
    lifecycle,
    transactionHash,
    lastError,
    resetLifecycle,
  };
}
