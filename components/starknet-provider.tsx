'use client';

import { ReactNode } from 'react';
import { StarknetConfig, publicProvider, argent, braavos } from '@starknet-react/core';
import { sepolia } from '@starknet-react/chains';

export function StarknetProvider({ children }: { children: ReactNode }) {
  return (
    <StarknetConfig
      autoConnect
      chains={[sepolia]}
      provider={publicProvider()}
      connectors={[
        argent(),
        braavos(),
      ]}
    >
      {children}
    </StarknetConfig>
  );
}