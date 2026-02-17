'use client';

import { useState } from 'react';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Store, Receipt, TrendingUp } from 'lucide-react';
import { getInvoices, getTransactionStats } from '@/lib/blockchain';
import { InvoiceCard } from '@/components/invoice-card';
import { StatCard } from '@/components/stat-card';
import Link from 'next/link';

export default function MerchantPage() {
  const [invoices] = useState(getInvoices());
  const stats = getTransactionStats();

  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending');
  const paidInvoices = invoices.filter((inv) => inv.status === 'paid');

  const totalPending = pendingInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount),
    0
  );
  const totalPaid = paidInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount),
    0
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-balance text-4xl font-bold">Merchant Tools</h1>
            <p className="mt-2 text-muted-foreground">
              Create invoices and manage your business payments
            </p>
          </div>
          <Button asChild>
            <Link href="/merchant/create" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Invoice
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <StatCard
            title="Total Received"
            value={`${stats.totalReceived.toFixed(2)} ETH`}
            change="+8.2% this month"
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="Pending Invoices"
            value={`${totalPending.toFixed(2)} ETH`}
            change={`${pendingInvoices.length} unpaid`}
            icon={Receipt}
            trend="neutral"
          />
          <StatCard
            title="Paid Invoices"
            value={`${totalPaid.toFixed(2)} ETH`}
            change={`${paidInvoices.length} completed`}
            icon={Store}
            trend="up"
          />
        </div>

        {/* Invoices Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Invoices ({invoices.length})</TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({pendingInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="paid">Paid ({paidInvoices.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {invoices.length > 0 ? (
              invoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))
            ) : (
              <Card className="border border-[#1A1E22] p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">No invoices yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your first invoice to get started
                    </p>
                  </div>
                  <Button asChild>
                    <Link href="/merchant/create">Create Invoice</Link>
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingInvoices.length > 0 ? (
              pendingInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))
            ) : (
              <Card className="border border-[#1A1E22] p-12 text-center">
                <p className="text-muted-foreground">No pending invoices</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="paid" className="space-y-4">
            {paidInvoices.length > 0 ? (
              paidInvoices.map((invoice) => (
                <InvoiceCard key={invoice.id} invoice={invoice} />
              ))
            ) : (
              <Card className="border border-[#1A1E22] p-12 text-center">
                <p className="text-muted-foreground">No paid invoices</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Business Info */}
        <Card className="border border-[#1A1E22] bg-accent/20 p-6">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent/30">
              <Store className="h-6 w-6 text-accent-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Accept Payments with Hush</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create professional invoices with QR codes for instant payment. Your customers
                can pay securely using Starknet with optional privacy mode. Track all payments
                in real-time and manage your business finances with confidence.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
