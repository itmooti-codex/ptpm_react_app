import { Routes, Route } from "react-router-dom";
import { JobDirectPage } from "../features/job-direct/pages/JobDirectPage.jsx";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage.jsx";
import { ProfilePage } from "../features/account/pages/ProfilePage.jsx";
import { SettingsPage } from "../features/account/pages/SettingsPage.jsx";
import { NotificationsPage } from "../features/account/pages/NotificationsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/job-direct" element={<JobDirectPage />} />
      <Route path="/job-direct/:jobuid" element={<JobDirectPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
    </Routes>
  );
}
