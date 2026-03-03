import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { ToastProvider } from "./shared/providers/ToastProvider.jsx";
import { AnnouncementsProvider } from "./shared/providers/AnnouncementsProvider.jsx";
import { CurrentUserProfileProvider } from "./shared/providers/CurrentUserProfileProvider.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <CurrentUserProfileProvider>
          <AnnouncementsProvider>
            <App />
          </AnnouncementsProvider>
        </CurrentUserProfileProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
