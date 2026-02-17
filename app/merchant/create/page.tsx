'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Receipt, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { createInvoice } from '@/lib/blockchain';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function CreateInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('ETH');
  const [description, setDescription] = useState('');
  const [dueInDays, setDueInDays] = useState('7');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const isValidForm = parseFloat(amount) > 0 && description.trim() !== '';

  const handleCreate = async () => {
    if (!isValidForm) {
      setError('Please enter a valid amount and description');
      return;
    }

    setError('');
    setIsCreating(true);

    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(dueInDays));

      await createInvoice(amount, token, description, dueDate.toISOString());

      toast({
        title: 'Invoice Created!',
        description: 'Your invoice has been created successfully',
      });

      router.push('/merchant');
    } catch (err) {
      console.error('[v0] Invoice creation error:', err);
      setError('Failed to create invoice. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/merchant" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Merchant Tools
            </Link>
          </Button>
          <h1 className="text-balance text-4xl font-bold">Create Invoice</h1>
          <p className="mt-2 text-muted-foreground">
            Generate a payment request for your customers
          </p>
        </div>

        {/* Invoice Form */}
        <Card className="p-6">
          <div className="space-y-6">
            {/* Amount and Token */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.0001"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token">Token</Label>
                <Select value={token} onValueChange={setToken}>
                  <SelectTrigger id="token">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="USDC">USDC</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="What is this invoice for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Provide a clear description of the goods or services
              </p>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="due-days">Due Date</Label>
              <Select value={dueInDays} onValueChange={setDueInDays}>
                <SelectTrigger id="due-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Due in 1 day</SelectItem>
                  <SelectItem value="7">Due in 7 days</SelectItem>
                  <SelectItem value="14">Due in 14 days</SelectItem>
                  <SelectItem value="30">Due in 30 days</SelectItem>
                  <SelectItem value="60">Due in 60 days</SelectItem>
                  <SelectItem value="90">Due in 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {amount && description && (
              <Card className="bg-muted p-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Invoice Preview</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-semibold">
                        {amount} {token}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Description:</span>
                      <span className="text-right">{description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Due:</span>
                      <span>
                        {new Date(
                          Date.now() + parseInt(dueInDays) * 86400000
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Create Button */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push('/merchant')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!isValidForm || isCreating}
                className="flex-1 gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="bg-primary/5 p-6">
          <div className="space-y-2">
            <h3 className="font-semibold">After Creating Your Invoice</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span>•</span>
                <span>Share the invoice with your customer via link or QR code</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Track payment status in real-time on the Merchant dashboard</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>Receive instant notifications when the invoice is paid</span>
              </li>
              <li className="flex gap-2">
                <span>•</span>
                <span>All payments are secured by Starknet blockchain</span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
