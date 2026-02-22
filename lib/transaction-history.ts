import type { Transaction } from '@/lib/blockchain';

const STORAGE_KEY = 'hush.transactionHistory.v1';
export const TRANSACTION_HISTORY_UPDATED_EVENT = 'hush:transaction-history-updated';

const normalizeAddress = (value: string): string => value.trim().toLowerCase();

const readAll = (): Transaction[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Transaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (transactions: Transaction[]): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

export function upsertTransactionHistory(transaction: Transaction): void {
  const current = readAll();
  const next = current.filter((item) => item.hash !== transaction.hash);
  next.unshift(transaction);
  writeAll(next.slice(0, 1000));
}

export function getTransactionHistoryForWallet(address: string): Transaction[] {
  const normalized = normalizeAddress(address);

  return readAll()
    .filter((tx) => {
      return normalizeAddress(tx.from) === normalized || normalizeAddress(tx.to) === normalized;
    })
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function notifyTransactionHistoryUpdated(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(TRANSACTION_HISTORY_UPDATED_EVENT));
}
