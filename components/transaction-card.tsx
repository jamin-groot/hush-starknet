import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownLeft, Lock } from 'lucide-react';
import { formatAddress, formatAmount } from '@/lib/blockchain';
import type { Transaction } from '@/lib/blockchain';

interface TransactionCardProps {
  transaction: Transaction;
  onClick?: () => void;
  className?: string;
}

export function TransactionCard({ transaction, onClick, className }: TransactionCardProps) {
  const isSend = transaction.type === 'send';
  const date = new Date(transaction.timestamp);
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Format date consistently with explicit locale and timezone to avoid hydration issues
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const formattedTime = isMounted ? date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }) : '--:--';

  return (
    <Card
      className={cn('border border-[#1A1E22] cursor-pointer p-4 transition-colors hover:bg-muted/50', className)}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Transaction Icon */}
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isSend ? 'bg-destructive/10' : 'bg-primary/10'
            }`}
          >
            {isSend ? (
              <ArrowUpRight className="h-5 w-5 text-destructive" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 text-primary" />
            )}
          </div>

          {/* Transaction Details */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {isSend ? 'Sent to' : 'Received from'}
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                {formatAddress(isSend ? transaction.to : transaction.from)}
              </span>
              {transaction.isPrivate && (
                <Lock className="h-3 w-3 text-primary" />
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formattedDate}</span>
              <span>•</span>
              <span>{formattedTime}</span>
            </div>
            {transaction.note && (
              <p className="text-sm text-muted-foreground">{transaction.note}</p>
            )}
            {transaction.encryptedNote && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <p className="text-sm text-foreground">
                  {transaction.decryptedNote ?? 'Encrypted note attached'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Amount and Status */}
        <div className="flex flex-col items-end gap-2">
          <span
            className={`text-lg font-semibold ${
              isSend ? 'text-destructive' : 'text-primary'
            }`}
          >
            {isSend ? '-' : '+'} {formatAmount(transaction.amount)} {transaction.token}
          </span>
          <Badge
            variant={
              transaction.status === 'confirmed'
                ? 'default'
                : transaction.status === 'pending'
                  ? 'secondary'
                  : 'destructive'
            }
          >
            {transaction.status}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
