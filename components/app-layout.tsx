'use client';

import { WalletHeader } from './wallet-header';
import { Navigation } from './navigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      <WalletHeader />
      <div className="flex flex-1 overflow-hidden">
        <Navigation />
        <main className="flex-1 overflow-y-auto bg-background p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
