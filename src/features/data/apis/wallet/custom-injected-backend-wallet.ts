import type { WalletInit, GetInterfaceHelpers } from '@web3-onboard/common';
// import { Wallet } from 'ethers';
import { ethers, JsonRpcProvider } from 'ethers';

export const createInjectedBackendWallet = (
  // privateKey: string,
  walletAddress: string,
  rpcUrl: string
): WalletInit => {
  return () => ({
    label: 'Injected Backend Wallet',
    getIcon: async () => 
      // Provide a simple SVG icon as a data URL
      'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
        <rect width="40" height="40" fill="#59A662" rx="8"/>
        <text x="20" y="25" font-size="20" fill="#fff" text-anchor="middle">SL</text>
      </svg>`),
    getInterface: async (_: GetInterfaceHelpers) => {
      const provider = new JsonRpcProvider(rpcUrl);
      const { chainId } = await provider.getNetwork();

      const injectedProvider = {
        request: async ({ method, params }: { method: string; params?: any[] }) => {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              // return [wallet.address];
              return [walletAddress];
            case 'eth_chainId':
              return ethers.toBeHex(chainId);
            case 'eth_sendTransaction':
                throw new Error('No signing available in data-only mode');
                // const wallet = new Wallet(privateKey, provider);
                // const tx = await wallet.sendTransaction(params![0]);
                // return tx.hash;
            throw new Error('No signing available in data-only mode');
            case 'eth_estimateGas':
              return (await provider.estimateGas(params![0])).toString();
            case 'eth_call':
              return provider.call(params![0]);
            case 'eth_getBalance':
              return (await provider.getBalance(params![0])).toString();
            case 'eth_getTransactionReceipt':
              return provider.getTransactionReceipt(params![0]);
            case 'eth_gasPrice':
              return (await provider.getFeeData()).gasPrice?.toString();
            default:
              return provider.send(method, params || []);
          }
        },
        on: () => {},
        removeListener: () => {},
      };

      return {
        provider: injectedProvider,
        instance: injectedProvider,
        // accounts: [{ address: wallet.address }],
        accounts: [{ address: walletAddress }],
        chains: [{ id: ethers.toBeHex(chainId) }],
      };
    },
  });
};