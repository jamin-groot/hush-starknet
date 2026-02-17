'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Send,
  Receipt,
  Store,
  Settings,
  QrCode,
  History,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    name: 'Send',
    href: '/send',
    icon: Send,
  },
  {
    name: 'QR Scanner',
    href: '/scan',
    icon: QrCode,
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: History,
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: Receipt,
  },
  {
    name: 'Merchant',
    href: '/merchant',
    icon: Store,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-64 flex-col border-r border-border bg-card">
      <div className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Privacy Badge */}
      <div className="m-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            🔒
          </div>
          <span>Privacy Mode</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Your transactions are encrypted with zero-knowledge proofs on Starknet.
        </p>
      </div>
    </nav>
  );
}
