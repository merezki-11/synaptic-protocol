import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { JsonRpcHTTPTransport, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import type { JsonRpcTransport } from '@mysten/sui/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Import dapp-kit default styles
import '@mysten/dapp-kit/dist/index.css';

// Network config — point at devnet by default, easy to switch
const { networkConfig } = createNetworkConfig({
  devnet: { 
    transport: new JsonRpcHTTPTransport({ url: getJsonRpcFullnodeUrl('devnet') }) as unknown as JsonRpcTransport, 
    network: 'devnet' 
  },
  testnet: { 
    transport: new JsonRpcHTTPTransport({ url: getJsonRpcFullnodeUrl('testnet') }) as unknown as JsonRpcTransport, 
    network: 'testnet' 
  },
  mainnet: { 
    transport: new JsonRpcHTTPTransport({ url: getJsonRpcFullnodeUrl('mainnet') }) as unknown as JsonRpcTransport, 
    network: 'mainnet' 
  },
});

const queryClient = new QueryClient();

interface Props {
  children: ReactNode;
}

/**
 * Top-level provider wrapper for Sui wallet connectivity.
 * Wraps the app with:
 *  - React Query (required by dapp-kit)
 *  - SuiClientProvider (Sui fullnode RPC)
 *  - WalletProvider (wallet connection + zkLogin via Enoki)
 */
export function SuiWalletProvider({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          {children}
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

