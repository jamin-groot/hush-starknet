'use client';

import { ReactNode } from 'react';
import { StarknetConfig, jsonRpcProvider, argent, braavos } from '@starknet-react/core';
import { sepolia } from '@starknet-react/chains';
import { getPrimaryRpcUrl } from '@/lib/rpc-router';

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      autoConnect
      chains={[sepolia]}
      provider={jsonRpcProvider({
        rpc: () => ({
          nodeUrl: getPrimaryRpcUrl(),
        }),
      })}
      connectors={[
        argent(),
        braavos(),
      ]}
    >
      {children}
    </StarknetConfig>
  );
}