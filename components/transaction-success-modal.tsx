'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { Transaction } from '@/lib/blockchain';
import { formatAddress } from '@/lib/blockchain';

interface TransactionSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onViewTransaction: () => void;
}

export function TransactionSuccessModal({
  open,
  onOpenChange,
  transaction,
  onViewTransaction,
}: TransactionSuccessModalProps) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const copyHash = () => {
    navigator.clipboard.writeText(transaction.hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="text-center text-2xl">Transaction Sent</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 pb-2">
          {/* Success Icon */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-lg shadow-primary/10">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold">Transaction Successful</p>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing on blockchain...</span>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4 rounded-xl bg-[#20252B] p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-mono text-lg font-semibold">
                {transaction.amount} {transaction.token}
              </span>
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">To</span>
              <span className="font-mono text-sm">{formatAddress(transaction.to)}</span>
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground">Transaction Hash</span>
              <button
                onClick={copyHash}
                className="flex items-center gap-2 font-mono text-sm transition-colors hover:text-foreground"
              >
                {formatAddress(transaction.hash)}
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            {transaction.decryptedNote && (
              <>
                <div className="h-px bg-border/50" />
                <div className="space-y-2">
                  <span className="text-sm text-muted-foreground">Decrypted Private Note</span>
                  <p className="rounded-lg bg-primary/5 px-3 py-2 text-sm">{transaction.decryptedNote}</p>
                </div>
              </>
            )}
            {transaction.isPrivate && (
              <>
                <div className="h-px bg-border/50" />
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-primary">Private Transaction</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={onViewTransaction}
              className="flex-1 gap-2 hover:brightness-90"
              variant="default"
            >
              <ExternalLink className="h-4 w-4" />
              View Transaction
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 hover:bg-[#20252B]"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
