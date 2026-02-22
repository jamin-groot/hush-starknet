'use client';

import { ReactNode } from 'react';
import { StarknetConfig, jsonRpcProvider, argent, braavos } from '@starknet-react/core';
import { sepolia } from '@starknet-react/chains';

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      autoConnect
      chains={[sepolia]}
      provider={jsonRpcProvider({
        rpc: () => ({
          nodeUrl: 'https://starknet-sepolia-rpc.publicnode.com',
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