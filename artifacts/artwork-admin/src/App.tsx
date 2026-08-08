import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import ArtworkManager from './pages/ArtworkManager';
import { AdminGuard, getAdminToken } from './components/AdminGuard';
import { setAuthTokenGetter } from '@workspace/api-client-react';

// Wire the admin session token into every generated API-client hook call.
// getAdminToken reads from sessionStorage so it returns null until the user
// has authenticated via AdminGuard.
setAuthTokenGetter(() => getAdminToken());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404 - Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you are looking for does not exist.</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ArtworkManager} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AdminGuard>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
      </QueryClientProvider>
    </AdminGuard>
  );
}

export default App;
