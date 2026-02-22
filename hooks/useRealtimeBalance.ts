'use client';

import { useEffect } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRealtimeStore } from '@/store/realtimeStore';

export function useRealtimeBalance() {
  const { address, account } = useAccount();
  const initialize = useRealtimeStore((state) => state.initialize);
  const stop = useRealtimeStore((state) => state.stop);
  const refreshNow = useRealtimeStore((state) => state.refreshNow);
  const balance = useRealtimeStore((state) => state.balance);
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
    balance,
    loading: isSyncing,
    refetchBalance: () => refreshNow(account),
  };
}
