'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Circle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useRealtimeStore } from '@/store/realtimeStore';
import { formatAddress } from '@/lib/blockchain';
import { cn } from '@/lib/utils';

const getLifecycleVariant = (lifecycle?: 'pending' | 'confirmed' | 'failed') => {
  if (lifecycle === 'confirmed') return 'default';
  if (lifecycle === 'failed') return 'destructive';
  return 'secondary';
};

export function NotificationBell() {
  const router = useRouter();
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className={cn('h-5 w-5', animate && 'animate-bounce')} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">Notifications</h4>
          {sorted.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllNotificationsRead}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {sorted.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'border-b px-4 py-3 transition-colors hover:bg-muted/50',
                  !item.read && 'bg-primary/5'
                )}
              >
                <button
                  className="w-full text-left"
                  onClick={() => handleNotificationClick(item.id, item.txHash)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {!item.read && <Circle className="h-2.5 w-2.5 fill-primary text-primary" />}
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.metadata?.lifecycle && (
                          <Badge variant={getLifecycleVariant(item.metadata.lifecycle)} className="h-5 text-[10px]">
                            {item.metadata.lifecycle}
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{new Date(item.timestamp).toLocaleString()}</span>
                        {item.metadata?.address && <span>{formatAddress(item.metadata.address)}</span>}
                        {item.metadata?.amount && <span>{item.metadata.amount} STRK</span>}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={() => removeNotification(item.id)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
