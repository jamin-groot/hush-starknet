'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/app-layout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatAddress, isValidAddress } from '@/lib/blockchain';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { useRealtimeTransactions } from '@/hooks/useRealtimeTransactions';
import { useRealtimeBalance } from '@/hooks/useRealtimeBalance';
import { useSendStrk } from '@/hooks/useSendStrk';
import { useRealtimeStore } from '@/store/realtimeStore';
import {
  ensureEncryptionIdentity,
  encryptTransactionNote,
  storeEncryptedChatMessage,
  storePaymentRequestMessage,
  updatePaymentRequestMessage,
  rememberOutgoingMessagePreview,
} from '@/lib/privacy';
import { Lock, Search, Send, Loader2, ExternalLink } from 'lucide-react';

type LocalLifecycle = 'pending' | 'confirmed' | 'failed' | 'paid' | 'expired' | 'rejected';
type ComposeMode = 'message' | 'request';

interface OptimisticPaymentMessage {
  id: string;
  txHash: string;
  plaintext: string;
  createdAt: number;
  counterparty: string;
  lifecycle: LocalLifecycle;
}

const lifecycleVariant = (value: LocalLifecycle | undefined): 'default' | 'secondary' | 'destructive' => {
  if (value === 'confirmed' || value === 'paid') return 'default';
  if (value === 'failed' || value === 'expired' || value === 'rejected') return 'destructive';
  return 'secondary';
};

