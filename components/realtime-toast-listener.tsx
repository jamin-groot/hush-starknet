'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
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
  return `note:${hash}`;
};

const lifecycleVariant = (
  lifecycle?: 'pending' | 'confirmed' | 'failed' | 'paid' | 'expired' | 'rejected'
): 'secondary' | 'default' | 'destructive' => {
  if (lifecycle === 'confirmed' || lifecycle === 'paid') return 'default';
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
        title: (
          <div className="flex items-center gap-2">
            <span>{item.title}</span>
            {item.metadata?.lifecycle && (
              <Badge variant={lifecycleVariant(item.metadata.lifecycle)} className="h-4 px-1.5 text-[10px]">
                {item.metadata.lifecycle}
              </Badge>
            )}
          </div>
        ),
        description: (
          <div className="space-y-1">
            <p className="line-clamp-2 text-xs">{item.description}</p>
            {previewBits.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{previewBits.join(' • ')}</p>
            )}
          </div>
        ),
      });
    }
  }, [notifications, markNotificationRead, router]);

  return null;
}
