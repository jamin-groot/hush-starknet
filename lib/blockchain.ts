/**
 * Mock blockchain operations for Hush demo
 * Simulates Starknet wallet and transaction functionality
 */

export interface WalletAccount {
  address: string;
  balance: string; // in ETH
  isConnected: boolean;
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  note?: string;
  encryptedNote?: string;
  decryptedNote?: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  type: 'send' | 'receive';
  isPrivate: boolean;
  hash: string;
}

export interface Invoice {
  id: string;
  merchantName: string;
  merchantAddress: string;
  amount: string;
  token: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'expired';
  createdAt: number;
  paidAt?: number;
  qrCode?: string;
}

// Mock wallet data for demo
let mockWallet: WalletAccount = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  balance: '2.4531',
  isConnected: false,
};

// Static base timestamp to avoid hydration issues
const BASE_TIMESTAMP = 1708214400000; // Feb 17, 2024 12:00:00 PM

// Mock transactions storage
let mockTransactions: Transaction[] = [
  {
    id: 'tx-1',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    to: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
    amount: '0.5',
    token: 'ETH',
    note: 'Coffee payment',
    timestamp: BASE_TIMESTAMP - 3600000,
    status: 'confirmed',
    type: 'send',
    isPrivate: false,
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
  {
    id: 'tx-2',
    from: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '1.2',
    token: 'ETH',
    encryptedNote: '🔒 Encrypted message',
    timestamp: BASE_TIMESTAMP - 7200000,
    status: 'confirmed',
    type: 'receive',
    isPrivate: true,
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  },
  {
    id: 'tx-3',
    from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    to: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    amount: '0.15',
    token: 'ETH',
    note: 'Lunch split',
    timestamp: BASE_TIMESTAMP - 86400000,
    status: 'confirmed',
    type: 'send',
    isPrivate: false,
    hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
  },
];

// Mock invoices storage
let mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    merchantName: 'Crypto Cafe',
    merchantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '0.025',
    token: 'ETH',
    description: 'Coffee & Pastry',
    dueDate: new Date(BASE_TIMESTAMP + 86400000 * 7).toISOString(),
    status: 'pending',
    createdAt: BASE_TIMESTAMP - 3600000,
  },
  {
    id: 'inv-2',
    merchantName: 'Web3 Services',
    merchantAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    amount: '2.5',
    token: 'ETH',
    description: 'Smart Contract Development',
    dueDate: new Date(BASE_TIMESTAMP + 86400000 * 30).toISOString(),
    status: 'pending',
    createdAt: BASE_TIMESTAMP - 86400000 * 2,
  },
];

/**
 * Connect mock wallet
 */
export async function connectWallet(): Promise<WalletAccount> {
  // Simulate connection delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
  
  mockWallet.isConnected = true;
  return mockWallet;
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  mockWallet.isConnected = false;
}

/**
 * Get current wallet info
 */
export function getWallet(): WalletAccount {
  return mockWallet;
}

/**
 * Get all transactions
 */
export function getTransactions(): Transaction[] {
  return mockTransactions.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get transaction by ID
 */
export function getTransaction(id: string): Transaction | undefined {
  return mockTransactions.find((tx) => tx.id === id);
}

/**
 * Send a transaction
 */
export async function sendTransaction(
  to: string,
  amount: string,
  token: string = 'ETH',
  note?: string,
  encryptedNote?: string,
  isPrivate: boolean = false
): Promise<Transaction> {
  // Simulate transaction delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const tx: Transaction = {
    id: `tx-${Date.now()}`,
    from: mockWallet.address,
    to,
    amount,
    token,
    note,
    encryptedNote,
    timestamp: Date.now(),
    status: 'confirmed',
    type: 'send',
    isPrivate,
    hash: `0x${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`,
  };

  // Update balance
  const currentBalance = parseFloat(mockWallet.balance);
  const sentAmount = parseFloat(amount);
  mockWallet.balance = (currentBalance - sentAmount).toFixed(4);

  mockTransactions.unshift(tx);
  return tx;
}

/**
 * Get all invoices
 */
export function getInvoices(): Invoice[] {
  return mockInvoices.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get invoice by ID
 */
export function getInvoice(id: string): Invoice | undefined {
  return mockInvoices.find((inv) => inv.id === id);
}

/**
 * Create new invoice
 */
export async function createInvoice(
  amount: string,
  token: string,
  description: string,
  dueDate: string
): Promise<Invoice> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const invoice: Invoice = {
    id: `inv-${Date.now()}`,
    merchantName: 'Your Business',
    merchantAddress: mockWallet.address,
    amount,
    token,
    description,
    dueDate,
    status: 'pending',
    createdAt: Date.now(),
  };

  mockInvoices.unshift(invoice);
  return invoice;
}

/**
 * Pay an invoice
 */
export async function payInvoice(invoiceId: string): Promise<Transaction> {
  const invoice = mockInvoices.find((inv) => inv.id === invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const tx = await sendTransaction(
    invoice.merchantAddress,
    invoice.amount,
    invoice.token,
    `Payment for: ${invoice.description}`
  );

  invoice.status = 'paid';
  invoice.paidAt = Date.now();

  return tx;
}

/**
 * Generate QR code data for payment request
 */
export function generatePaymentQR(address: string, amount?: string, token?: string): string {
  const data = {
    address,
    amount,
    token: token || 'ETH',
    network: 'starknet',
  };
  return JSON.stringify(data);
}

/**
 * Parse QR code data
 */
export function parsePaymentQR(qrData: string): {
  address: string;
  amount?: string;
  token?: string;
} {
  try {
    return JSON.parse(qrData);
  } catch {
    // If plain address, return as is
    return { address: qrData };
  }
}

/**
 * Validate Starknet address (simplified)
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40,64}$/.test(address);
}

/**
 * Format address for display (truncated)
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.substring(0, chars + 2)}...${address.substring(address.length - chars)}`;
}

/**
 * Format token amount for display
 */
export function formatAmount(amount: string | number, decimals: number = 4): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toFixed(decimals);
}

/**
 * Get transaction statistics
 */
export function getTransactionStats(): {
  totalSent: number;
  totalReceived: number;
  totalTransactions: number;
  privateTransactions: number;
} {
  const sent = mockTransactions
    .filter((tx) => tx.type === 'send')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const received = mockTransactions
    .filter((tx) => tx.type === 'receive')
    .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  const privateCount = mockTransactions.filter((tx) => tx.isPrivate).length;

  return {
    totalSent: sent,
    totalReceived: received,
    totalTransactions: mockTransactions.length,
    privateTransactions: privateCount,
  };
}
