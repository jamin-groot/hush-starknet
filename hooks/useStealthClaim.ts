'use client';

import { useCallback, useState } from 'react';
import {
  Account,
  CallData,
  Contract,
  ETransactionVersion,
  RpcProvider,
  cairo,
  validateAndParseAddress,
} from 'starknet';
import { normalizeStealthPrivateKey, type StealthMetadata } from '@/lib/stealth';

const STRK_ADDRESS =
  '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STRK_DECIMALS = 18;
const CLAIM_RPC_ENDPOINTS = [
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL,
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
  'https://starknet-sepolia-rpc.publicnode.com',
  'https://rpc.starknet-testnet.lava.build:443',
].filter((value): value is string => Boolean(value && value.trim()));
const MAX_POLL_ATTEMPTS = 40;
const POLL_INTERVAL_MS = 3000;
const FEE_RESERVE_WEI = BigInt(20_000_000_000_000_000); // 0.02 STRK

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
  if (execution.includes('REVERTED') || execution.includes('REJECTED')) {
    return false;
  }
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

const waitForTransaction = async (provider: RpcProvider, transactionHash: string): Promise<void> => {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    try {
      const status = await provider.getTransactionStatus(transactionHash);
      if (isFailureStatus(status)) {
        console.log('[hush:stealth-claim-status:failure]', { transactionHash, status });
        throw new Error(`Transaction failed with status: ${JSON.stringify(status)}`);
      }
      if (isSuccessStatus(status)) {
        console.log('[hush:stealth-claim-status:success]', { transactionHash, status });
        return;
      }
    } catch (error) {
      if (error instanceof Error && /rejected|reverted|failed/i.test(error.message)) {
        throw error;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Transaction confirmation timed out');
};

const pickProvider = async (): Promise<RpcProvider> => {
  let lastError: unknown = null;
  for (const nodeUrl of CLAIM_RPC_ENDPOINTS) {
    const provider = new RpcProvider({ nodeUrl });
    try {
      await provider.getChainId();
      return provider;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `No Starknet RPC endpoint available for stealth claim. Last error: ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`
  );
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
  throw new Error('Unexpected Uint256 response while reading stealth balance');
};

const readStealthStrkBalanceWei = async (provider: RpcProvider, address: string): Promise<bigint> => {
  const calldata = CallData.compile({ account: address });
  for (const entrypoint of ['balance_of', 'balanceOf'] as const) {
    try {
      const result = await provider.callContract({
        contractAddress: STRK_ADDRESS,
        entrypoint,
        calldata,
      });
      return parseUint256FromCall(result);
    } catch {
      // try next entrypoint
    }
  }
  throw new Error('Failed to read stealth account STRK balance');
};

const normalizeAddressForLogs = (value: string): string => {
  return value.startsWith('0x') ? value.toLowerCase() : `0x${value.toLowerCase()}`;
};

export function useStealthClaim() {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<string | null>(null);
  const [sweepTxHash, setSweepTxHash] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const claim = useCallback(async (params: {
    stealth: StealthMetadata;
    amount: string;
    recipientAddress: string;
  }): Promise<{ claimTxHash: string; deployTxHash?: string; sweepTxHash?: string }> => {
    setIsClaiming(true);
    setLastError(null);
    setClaimTxHash(null);
    setDeployTxHash(null);
    setSweepTxHash(null);

    try {
      const requiredFields = [
        ['stealthAddress', params.stealth.stealthAddress],
        ['stealthPrivateKey', params.stealth.stealthPrivateKey],
        ['stealthPublicKey', params.stealth.stealthPublicKey],
        ['salt', params.stealth.salt],
        ['classHash', params.stealth.classHash],
        ['derivationTag', params.stealth.derivationTag],
      ] as const;
      const missing = requiredFields
        .filter(([, value]) => typeof value !== 'string' || !value.trim())
        .map(([name]) => name);
      if (missing.length > 0) {
        throw new Error(`Stealth metadata is incomplete: missing ${missing.join(', ')}`);
      }
      const recipientAddress = validateAndParseAddress(params.recipientAddress);
      const stealthAddress = validateAndParseAddress(params.stealth.stealthAddress);
      if (!recipientAddress.startsWith('0x')) {
        throw new Error('Invalid recipient address format for claim transfer');
      }
      if (normalizeAddressForLogs(recipientAddress) === normalizeAddressForLogs(stealthAddress)) {
        throw new Error('Claim recipient cannot be the stealth account address');
      }
      const provider = await pickProvider();
      const normalizedStealthPrivateKey = normalizeStealthPrivateKey(params.stealth.stealthPrivateKey);
      const account = new Account({
        provider,
        address: stealthAddress,
        signer: normalizedStealthPrivateKey,
        cairoVersion: '1',
      });

      let deploymentHash: string | undefined;
      let alreadyDeployed = true;
      try {
        await provider.getClassHashAt(stealthAddress);
      } catch {
        alreadyDeployed = false;
      }

      if (!alreadyDeployed) {
        const deployResult = await (account as {
          deployAccount: (args: {
            classHash: string;
            constructorCalldata: string[];
            addressSalt: string;
            contractAddress: string;
          }) => Promise<{ transaction_hash?: string; transactionHash?: string }>;
        }).deployAccount({
          classHash: params.stealth.classHash,
          constructorCalldata: CallData.compile({ publicKey: params.stealth.stealthPublicKey }),
          addressSalt: params.stealth.salt,
          contractAddress: stealthAddress,
        }, {
          version: ETransactionVersion.V3,
        });

        deploymentHash = deployResult.transaction_hash ?? deployResult.transactionHash;
        if (!deploymentHash) {
          throw new Error('Stealth deployment did not return a transaction hash');
        }
        setDeployTxHash(deploymentHash);
        await waitForTransaction(provider, deploymentHash);
      }

      const requestedWei = toWei(params.amount);
      const receiverBalanceBeforeWei = await readStealthStrkBalanceWei(provider, recipientAddress);
      const onchainBalanceWei = await readStealthStrkBalanceWei(provider, stealthAddress);
      const spendableWei = onchainBalanceWei > FEE_RESERVE_WEI ? onchainBalanceWei - FEE_RESERVE_WEI : BigInt(0);
      const transferWei = requestedWei < spendableWei ? requestedWei : spendableWei;
      if (transferWei <= BigInt(0)) {
        throw new Error('Stealth account balance is too low to sweep after fees');
      }

      const amountUint256 = cairo.uint256(transferWei);
      const contract = new Contract({
        abi: ERC20_ABI,
        address: STRK_ADDRESS,
        providerOrAccount: account as any,
      });
      const transferTx = await contract.transfer(recipientAddress, amountUint256);
      const transferHash = transferTx.transaction_hash as string | undefined;
      if (!transferHash) {
        throw new Error('Stealth claim transfer did not return a transaction hash');
      }
      setClaimTxHash(transferHash);
      await waitForTransaction(provider, transferHash);

      let optionalSweepTxHash: string | undefined;
      const remainingAfterClaimWei = await readStealthStrkBalanceWei(provider, stealthAddress);
      const sweepableWei =
        remainingAfterClaimWei > FEE_RESERVE_WEI * BigInt(2)
          ? remainingAfterClaimWei - FEE_RESERVE_WEI
          : BigInt(0);

      if (sweepableWei > BigInt(0)) {
        const sweepAmountUint256 = cairo.uint256(sweepableWei);
        const sweepTx = await contract.transfer(recipientAddress, sweepAmountUint256);
        optionalSweepTxHash = sweepTx.transaction_hash as string | undefined;
        if (optionalSweepTxHash) {
          setSweepTxHash(optionalSweepTxHash);
          await waitForTransaction(provider, optionalSweepTxHash);
        }
      }

      const receiverBalanceAfterWei = await readStealthStrkBalanceWei(provider, recipientAddress);
      if (receiverBalanceAfterWei <= receiverBalanceBeforeWei) {
        throw new Error('Stealth claim transfer confirmed but receiver balance did not increase');
      }

      return { claimTxHash: transferHash, deployTxHash: deploymentHash, sweepTxHash: optionalSweepTxHash };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Stealth claim failed';
      setLastError(message);
      throw new Error(message);
    } finally {
      setIsClaiming(false);
    }
  }, []);

  return {
    claim,
    isClaiming,
    claimTxHash,
    deployTxHash,
    sweepTxHash,
    lastError,
  };
}
