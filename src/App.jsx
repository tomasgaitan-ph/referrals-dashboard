import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import Dashboard from './pages/Dashboard'
import ReferralDetail from './pages/ReferralDetail'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'referrals-cache',
})

export default function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <BrowserRouter>
        <Routes>
          <Route path="/"             element={<Dashboard />}      />
          <Route path="/referral/:id" element={<ReferralDetail />} />
        </Routes>
      </BrowserRouter>
    </PersistQueryClientProvider>
  )
}
