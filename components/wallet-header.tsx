'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Wallet, Power, Copy, Check, Search } from 'lucide-react';
import { connectWallet, disconnectWallet, getWallet, formatAddress } from '@/lib/blockchain';
import type { WalletAccount } from '@/lib/blockchain';

const POPULAR_COINS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'STRK', name: 'Starknet' },
  { symbol: 'BNB', name: 'Binance Coin' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'ADA', name: 'Cardano' },
];

export function WalletHeader() {
  const [wallet, setWallet] = useState<WalletAccount>(getWallet());
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const filteredCoins = POPULAR_COINS.filter(
    (coin) =>
      coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connected = await connectWallet();
      setWallet(connected);
    } catch (error) {
      console.error('[v0] Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      setWallet(getWallet());
    } catch (error) {
      console.error('[v0] Failed to disconnect wallet:', error);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!wallet.isConnected) {
    return (
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <span className="font-mono text-lg font-bold text-primary">H</span>
          </div>
          <span className="text-xl font-semibold">Hush</span>
        </div>
        <Button onClick={handleConnect} disabled={isConnecting} className="gap-2">
          <Wallet className="h-4 w-4" />
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 border-b border-[#1A1E22] bg-card/80 backdrop-blur-xl px-6 py-3">
      <div className="flex items-center justify-between gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/10">
            <span className="font-mono text-xl font-bold text-primary">H</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Hush</span>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for any coin or information..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              className="h-12 w-full rounded-xl border border-[#1A1E22] bg-muted/50 pl-12 pr-4 text-sm backdrop-blur-sm transition-all placeholder:text-muted-foreground/60 hover:bg-muted/70 focus-visible:border-primary/30 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          {/* Search Results Dropdown */}
          {searchFocused && searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-[#1A1E22] bg-card/95 shadow-2xl backdrop-blur-xl z-50 overflow-hidden">
              {filteredCoins.length > 0 ? (
                <div className="p-2">
                  {filteredCoins.map((coin) => (
                    <button
                      key={coin.symbol}
                      className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-all hover:bg-primary/5"
                      onClick={() => {
                        setSearchQuery('');
                        setSearchFocused(false);
                      }}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 font-mono text-sm font-bold text-primary shadow-sm">
                        {coin.symbol[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{coin.symbol}</div>
                        <div className="text-xs text-muted-foreground">{coin.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wallet Address */}
        <div className="flex items-center gap-3 rounded-xl border border-[#1A1E22] bg-muted/50 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex h-2 w-2 animate-pulse rounded-full bg-primary shadow-sm shadow-primary/50" />
          <span className="font-mono text-sm font-medium">{formatAddress(wallet.address)}</span>
          <button
            onClick={copyAddress}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Copy address"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
