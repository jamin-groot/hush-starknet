'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { InvoiceCard } from '@/components/invoice-card';
import { Card } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import { getInvoices, payInvoice } from '@/lib/blockchain';
import { useToast } from '@/hooks/use-toast';

export default function InvoicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState(getInvoices());

  const handlePay = async (invoiceId: string) => {
    try {
      await payInvoice(invoiceId);
      
      toast({
        title: 'Invoice Paid!',
        description: 'Payment completed successfully',
      });

      // Refresh invoices
      setInvoices(getInvoices());
    } catch (err) {
      console.error('[v0] Payment error:', err);
      toast({
        title: 'Payment Failed',
        description: 'Failed to pay invoice. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-balance text-4xl font-bold">Invoices</h1>
          <p className="mt-2 text-muted-foreground">
            View and pay invoices you've received
          </p>
        </div>

        {/* Invoices List */}
        <div className="space-y-4">
          {invoices.length > 0 ? (
            invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={invoice}
                onPay={handlePay}
              />
            ))
          ) : (
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">No invoices</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You don't have any invoices yet
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
