'use client';

import { useEffect } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRealtimeStore } from '@/store/realtimeStore';

export function useRealtimeMessages() {
  const { address, account } = useAccount();
  const initialize = useRealtimeStore((state) => state.initialize);
  const stop = useRealtimeStore((state) => state.stop);
  const messages = useRealtimeStore((state) => state.messages);
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
    messages,
    loading: isSyncing,
  };
}
