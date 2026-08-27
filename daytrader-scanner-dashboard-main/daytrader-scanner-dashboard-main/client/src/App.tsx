import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SupabaseAuthProvider } from "./contexts/SupabaseAuthContext";
import "./dashboard-switcher.css";
import BinanceDashboard from "./pages/BinanceDashboard";
import AuthPage, { AuthCallbackPage } from "./pages/AuthPage";
import Home from "./pages/Home";
import { SessionControl, SupabaseAuthGate } from "./components/SupabaseAuthGate";

function ProtectedHome() { return <SupabaseAuthGate><Home /></SupabaseAuthGate>; }
function ProtectedBinanceDashboard() { return <SupabaseAuthGate><BinanceDashboard /></SupabaseAuthGate>; }

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/auth"}>{() => <AuthPage />}</Route>
      <Route path={"/auth/reset"}>{() => <AuthPage initialMode="update-password" />}</Route>
      <Route path={"/auth/callback"} component={AuthCallbackPage} />
      <Route path={"/"} component={ProtectedHome} />
      <Route path={"/binance"} component={ProtectedBinanceDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <SupabaseAuthProvider><Router /><SessionControl /></SupabaseAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
