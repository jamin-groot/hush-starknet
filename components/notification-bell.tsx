'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Circle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRealtimeStore } from '@/store/realtimeStore';
import { formatAddress } from '@/lib/blockchain';
import { cn } from '@/lib/utils';

const getLifecycleVariant = (
  lifecycle?:
    | 'pending'
    | 'confirmed'
    | 'failed'
    | 'paid'
    | 'expired'
    | 'rejected'
    | 'claimable'
    | 'claimed'
) => {
  if (lifecycle === 'confirmed' || lifecycle === 'paid' || lifecycle === 'claimed') return 'default';
  if (lifecycle === 'failed' || lifecycle === 'expired' || lifecycle === 'rejected') return 'destructive';
  return 'secondary';
};

export function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const notifications = useRealtimeStore((state) => state.notifications);
  const markNotificationRead = useRealtimeStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useRealtimeStore((state) => state.markAllNotificationsRead);
  const removeNotification = useRealtimeStore((state) => state.removeNotification);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const [animate, setAnimate] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!unreadCount) {
      return;
    }
    setAnimate(true);
    const handle = setTimeout(() => setAnimate(false), 700);
    return () => clearTimeout(handle);
  }, [unreadCount]);

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp - a.timestamp),
    [notifications]
  );

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!open) {
        return;
      }
      const node = containerRef.current;
      if (!node) {
        return;
      }
      if (!node.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const handleNotificationClick = (id: string, txHash?: string) => {
    markNotificationRead(id);
    setOpen(false);

    if (txHash) {
      router.push(`/transactions?highlight=${encodeURIComponent(txHash)}`);
    } else {
      router.push('/transactions');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <Bell className={cn('h-5 w-5 transition-transform', animate && 'animate-bounce')} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {open && (
        <div className="animate-in fade-in-0 zoom-in-95 absolute right-0 top-full z-50 mt-2 w-[420px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl duration-150">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {sorted.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={markAllNotificationsRead}
              >
                <CheckCheck className="mr-1 h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No notifications yet.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto overflow-x-hidden">
              {sorted.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group border-b border-border/70 px-3 py-2.5 transition-colors hover:bg-muted/40',
                    !item.read && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <button
                      className="flex-1 overflow-hidden text-left"
                      onClick={() => handleNotificationClick(item.id, item.txHash)}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {!item.read && <Circle className="h-2.5 w-2.5 shrink-0 fill-primary text-primary" />}
                            <p className="truncate text-[13px] font-medium">{item.title}</p>
                            {item.metadata?.lifecycle && (
                              <Badge variant={getLifecycleVariant(item.metadata.lifecycle)} className="h-4 shrink-0 px-1.5 text-[10px]">
                                {item.metadata.lifecycle}
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">{item.description}</p>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                            {item.metadata?.address && <span>{formatAddress(item.metadata.address)}</span>}
                            {item.metadata?.amount && <span>{item.metadata.amount} STRK</span>}
                          </div>
                        </div>
                      </div>
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 shrink-0 px-1.5 text-[11px] text-muted-foreground opacity-70 transition-opacity hover:text-foreground group-hover:opacity-100"
                      onClick={() => removeNotification(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
