import { lazy, memo, type ReactNode, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router'; // Changed Switch to Routes
import { Header } from './components/Header/Header.tsx';
import { Footer } from './components/Footer/Footer.tsx';
import { ScrollRestorer } from './components/ScrollToTop/ScrollRestorer.tsx';
import { initAppData } from './features/data/actions/scenarios.ts';
import { store } from './store.ts';
import { FullscreenTechLoader } from './components/TechLoader/TechLoader.tsx';
import { Router } from './components/Router/Router.tsx';
import { DefaultMeta } from './components/Meta/DefaultMeta.tsx';
import { HelmetProvider } from 'react-helmet-async';
import { Redirects } from './components/Redirects/Redirects.tsx';
import { Stepper } from './components/Stepper/Stepper.tsx';
import { Layout } from './components/Layout/Layout.tsx';
import { AddTokenToWallet } from './components/AddTokenToWallet/AddTokenToWallet.tsx';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary.tsx';
import { AppVersionCheck } from './components/AppVersionCheck/AppVersionCheck.tsx';
import { Tenderly } from './components/Tenderly/Tenderly.tsx';
import { BreakpointProvider } from './components/MediaQueries/BreakpointProvider.tsx';

import { getTransactApi } from './features/data/apis/instances.ts';
import BigNumber from 'bignumber.js';

const HomePage = lazy(() => import('./features/home/HomePage.tsx'));
const VaultPage = lazy(() => import('./features/vault/VaultPage.tsx'));
const OnRampPage = lazy(() => import('./features/on-ramp/OnRampPage.tsx'));
const BridgePage = lazy(() => import('./features/bridge/BridgePage.tsx'));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage.tsx'));
const TreasuryPage = lazy(() => import('./features/treasury/TreasuryPage.tsx'));
const NotFoundPage = lazy(() => import('./features/pagenotfound/NotFoundPage.tsx'));

type BoundariesProps = {
  children?: ReactNode;
};
const Boundaries = memo(function Boundaries({ children }: BoundariesProps) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<FullscreenTechLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
});

async function generateDepositPayload(vaultId: string, inputAmount: string) {
  const state = store.getState();
  console.log({ state, vaults: state.entities.vaults });
  const api = await getTransactApi();

  // Fetch available deposit options for the vault
  const options = await api.fetchDepositOptionsFor(vaultId, () => state);
  console.log({ options });
  const option = options.find((o) => o.inputs[0].id === 'USDC')!; // picking the option to deposit with USDC
  console.debug({ option });

  const inputToken = option.inputs[0]; // usually the primary deposit token

  // Generate quote for the deposit amount
  const quotes = await api.fetchDepositQuotesFor(
    [option],
    [{ token: inputToken, amount: new BigNumber(inputAmount), max: false }],
    () => state
  );
  console.log({ quotes });

  const quote = quotes[0]; // pick randomly the first quote
  console.debug({ quote });

  // Get the transaction step
  const step = await api.fetchDepositStep(quote, () => state, () => '');
  console.debug({ step });

   // Dispatch the thunk action to retrieve the actual payload
  const result = await store.dispatch(step.action);

  console.log('Deposit Payload:', result);
}

export const App = memo(function App() {
  useEffect(() => {
    async function initializeAndGeneratePayload() {
      await initAppData(store); // Wait until initialization finishes
      await generateDepositPayload('aura-arb-susde-gyd', '0.1');
    }

    void initializeAndGeneratePayload();
  }, []);

  return (
    <BreakpointProvider>
      <HelmetProvider>
        <Router>
          <ScrollRestorer />
          <DefaultMeta />
          <Redirects />
          <Layout header={<Header />} footer={<Footer />}>
            <Routes>
              <Route
                path="/"
                element={
                  <Boundaries>
                    <HomePage />
                  </Boundaries>
                }
              />
              <Route
                path="/:network/vault/:id"
                caseSensitive={true}
                element={
                  <Boundaries>
                    <VaultPage />
                  </Boundaries>
                }
              />
              <Route
                path="/vault/:id"
                element={
                  <Boundaries>
                    <VaultPage />
                  </Boundaries>
                }
              />
              <Route
                path="/onramp"
                element={
                  <Boundaries>
                    <OnRampPage />
                  </Boundaries>
                }
              />
              <Route
                path="/bridge"
                element={
                  <Boundaries>
                    <BridgePage />
                  </Boundaries>
                }
              />
              <Route
                path="/dashboard/:address"
                element={
                  <Boundaries>
                    <DashboardPage mode={'url'} />
                  </Boundaries>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <Boundaries>
                    <DashboardPage mode={'wallet'} />
                  </Boundaries>
                }
              />
              <Route
                path="/treasury"
                element={
                  <Boundaries>
                    <TreasuryPage />
                  </Boundaries>
                }
              />
              <Route
                path="*"
                element={
                  <Boundaries>
                    <NotFoundPage />
                  </Boundaries>
                }
              />
            </Routes>
            <Stepper />
            <AddTokenToWallet />
          </Layout>
        </Router>
      </HelmetProvider>
      <AppVersionCheck />
      {import.meta.env.DEV ? <Tenderly /> : null}
    </BreakpointProvider>
  );
});
