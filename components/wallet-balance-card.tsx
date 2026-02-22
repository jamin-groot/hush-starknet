'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Copy, Check, Wallet } from 'lucide-react';
import { useAccount } from '@starknet-react/core';
import { formatAddress } from '@/lib/blockchain';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';

export function WalletBalanceCard() {
  const { address } = useAccount();
  const { balance } = useRealtimeBalance();

  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  // temp STRK price
  const strkToUsd = 1;
  const balanceInUsd = parseFloat(balance) * strkToUsd;

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden border border-[#1A1E22] bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 shadow-lg shadow-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Wallet Balance</h3>
              <p className="text-sm text-muted-foreground">Main Account</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalance(!showBalance)}
            className="hover:bg-[#20252B]"
          >
            {showBalance ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Balance */}
        <div className="space-y-2">
          {showBalance ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tracking-tight">
                  {balance}
                </span>
                <span className="text-2xl font-semibold text-muted-foreground">
                  STRK
                </span>
              </div>

              <div className="text-lg text-muted-foreground">
                ≈ $
                {balanceInUsd.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                USD
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="font-mono text-4xl font-bold tracking-tight">
                ••••••
              </div>
              <div className="text-lg text-muted-foreground">
                Balance Hidden
              </div>
            </div>
          )}
        </div>

        {/* Address */}
        <div className="flex items-center justify-between rounded-lg bg-[#20252B] p-4">
          <div>
            <p className="text-xs text-muted-foreground">Wallet Address</p>
            <p className="mt-1 font-mono text-sm">
              {address ? formatAddress(address, 8) : 'Not connected'}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={copyAddress}
            className="hover:bg-white/5"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Network */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Network</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-medium">Starknet Sepolia</span>
          </div>
        </div>
      </div>
    </Card>
  );
}