export default function ChatPage() {
  const router = useRouter();
  const { address, account } = useAccount();
  const { conversations, getConversationMessages } = useRealtimeMessages();
  const { lifecycleByHash } = useRealtimeTransactions();
  const { balance } = useRealtimeBalance();
  const { sendStrk, isSending } = useSendStrk();
  const refreshNow = useRealtimeStore((state) => state.refreshNow);

  const [search, setSearch] = useState('');
  const [selectedCounterparty, setSelectedCounterparty] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [messageText, setMessageText] = useState('');
  const [composeMode, setComposeMode] = useState<ComposeMode>('message');
  const [attachPayment, setAttachPayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticPaymentMessage[]>([]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return conversations;
    }
    return conversations.filter((item) => {
      return (
        item.counterparty.toLowerCase().includes(q) ||
        item.lastMessagePreview.toLowerCase().includes(q)
      );
    });
  }, [conversations, search]);

  useEffect(() => {
    if (selectedCounterparty) {
      return;
    }
    if (filteredConversations.length > 0) {
      setSelectedCounterparty(filteredConversations[0].counterparty);
    }
  }, [filteredConversations, selectedCounterparty]);

  const activeCounterparty = (manualAddress.trim() || selectedCounterparty || '').trim().toLowerCase();
  const isActiveAddressValid = isValidAddress(activeCounterparty);

  const persistedMessages = useMemo(() => {
    if (!activeCounterparty) {
      return [];
    }
    return getConversationMessages(activeCounterparty);
  }, [activeCounterparty, getConversationMessages]);

  const threadMessages = useMemo(() => {
    const persisted = persistedMessages.map((item) => ({
      id: item.id,
      txHash: item.txHash,
      plaintext: item.plaintext,
      createdAt: item.createdAt,
      direction: item.direction,
      kind: item.kind,
      requestId: item.requestId,
      amount: item.amount,
      requestStatus: item.requestStatus,
      isPaymentLinked: item.isPaymentLinked,
      lifecycle: item.requestStatus ?? (item.txHash ? lifecycleByHash[item.txHash] : undefined),
    }));

    const persistedHashes = new Set(
      persisted.filter((item) => item.txHash).map((item) => item.txHash as string)
    );

    const local = optimistic
      .filter((item) => item.counterparty === activeCounterparty)
      .filter((item) => !persistedHashes.has(item.txHash))
      .map((item) => ({
        id: item.id,
        txHash: item.txHash,
        plaintext: item.plaintext,
        createdAt: item.createdAt,
        direction: 'sent' as const,
        kind: 'payment_note' as const,
        isPaymentLinked: true,
        lifecycle: item.lifecycle,
      }));

    return [...persisted, ...local].sort((a, b) => a.createdAt - b.createdAt);
  }, [activeCounterparty, lifecycleByHash, optimistic, persistedMessages]);

  const handleRequestReject = async (requestId?: string, id?: string) => {
    if (!requestId && !id) {
      return;
    }
    if (!account) {
      return;
    }
    await updatePaymentRequestMessage({
      requestId,
      id,
      status: 'rejected',
    });
    await refreshNow(account);
  };

  const handleRequestAccept = (message: {
    requestId?: string;
    id: string;
    amount?: string;
    plaintext: string;
  }) => {
    setComposeMode('message');
    setAttachPayment(true);
    setAmount(message.amount ?? '');
    setMessageText(message.plaintext);
    setActiveRequestId(message.requestId ?? message.id);
    setError('');
  };

  const submitMessage = async () => {
    if (!address || !account) {
      setError('Connect your wallet first.');
      return;
    }
    if (!isActiveAddressValid) {
      setError('Choose a valid counterparty address.');
      return;
    }
    if (!messageText.trim() && composeMode !== 'request') {
      setError('Enter a message to encrypt.');
      return;
    }
    if ((attachPayment || composeMode === 'request') && (!amount || Number.parseFloat(amount) <= 0)) {
      setError('Enter a valid payment amount.');
      return;
    }

    setError('');
    setSubmitting(true);

    const now = Date.now();
    const optimisticId = `chat-${now}`;
    const optimisticHash = `pending-chat-${now}`;
    const generatedRequestId = `req-${now}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      await ensureEncryptionIdentity(address);
      const contentToEncrypt =
        messageText.trim() ||
        (composeMode === 'request'
          ? `Payment request for ${amount} STRK`
          : 'Encrypted chat message');
      const encrypted = await encryptTransactionNote(
        contentToEncrypt,
        address,
        activeCounterparty,
        composeMode === 'request'
          ? {
              type: 'request',
              requestId: generatedRequestId,
              amount,
              status: 'pending',
              expiresAt: now + 24 * 60 * 60 * 1000,
            }
          : undefined
      );
      rememberOutgoingMessagePreview(encrypted, contentToEncrypt);

      if (composeMode === 'request') {
        await storePaymentRequestMessage({
          payload: encrypted,
          amount,
          createdAt: now,
          requestId: generatedRequestId,
        });
        await refreshNow(account);
      } else if (!attachPayment) {
        await storeEncryptedChatMessage({
          payload: encrypted,
          createdAt: now,
        });
        await refreshNow(account);
      } else {
        setOptimistic((prev) => [
          ...prev,
          {
            id: optimisticId,
            txHash: optimisticHash,
            plaintext: messageText.trim(),
            createdAt: now,
            counterparty: activeCounterparty,
            lifecycle: 'pending',
          },
        ]);

        try {
          const confirmedHash = await sendStrk(activeCounterparty, amount, balance, {
            token: 'STRK',
            encryptedNote: JSON.stringify(encrypted),
            isPrivate: true,
          });

          if (activeRequestId) {
            await updatePaymentRequestMessage({
              requestId: activeRequestId,
              status: 'paid',
              txHash: confirmedHash,
              paidTxHash: confirmedHash,
            });
          }

          await storeEncryptedChatMessage({
            payload: encrypted,
            txHash: confirmedHash,
            createdAt: now,
          });
          await refreshNow(account);

          setOptimistic((prev) =>
            prev.map((item) =>
              item.id === optimisticId
                ? { ...item, txHash: confirmedHash, lifecycle: 'confirmed' }
                : item
            )
          );
        } catch (sendError) {
          setOptimistic((prev) =>
            prev.map((item) =>
              item.id === optimisticId ? { ...item, lifecycle: 'failed' } : item
            )
          );
          throw sendError;
        }
      }

      setMessageText('');
      setAmount('');
      setAttachPayment(false);
      setActiveRequestId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send encrypted message.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-balance text-4xl font-bold">Private Payment Chat</h1>
          <p className="mt-2 text-muted-foreground">
            Encrypted wallet-to-wallet conversations with optional STRK payments.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="border border-[#1A1E22] p-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search conversations..."
                  className="pl-10"
                />
              </div>

              <div className="space-y-2">
                {filteredConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No conversations yet.</p>
                ) : (
                  filteredConversations.map((conversation) => (
                    <button
                      key={conversation.counterparty}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        activeCounterparty === conversation.counterparty
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        setSelectedCounterparty(conversation.counterparty);
                        setManualAddress('');
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {formatAddress(conversation.counterparty)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(conversation.lastMessageAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {conversation.lastMessagePreview}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-3">
                <Label htmlFor="manualCounterparty">Start new conversation</Label>
                <Input
                  id="manualCounterparty"
                  placeholder="0x..."
                  value={manualAddress}
                  onChange={(event) => setManualAddress(event.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </Card>

          <Card className="border border-[#1A1E22] p-4">
            <div className="flex h-[70vh] flex-col">
              <div className="border-b border-border pb-3">
                <p className="text-xs text-muted-foreground">Conversation</p>
                <p className="font-mono text-sm">
                  {isActiveAddressValid ? activeCounterparty : 'Select or enter a valid address'}
                </p>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto py-4">
                {threadMessages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                      No encrypted messages yet in this thread.
                    </div>
                  </div>
                ) : (
                  threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[85%] rounded-lg border p-3 ${
                        message.direction === 'sent'
                          ? 'ml-auto border-primary/30 bg-primary/10'
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <Lock className="h-3 w-3 text-primary" />
                        <span className="text-[11px] text-muted-foreground">Encrypted</span>
                        {message.isPaymentLinked && message.kind !== 'request' && (
                          <Badge variant={lifecycleVariant(message.lifecycle as LocalLifecycle | undefined)} className="h-4 text-[10px]">
                            {message.lifecycle ?? 'confirmed'}
                          </Badge>
                        )}
                        {message.kind === 'request' && (
                          <Badge variant={lifecycleVariant(message.lifecycle as LocalLifecycle | undefined)} className="h-4 text-[10px]">
                            {message.lifecycle ?? 'pending'}
                          </Badge>
                        )}
                        {message.txHash && (
                          <button
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              router.push(`/transactions?highlight=${encodeURIComponent(message.txHash as string)}`)
                            }
                          >
                            <ExternalLink className="h-3 w-3" />
                            Tx
                          </button>
                        )}
                      </div>
                      <p className="text-sm">{message.plaintext}</p>
                      {message.kind === 'request' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Requested amount: {message.amount ?? '0'} STRK
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </p>
                      {message.kind === 'request' &&
                        message.direction === 'received' &&
                        message.lifecycle === 'pending' && (
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                handleRequestAccept({
                                  requestId: message.requestId as string | undefined,
                                  id: message.id,
                                  amount: message.amount,
                                  plaintext: message.plaintext,
                                })
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void handleRequestReject(
                                  message.requestId as string | undefined,
                                  message.id
                                )
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border-t border-border pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={composeMode === 'message' ? 'default' : 'outline'}
                    onClick={() => {
                      setComposeMode('message');
                      setActiveRequestId(null);
                    }}
                  >
                    Send Message
                  </Button>
                  <Button
                    type="button"
                    variant={composeMode === 'request' ? 'default' : 'outline'}
                    onClick={() => {
                      setComposeMode('request');
                      setAttachPayment(false);
                      setActiveRequestId(null);
                    }}
                  >
                    Request Payment
                  </Button>
                </div>

                <Textarea
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder={
                    composeMode === 'request'
                      ? 'Optional note for this payment request...'
                      : 'Write encrypted message...'
                  }
                  rows={3}
                />

                {composeMode === 'message' && (
                  <div className="flex items-center justify-between rounded-md border border-border p-2">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Attach STRK payment</p>
                      <p className="text-xs text-muted-foreground">
                        Add lifecycle-linked payment to this encrypted message.
                      </p>
                    </div>
                    <Switch checked={attachPayment} onCheckedChange={setAttachPayment} />
                  </div>
                )}

                {(attachPayment || composeMode === 'request') && (
                  <div className="space-y-2">
                    <Label htmlFor="chat-amount">
                      {composeMode === 'request' ? 'Request Amount (STRK)' : 'Amount (STRK)'}
                    </Label>
                    <Input
                      id="chat-amount"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Available: {balance} STRK</p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  onClick={submitMessage}
                  disabled={!isActiveAddressValid || submitting || isSending}
                  className="w-full gap-2"
                >
                  {submitting || isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {composeMode === 'request' ? 'Send payment request' : 'Send encrypted message'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
