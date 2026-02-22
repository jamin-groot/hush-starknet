'use client';

import { useEffect } from 'react';
import { useAccount } from '@starknet-react/core';
import { useRealtimeStore } from '@/store/realtimeStore';

export function useRealtimeMessages() {
  const { address, account } = useAccount();
  const initialize = useRealtimeStore((state) => state.initialize);
  const stop = useRealtimeStore((state) => state.stop);
  const messages = useRealtimeStore((state) => state.messages);
  const conversations = useRealtimeStore((state) => state.conversations);
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
    conversations,
    loading: isSyncing,
    getConversationMessages: (counterpartyAddress: string) => {
      const normalized = counterpartyAddress.trim().toLowerCase();
      return messages
        .filter((message) => message.counterparty.toLowerCase() === normalized)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
  };
}
