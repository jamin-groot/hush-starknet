'use client';

import { useEffect, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { AppLayout } from '@/components/app-layout';
import { TransactionCard } from '@/components/transaction-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Copy, ExternalLink, Lock } from 'lucide-react';
import { getTransactions, formatAddress } from '@/lib/blockchain';
import type { Transaction } from '@/lib/blockchain';
import { decryptTransactionNote, getEncryptedNotesForRecipient } from '@/lib/privacy';

interface InboxNote {
  txHash: string;
  from: string;
  createdAt: number;
  plaintext: string;
}

export default function TransactionsPage() {
  const { address } = useAccount();
  const [transactions] = useState(getTransactions());
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [inboxNotes, setInboxNotes] = useState<InboxNote[]>([]);

  useEffect(() => {
    const loadInbox = async () => {
      if (!address) {
        setInboxNotes([]);
        return;
      }

      try {
        const encryptedNotes = await getEncryptedNotesForRecipient(address);
        const decrypted = await Promise.all(
          encryptedNotes.map(async (entry) => {
            try {
              const plaintext = await decryptTransactionNote(entry.payload, address);
              return {
                txHash: entry.txHash,
                from: entry.payload.senderAddress,
                createdAt: entry.createdAt,
                plaintext,
              } satisfies InboxNote;
            } catch {
              return null;
            }
          })
        );

        setInboxNotes(decrypted.filter((note): note is InboxNote => note !== null));
      } catch {
        setInboxNotes([]);
      }
    };

    loadInbox();
  }, [address]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'sent' && tx.type === 'send') ||
      (filter === 'received' && tx.type === 'receive') ||
      (filter === 'private' && tx.isPrivate);

    const matchesSearch =
      searchQuery === '' ||
      tx.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.note?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-balance text-4xl font-bold">Transactions</h1>
          <p className="mt-2 text-muted-foreground">
            View and manage all your payment history
          </p>
        </div>

        {/* Filters */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by address, hash, or note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="sent">Sent Only</SelectItem>
                <SelectItem value="received">Received Only</SelectItem>
                <SelectItem value="private">Private Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Transaction List */}
        {inboxNotes.length > 0 && (
          <Card className="border border-primary/20 bg-primary/5 p-6">
            <h3 className="mb-4 text-lg font-semibold">Private Messages For You</h3>
            <div className="space-y-3">
              {inboxNotes.map((note) => (
                <div key={note.txHash} className="rounded-lg border border-primary/20 bg-background/60 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>From: {formatAddress(note.from)}</span>
                    <span>{new Date(note.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{note.plaintext}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">Tx: {formatAddress(note.txHash)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="space-y-3">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                transaction={tx}
                onClick={() => setSelectedTx(tx)}
              />
            ))
          ) : (
            <Card className="border border-[#1A1E22] p-12 text-center">
              <p className="text-muted-foreground">No transactions found</p>
            </Card>
          )}
        </div>

        {/* Transaction Details Dialog */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Transaction Details
                {selectedTx?.isPrivate && (
                  <Lock className="h-4 w-4 text-primary" />
                )}
              </DialogTitle>
              <DialogDescription>
                Complete information about this transaction
              </DialogDescription>
            </DialogHeader>

            {selectedTx && (
              <div className="space-y-6">
                {/* Status and Amount */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Amount</div>
                    <div
                      className={`text-3xl font-bold ${
                        selectedTx.type === 'send' ? 'text-destructive' : 'text-primary'
                      }`}
                    >
                      {selectedTx.type === 'send' ? '-' : '+'} {selectedTx.amount} {selectedTx.token}
                    </div>
                  </div>
                  <Badge
                    variant={
                      selectedTx.status === 'confirmed'
                        ? 'default'
                        : selectedTx.status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {selectedTx.status}
                  </Badge>
                </div>

                {/* Transaction Details */}
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">From</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-sm">{selectedTx.from}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedTx.from)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">To</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-sm">{selectedTx.to}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedTx.to)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Transaction Hash</div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-sm">{selectedTx.hash}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(selectedTx.hash)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Timestamp</div>
                    <div className="mt-1 text-sm">
                      {new Date(selectedTx.timestamp).toLocaleString()}
                    </div>
                  </div>

                  {selectedTx.note && (
                    <div>
                      <div className="text-sm text-muted-foreground">Note</div>
                      <div className="mt-1 rounded-lg bg-muted p-3 text-sm">
                        {selectedTx.note}
                      </div>
                    </div>
                  )}

                  {selectedTx.encryptedNote && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        <span>Encrypted Note (Hush Mode)</span>
                      </div>
                      <div className="mt-1 rounded-lg bg-primary/5 p-3 text-sm text-primary">
                        {selectedTx.encryptedNote}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
