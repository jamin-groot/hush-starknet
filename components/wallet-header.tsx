'use client';

import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Copy, Check } from 'lucide-react';
import { useAccount, useConnect } from '@starknet-react/core';
import { formatAddress } from '@/lib/blockchain';
import { useWalletStore } from '@/store/walletStore';
import { ensureEncryptionIdentity } from '@/lib/privacy';
import { NotificationBell } from '@/components/notification-bell';

export function WalletHeader() {
  const { address, isConnected } = useAccount();
  const setWallet = useWalletStore((s) => s.setWallet);

  const { connectAsync, connectors, pendingConnector, isPending } = useConnect();
  const [copied, setCopied] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ⭐ STEP 2 — sync Starknet wallet → Zustand store
  useEffect(() => {
    if (isConnected && address) {
      setWallet(address);
      ensureEncryptionIdentity(address).catch((error) => {
        console.error('Failed to initialize privacy keys:', error);
      });
    }
  }, [isConnected, address, setWallet]);

  const preferredConnector = useMemo(() => {
    return (
      connectors.find((c) => c.name.toLowerCase().includes('argent')) ??
      connectors.find((c) => c.name.toLowerCase().includes('braavos')) ??
      connectors[0]
    );
  }, [connectors]);

  const findAvailableConnector = async () => {
    const prioritized = preferredConnector
      ? [preferredConnector, ...connectors.filter((c) => c.id !== preferredConnector.id)]
      : connectors;

    for (const connector of prioritized) {
      try {
        const candidate = connector as unknown as { available?: () => boolean | Promise<boolean> };
        const isAvailable =
          typeof candidate.available === 'function' ? await candidate.available() : true;

        if (isAvailable) {
          return connector;
        }
      } catch {
        // Try the next connector if one throws during availability check.
      }
    }

    return undefined;
  };

  const handleConnect = async () => {
    setConnectError(null);

    const connectorToUse = await findAvailableConnector();
    if (!connectorToUse) {
      setConnectError('No Starknet wallet detected. Open ArgentX/Braavos and try again.');
      return;
    }

    try {
      await connectAsync({ connector: connectorToUse });
    } catch {
      setConnectError('Connection was cancelled or failed. Please try again.');
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div>
          <span className="text-xl font-semibold">Hush</span>
          {connectError && (
            <p className="mt-1 text-xs text-destructive">{connectError}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button
            onClick={handleConnect}
            disabled={!preferredConnector || isPending}
            className="gap-2"
          >
            <Wallet className="h-4 w-4" />
            {pendingConnector || isPending ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <span className="text-xl font-semibold">Hush</span>

      <div className="flex items-center gap-3">
        <NotificationBell />

        <span className="font-mono text-sm">
          {address ? formatAddress(address) : ''}
        </span>

        <button onClick={copyAddress}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
