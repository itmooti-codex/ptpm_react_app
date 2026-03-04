import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { JobDirectPage } from "../features/job-direct/pages/JobDirectPage.jsx";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage.jsx";
import { ProfilePage } from "../features/account/pages/ProfilePage.jsx";
import { SettingsPage } from "../features/account/pages/SettingsPage.jsx";
import { NotificationsPage } from "../features/account/pages/NotificationsPage.jsx";
import { JobDetailsPage } from "../features/job-details/pages/JobDetailsPage.jsx";
import { InquiryDirectPage } from "../features/inquiry-direct/pages/InquiryDirectPage.jsx";

function LegacyJobDetailsRedirect() {
  const { uid = "" } = useParams();
  return <Navigate to={`/details/${encodeURIComponent(String(uid || "").trim())}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/job-direct" element={<JobDirectPage />} />
      <Route path="/job-direct/:jobuid" element={<JobDirectPage />} />
      <Route path="/inquiry-direct" element={<InquiryDirectPage />} />
      <Route path="/inquiry-direct/:inquiryuid" element={<InquiryDirectPage />} />
      <Route path="/inquiry-direct/new" element={<InquiryDirectPage />} />
      <Route path="/job-details/:uid" element={<LegacyJobDetailsRedirect />} />
      <Route path="/details/:uid" element={<JobDetailsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
    </Routes>
  );
}
