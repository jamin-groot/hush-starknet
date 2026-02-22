'use client';

import { useEffect } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRealtimeStore } from '@/store/realtimeStore';

export function useRealtimeTransactions() {
  const { address, account } = useAccount();
  const initialize = useRealtimeStore((state) => state.initialize);
  const stop = useRealtimeStore((state) => state.stop);
  const refreshNow = useRealtimeStore((state) => state.refreshNow);

  const transactions = useRealtimeStore((state) => state.transactions);
  const stats = useRealtimeStore((state) => state.stats);
  const lifecycleByHash = useRealtimeStore((state) => state.lifecycleByHash);
  const isSyncing = useRealtimeStore((state) => state.isSyncing);

  useEffect(() => {
    if (!address) {
      stop();
      return;
    }
    initialize(address, account);
    return () => {
      stop();
    };
  }, [address, account, initialize, stop]);

  return {
    transactions,
    stats,
    lifecycleByHash,
    isSyncing,
    refreshNow: () => refreshNow(account),
  };
}
