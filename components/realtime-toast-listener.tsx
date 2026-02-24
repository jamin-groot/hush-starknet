'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { useRealtimeStore } from '@/store/realtimeStore';
import { formatAddress } from '@/lib/blockchain';

type RealtimeNotification = ReturnType<typeof useRealtimeStore.getState>['notifications'][number];

const ELIGIBLE_TYPES = new Set([
  'incoming_transfer',
  'outgoing_pending',
  'outgoing_confirmed',
  'outgoing_failed',
  'encrypted_note',
  'private_message',
  'tx_confirmed',
  'tx_failed',
  'payment_request_arrived',
  'payment_request_paid',
  'payment_request_rejected',
  'payment_request_expired',
  'stealth_payment_detected',
  'stealth_claim_succeeded',
  'stealth_claim_failed',
]);

const normalizeToastEventKey = (notification: RealtimeNotification): string => {
  const hash = notification.txHash ?? notification.dedupeKey;

  if (notification.type === 'outgoing_confirmed' || notification.type === 'tx_confirmed') {
    return `confirmed:${hash}`;
  }
  if (notification.type === 'outgoing_failed' || notification.type === 'tx_failed') {
    return `failed:${hash}`;
  }
  if (notification.type === 'outgoing_pending') {
    return `pending:${hash}`;
  }
  if (notification.type === 'incoming_transfer') {
    return `incoming:${hash}`;
  }
  if (notification.type === 'stealth_payment_detected') {
    return `stealth-detected:${notification.dedupeKey}`;
  }
  if (notification.type === 'stealth_claim_succeeded') {
    return `stealth-claimed:${notification.dedupeKey}`;
  }
  if (notification.type === 'stealth_claim_failed') {
    return `stealth-claim-failed:${notification.dedupeKey}`;
  }
  return `note:${hash}`;
};

const lifecycleVariant = (
  lifecycle?:
    | 'pending'
    | 'confirmed'
    | 'failed'
    | 'paid'
    | 'expired'
    | 'rejected'
    | 'claimable'
    | 'claimed'
): 'secondary' | 'default' | 'destructive' => {
  if (lifecycle === 'confirmed' || lifecycle === 'paid' || lifecycle === 'claimed') return 'default';
  if (lifecycle === 'failed' || lifecycle === 'expired' || lifecycle === 'rejected') return 'destructive';
  return 'secondary';
};

export function RealtimeToastListener() {
  const router = useRouter();
  const notifications = useRealtimeStore((state) => state.notifications);
  const markNotificationRead = useRealtimeStore((state) => state.markNotificationRead);
  const mountedAtRef = useRef(Date.now());
  const shownEventKeysRef = useRef<Set<string>>(new Set());
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ordered = [...notifications].sort((a, b) => a.timestamp - b.timestamp);

    for (const item of ordered) {
      if (!ELIGIBLE_TYPES.has(item.type)) {
        continue;
      }
      if (item.timestamp < mountedAtRef.current) {
        continue;
      }
      if (seenNotificationIdsRef.current.has(item.id)) {
        continue;
      }

      seenNotificationIdsRef.current.add(item.id);
      const eventKey = normalizeToastEventKey(item);
      if (shownEventKeysRef.current.has(eventKey)) {
        continue;
      }
      shownEventKeysRef.current.add(eventKey);

      const previewBits: string[] = [];
      if (item.metadata?.amount) {
        previewBits.push(`${item.metadata.amount} STRK`);
      }
      if (item.metadata?.address) {
        previewBits.push(formatAddress(item.metadata.address));
      }

      toast({
        duration: 4500,
        className: 'cursor-pointer',
        onClick: () => {
          markNotificationRead(item.id);
          if (item.txHash) {
            router.push(`/transactions?highlight=${encodeURIComponent(item.txHash)}`);
            return;
          }
          router.push('/transactions');
        },
        title: item.metadata?.lifecycle ? `${item.title} [${item.metadata.lifecycle}]` : item.title,
        description: previewBits.length > 0 ? `${item.description} — ${previewBits.join(' • ')}` : item.description,
      });
    }
  }, [notifications, markNotificationRead, router]);

  return null;
}
