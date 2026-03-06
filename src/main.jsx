import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { ToastProvider } from "./shared/providers/ToastProvider.jsx";
import { AnnouncementsProvider } from "./shared/providers/AnnouncementsProvider.jsx";
import { CurrentUserProfileProvider } from "./shared/providers/CurrentUserProfileProvider.jsx";
import "./index.css";

const appTree = (
  <BrowserRouter>
    <ToastProvider>
      <CurrentUserProfileProvider>
        <AnnouncementsProvider>
          <App />
        </AnnouncementsProvider>
      </CurrentUserProfileProvider>
    </ToastProvider>
  </BrowserRouter>
);

const strictModeFlag = String(import.meta.env.VITE_ENABLE_STRICT_MODE || "").trim().toLowerCase();
const shouldUseStrictMode = import.meta.env.PROD || strictModeFlag === "true";

ReactDOM.createRoot(document.getElementById("root")).render(
  shouldUseStrictMode ? <React.StrictMode>{appTree}</React.StrictMode> : appTree
);
