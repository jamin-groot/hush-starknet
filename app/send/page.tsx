'use client';

import { useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { AppLayout } from '@/components/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { isValidAddress } from '@/lib/blockchain';
import { useSendStrk } from '@/hooks/useSendStrk';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
import { TransactionSuccessModal } from '@/components/transaction-success-modal';
import type { Transaction } from '@/lib/blockchain';
import {
  ensureEncryptionIdentity,
  encryptTransactionNote,
  storeEncryptedNoteMetadata,
} from '@/lib/privacy';

export default function SendPage() {
  const { sendStrk, isSending, transactionHash, lifecycle, resetLifecycle } = useSendStrk();
  const { address } = useAccount();
  const { balance, refetchBalance } = useRealtimeBalance();

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('STRK');
  const [note, setNote] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);

  const isValidForm = isValidAddress(recipient) && parseFloat(amount) > 0;

  const handleSend = async () => {
    if (!isValidForm) {
      setError('Please enter a valid recipient address and amount');
      return;
    }

    const amountNum = parseFloat(amount);
    const walletBalance = parseFloat(balance);

    if (amountNum > walletBalance) {
      setError('Insufficient balance');
      return;
    }

    setError('');

    try {
      let encryptedPayload: string | undefined;

      if (isPrivate && note) {
        setIsEncrypting(true);
        const senderAddress = address;
        if (!senderAddress) {
          throw new Error('Wallet not connected');
        }

        await ensureEncryptionIdentity(senderAddress);
        const encrypted = await encryptTransactionNote(note, senderAddress, recipient);
        encryptedPayload = JSON.stringify(encrypted);
        setIsEncrypting(false);
      } else if (isPrivate && !note.trim()) {
        throw new Error('Privacy mode requires a note to encrypt');
      }

      const hash = await sendStrk(recipient, amount, balance, {
        token,
        note: isPrivate ? undefined : note,
        encryptedNote: encryptedPayload,
        isPrivate,
      });

      if (isPrivate && encryptedPayload) {
        await storeEncryptedNoteMetadata({
          txHash: hash,
          payload: JSON.parse(encryptedPayload),
          createdAt: Date.now(),
        });
      }

      const txRecord: Transaction = {
        id: `tx-${Date.now()}`,
        from: address ?? '0x0',
        to: recipient,
        amount,
        token,
        note: isPrivate ? undefined : note,
        encryptedNote: encryptedPayload,
        timestamp: Date.now(),
        status: 'confirmed',
        type: 'send',
        isPrivate,
        hash,
      };

      setLastTransaction(txRecord);

      setSuccessOpen(true);
      await refetchBalance();

      setRecipient('');
      setAmount('');
      setToken('STRK');
      setNote('');
      setIsPrivate(false);
    } catch (err) {
      console.error('[hush] STRK transfer error:', err);
      setIsEncrypting(false);

      if (err instanceof Error) {
        setError(err.message);
        return;
      }

      setError('Failed to send transaction. Please try again.');
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-balance text-4xl font-bold">Send Payment</h1>
          <p className="mt-2 text-muted-foreground">
            Send encrypted payments with Hush privacy mode
          </p>
        </div>

        {/* Send Form */}
        <Card className="border border-[#1A1E22] p-6">
          <div className="space-y-6">
            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Amount and Token */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amount">Amount</Label>
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
                    <SelectItem value="STRK">STRK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Balance Display */}
            <div className="rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Available Balance: </span>
              <span className="font-mono font-semibold">
                {balance} STRK
              </span>
            </div>

            {/* Privacy Mode Toggle */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Privacy Mode (Hush)</div>
                    <div className="text-sm text-muted-foreground">
                      Encrypt your note with zero-knowledge proofs
                    </div>
                  </div>
                </div>
                <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note">
                {isPrivate ? 'Private Note (Encrypted)' : 'Transaction Note (Optional)'}
              </Label>
              <Textarea
                id="note"
                placeholder={
                  isPrivate
                    ? 'This note will be encrypted end-to-end...'
                    : 'Add a note to this transaction...'
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
              {isPrivate && note && (
                <p className="flex items-center gap-2 text-sm text-primary">
                  <Lock className="h-3 w-3" />
                  <span>This note will be encrypted before sending</span>
                </p>
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Send Button */}
            <Button
              onClick={handleSend}
              disabled={!isValidForm || isSending || isEncrypting || lifecycle === 'pending'}
              className="w-full gap-2"
              size="lg"
            >
              {isEncrypting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Encrypting Note...
                </>
              ) : isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending Transaction...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send {amount || '0.00'} STRK
                </>
              )}
            </Button>

            {transactionHash && (
              <p className="text-xs text-muted-foreground">
                Last transaction hash: <span className="font-mono">{transactionHash}</span>
              </p>
            )}

            {lifecycle === 'failure' && (
              <p className="text-xs text-destructive">Transaction failed. Check logs for details and try again.</p>
            )}
          </div>
        </Card>

        {/* Privacy Info */}
        <Card className="border border-[#1A1E22] bg-primary/5 p-6">
          <div className="flex gap-4">
            <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-primary" />
            <div className="space-y-2">
              <h3 className="font-semibold">How Hush Privacy Works</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                When you enable Privacy Mode, your transaction note is encrypted using AES-GCM
                encryption with a 256-bit key derived from your wallet. The encrypted note is
                stored on-chain, but only you and the recipient can decrypt it. Starknet&apos;s
                zero-knowledge proofs ensure your transaction remains private and secure.
              </p>
            </div>
          </div>
        </Card>

        <TransactionSuccessModal
          open={successOpen}
          onOpenChange={(open) => {
            setSuccessOpen(open);
            if (!open) {
              resetLifecycle();
            }
          }}
          transaction={lastTransaction}
          onViewTransaction={() => setSuccessOpen(false)}
        />
      </div>
    </AppLayout>
  );
}
