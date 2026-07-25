import "@fontsource-variable/inter";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary, LoadingShell } from "./components/AppErrorBoundary";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Suspense fallback={<LoadingShell />}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  </React.StrictMode>,
);
