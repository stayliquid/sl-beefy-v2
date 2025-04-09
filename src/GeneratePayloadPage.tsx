import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import BigNumber from 'bignumber.js';
import { store } from './store.ts';
import { getTransactApi, getWalletConnectionApi } from './features/data/apis/instances.ts';
import { initAppData } from './features/data/actions/scenarios.ts';

async function generateDepositPayload(vaultId: string, inputAmount: string) {
  const state = store.getState();
  const api = await getTransactApi();

  const options = await api.fetchDepositOptionsFor(vaultId, () => state);
  if (!options.length) throw new Error('No deposit options available');
  // Example: pick any USDC-based deposit
  const option = options.find(o => o.inputs[0].id === 'USDC') ?? options[0];
  if (!option) throw new Error('No deposit option found');

  const inputToken = option.inputs[0];
  const quotes = await api.fetchDepositQuotesFor(
    [option],
    [{ token: inputToken, amount: new BigNumber(inputAmount), max: false }],
    () => store.getState()
  );
  if (!quotes.length) throw new Error('No deposit quotes found');
  const quote = quotes[0];

  const step = await api.fetchDepositStep(quote, () => store.getState(), () => '');
  const result = await store.dispatch(step.action);

  return result;
}

async function generateWithdrawPayload(vaultId: string, withdrawAmount: string) {
  const state = store.getState();
  const api = await getTransactApi();

  const options = await api.fetchWithdrawOptionsFor(vaultId, () => state);
  if (!options.length) throw new Error('No withdraw options available');
  // Example: pick any aggregator-based USDC withdraw
  const option = options.find(o => o.wantedOutputs[0]?.id === 'USDC') ?? options[0];
  if (!option) throw new Error('No withdraw option found');

  const isFull = new BigNumber(withdrawAmount).lte(0);
  // aggregator doesn't like 0, so pass a small nonzero if full
  const inputAmounts = [
    {
      token: option.inputs[0],
      amount: isFull ? new BigNumber('0.000001') : new BigNumber(withdrawAmount),
      max: isFull,
    },
  ];

  const quotes = await api.fetchWithdrawQuotesFor([option], inputAmounts, () => store.getState());
  if (!quotes.length) throw new Error('No withdraw quotes found');
  const quote = quotes[0];

  const step = await api.fetchWithdrawStep(quote, () => store.getState(), () => '');
  const result = await store.dispatch(step.action);

  return result;
}

async function generateWithdrawAllPayload(vaultId: string) {
  // aggregator will interpret max: true if we pass a <=0 amount
  return await generateWithdrawPayload(vaultId, '-1');
}

export function GeneratePayloadPage() {
  const location = useLocation();

  // final aggregator output or error
  const [jsonResult, setJsonResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // for external scraping, we can store a small "ready" boolean
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function main() {
      try {
        // 1) parse URL params
        const searchParams = new URLSearchParams(location.search);
        const vaultId = searchParams.get('vaultId');
        const type = searchParams.get('type'); // 'deposit' or 'withdraw'
        const rawAmount = searchParams.get('amount') || 'all';
        const userWallet = searchParams.get('wallet'); // optional

        if (!vaultId || !type) {
          throw new Error('Missing vaultId or type=? (deposit/withdraw)');
        }
        if (type !== 'deposit' && type !== 'withdraw') {
          throw new Error('Type must be deposit or withdraw');
        }

        // 2) Initialize store
        await initAppData(store);

        // 3) If user address is provided, re-inject
        if (userWallet) {
          const walletApi = await getWalletConnectionApi();
          await walletApi.reInjectBackendWallet(userWallet, 'https://arb1.arbitrum.io/rpc');
        }

        // 4) Poll aggregator readiness for deposit options
        let attempts = 0;
        while (attempts < 5) {
          const api = await getTransactApi();
          const depositOpts = await api.fetchDepositOptionsFor(vaultId, () => store.getState());
          if (depositOpts.length >= 2) break;
          attempts++;
          await new Promise(r => setTimeout(r, 1000));
        }

        // 5) aggregator calls
        let result;
        if (type === 'deposit') {
          // partial deposit
          const amount = rawAmount === 'all' ? '1' : rawAmount; // no aggregator concept of depositAll by passing 'all'?
          result = await generateDepositPayload(vaultId, amount);
        } else {
          // withdraw
          if (rawAmount === 'all') {
            result = await generateWithdrawAllPayload(vaultId);
          } else {
            result = await generateWithdrawPayload(vaultId, rawAmount);
          }
        }

        setJsonResult({ from: userWallet, to: result?.to, data: result?.data, value: result?.value });
        setReady(true);
      } catch (err: any) {
        setError(err.message || String(err));
        setReady(true);
      }
    }

    void main();
  }, [location.search]);

  // We produce a single JSON object that external code can read.
  // We'll store aggregator result + "ready" + error, so they can parse it easily.
  const finalOutput = {
    ready,
    error,
    aggregatorPayload: jsonResult,
  };

  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {JSON.stringify(finalOutput, null, 2)}
    </pre>
  );
}