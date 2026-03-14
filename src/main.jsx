import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { AuthProvider } from "./shared/providers/AuthProvider.jsx";
import { AuthGate } from "./app/AuthGate.jsx";
import { ToastProvider } from "./shared/providers/ToastProvider.jsx";
import { AnnouncementsProvider } from "./shared/providers/AnnouncementsProvider.jsx";
import { CurrentUserProfileProvider } from "./shared/providers/CurrentUserProfileProvider.jsx";
import "./index.css";

const appTree = (
  <AuthProvider>
    <AuthGate>
      {(activeUserId) => (
        <BrowserRouter key={String(activeUserId || "default-user")}>
          <ToastProvider>
            <CurrentUserProfileProvider key={String(activeUserId || "default-user")}>
              <AnnouncementsProvider>
                <App />
              </AnnouncementsProvider>
            </CurrentUserProfileProvider>
          </ToastProvider>
        </BrowserRouter>
      )}
    </AuthGate>
  </AuthProvider>
);

const strictModeFlag = String(import.meta.env.VITE_ENABLE_STRICT_MODE || "").trim().toLowerCase();
const shouldUseStrictMode = import.meta.env.PROD || strictModeFlag === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  shouldUseStrictMode ? <React.StrictMode>{appTree}</React.StrictMode> : appTree
);
