import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatAmount } from '@/lib/blockchain';
import type { Invoice } from '@/lib/blockchain';

interface InvoiceCardProps {
  invoice: Invoice;
  onPay?: (invoiceId: string) => void;
  onView?: (invoiceId: string) => void;
}

export function InvoiceCard({ invoice, onPay, onView }: InvoiceCardProps) {
  const dueDate = new Date(invoice.dueDate);
  const createdDate = new Date(invoice.createdAt);
  const isPending = invoice.status === 'pending';
  const isPaid = invoice.status === 'paid';
  const isExpired = invoice.status === 'expired';

  const statusConfig = {
    pending: { icon: Clock, color: 'text-primary', bgColor: 'bg-primary/10' },
    paid: { icon: CheckCircle, color: 'text-primary', bgColor: 'bg-primary/10' },
    expired: { icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  };

  const config = statusConfig[invoice.status];
  const StatusIcon = config.icon;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${config.bgColor}`}>
            <StatusIcon className={`h-6 w-6 ${config.color}`} />
          </div>

          {/* Invoice Details */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{invoice.merchantName}</h3>
              <Badge
                variant={
                  isPaid ? 'default' : isExpired ? 'destructive' : 'secondary'
                }
              >
                {invoice.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{invoice.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Created: {createdDate.toLocaleDateString()}</span>
              <span>•</span>
              <span>Due: {dueDate.toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Amount and Actions */}
        <div className="flex flex-col items-end gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Amount</div>
            <div className="text-2xl font-bold">
              {formatAmount(invoice.amount)} {invoice.token}
            </div>
          </div>
          <div className="flex gap-2">
            {onView && (
              <Button variant="outline" size="sm" onClick={() => onView(invoice.id)}>
                View Details
              </Button>
            )}
            {isPending && onPay && (
              <Button size="sm" onClick={() => onPay(invoice.id)}>
                Pay Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
