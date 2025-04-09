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
import { GeneratePayloadPage } from './GeneratePayloadPage.tsx';

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

export const App = memo(function App() {
  useEffect(() => {
    async function initializeAndGeneratePayload() {
      // 1) Wait for Beefy store data to load
      await initAppData(store);

      // 2) Poll aggregator until it fully loads deposit options for your vault
      //    or we run out of attempts. Typically you won't need many attempts.
      const vaultId = 'curve-arb-crvusd-usdt';
      let optionsCount = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        const api = await getTransactApi();
        const opts = await api.fetchDepositOptionsFor(vaultId, () => store.getState());
        optionsCount = opts.length;
        if (optionsCount >= 2) {
          // aggregator has 2+ deposit options => good enough for USDC
          break;
        }
        console.warn(
          `Aggregator not ready or partial data: found ${optionsCount} deposit option(s). Retrying in 1s...`
        );
        await new Promise(r => setTimeout(r, 1000));
      }

      if (optionsCount < 2) {
        // aggregator data never loaded fully
        console.error('Still not enough aggregator deposit options after polling. Aborting.');
        return;
      }

      try {
        // console.log('--- DEPOSIT 0.1 USDC ---');
        // await generateDepositPayload(vaultId, '0.1');

        // console.log('--- WITHDRAW 0.05 ---');
        // await generateWithdrawPayload(vaultId, '0.05');

        console.log('--- WITHDRAW ALL ---');
        await generateWithdrawAllPayload(vaultId);
      } catch (err) {
        console.error('Aggregator error =>', err);
      }
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
                path="/generate-payload"
                element={
                    <GeneratePayloadPage />
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
