'use client';

import { AppLayout } from '@/components/app-layout';
import { StatCard } from '@/components/stat-card';
import { TransactionCard } from '@/components/transaction-card';
import { WalletBalanceCard } from '@/components/wallet-balance-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Shield,
  ArrowRight,
  Send,
  QrCode,
  Receipt,
} from 'lucide-react';
import { formatAddress } from '@/lib/blockchain';
import { useAccount } from '@starknet-react/core';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import Link from 'next/link';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const { transactions: realtimeTransactions, stats } = useRealtimeTransactions();
  const transactions = realtimeTransactions.slice(0, 5);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-balance text-4xl font-bold">Account</h1>
            <p className="mt-2 text-muted-foreground">
              Welcome back to your privacy-first payment hub
            </p>
            {isConnected && address && (
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                Connected wallet: {formatAddress(address, 8)}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button asChild className="hover:brightness-90">
              <Link href="/send" className="gap-2">
                <Send className="h-4 w-4" />
                Send Payment
              </Link>
            </Button>
            <Button variant="outline" asChild className="hover:bg-muted/50 hover:text-foreground">
              <Link href="/scan" className="gap-2">
                <QrCode className="h-4 w-4" />
                Scan QR
              </Link>
            </Button>
          </div>
        </div>

        {/* Wallet Balance Section */}
        <WalletBalanceCard />

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Sent"
            value={`${stats.totalSent.toFixed(2)} STRK`}
            change="-12.5% this month"
            icon={TrendingDown}
            trend="down"
          />
          <StatCard
            title="Total Received"
            value={`${stats.totalReceived.toFixed(2)} STRK`}
            change="+8.2% this month"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Total Transactions"
            value={stats.totalTransactions.toString()}
            change={`${stats.totalTransactions} completed`}
            icon={Activity}
            trend="neutral"
          />
          <StatCard
            title="Private Transactions"
            value={stats.privateTransactions.toString()}
            change="End-to-end encrypted"
            icon={Shield}
            trend="up"
          />
        </div>

        {/* Quick Actions */}
        <Card className="border border-[#1A1E22] p-6">
          <h2 className="mb-4 text-xl font-semibold">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/send"
              className="flex items-center gap-4 rounded-lg border border-[#1A1E22] p-4 transition-colors hover:border-primary/30 hover:bg-[#20252B]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Send className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Send Private Payment</div>
                <div className="text-sm text-muted-foreground">Encrypted with Hush Notes</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link
              href="/scan"
              className="flex items-center gap-4 rounded-lg border border-[#1A1E22] p-4 transition-colors hover:border-primary/30 hover:bg-[#20252B]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Scan QR Code</div>
                <div className="text-sm text-muted-foreground">Quick payment request</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>

            <Link
              href="/merchant"
              className="flex items-center gap-4 rounded-lg border border-[#1A1E22] p-4 transition-colors hover:border-primary/30 hover:bg-[#20252B]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Create Invoice</div>
                <div className="text-sm text-muted-foreground">For your business</div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </div>
        </Card>

        {/* Recent Transactions */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Recent Transactions</h2>
            <Button variant="ghost" asChild className="hover:bg-[#20252B]">
              <Link href="/transactions" className="gap-2">
                View All
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {transactions.length > 0 ? (
              transactions.map((tx) => (
                <TransactionCard key={tx.id} transaction={tx} />
              ))
            ) : (
              <Card className="border border-[#1A1E22] p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">No transactions yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Start by sending your first private payment
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/send">Send Payment</Link>
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
