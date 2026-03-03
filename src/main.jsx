import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { ToastProvider } from "./shared/providers/ToastProvider.jsx";
import { AnnouncementsProvider } from "./shared/providers/AnnouncementsProvider.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AnnouncementsProvider>
          <App />
        </AnnouncementsProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
