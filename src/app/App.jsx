import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { RecentActivitiesDock } from "../shared/components/RecentActivitiesDock.jsx";

const DashboardPage = lazy(() =>
  import("../features/dashboard/pages/DashboardPage.jsx").then((module) => ({
    default: module.DashboardPage,
  }))
);
const ProfilePage = lazy(() =>
  import("../features/account/pages/ProfilePage.jsx").then((module) => ({
    default: module.ProfilePage,
  }))
);
const SettingsPage = lazy(() =>
  import("../features/account/pages/SettingsPage.jsx").then((module) => ({
    default: module.SettingsPage,
  }))
);
const NotificationsPage = lazy(() =>
  import("../features/account/pages/NotificationsPage.jsx").then((module) => ({
    default: module.NotificationsPage,
  }))
);
const JobDetailsPage = lazy(() =>
  import("../features/job-details/pages/JobDetailsPage.jsx").then((module) => ({
    default: module.JobDetailsPage,
  }))
);
const InquiryDetailsPage = lazy(() =>
  import("../features/inquiry-details/pages/InquiryDetailsPage.jsx").then((module) => ({
    default: module.InquiryDetailsPage,
  }))
);
const PublicJobSheetPage = lazy(() =>
  import("../features/job-details/pages/PublicJobSheetPage.jsx").then((module) => ({
    default: module.PublicJobSheetPage,
  }))
);

function AppRouteLoader() {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
            <div className="text-sm font-semibold text-slate-800">Loading page...</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function LegacyInquiryDirectRedirect() {
  const { inquiryuid = "" } = useParams();
  const safeUid = String(inquiryuid || "").trim();
  if (!safeUid) {
    return <Navigate to="/inquiry-details/new" replace />;
  }
  return <Navigate to={`/inquiry-details/${encodeURIComponent(safeUid)}`} replace />;
}

function LegacyJobDetailsRedirect() {
  const { uid = "" } = useParams();
  const safeUid = String(uid || "").trim();
  if (!safeUid) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/job-details/${encodeURIComponent(safeUid)}`} replace />;
}

function LegacyJobDirectRedirect() {
  const { jobuid = "" } = useParams();
  const safeUid = String(jobuid || "").trim();
  if (!safeUid) {
    return <Navigate to="/" replace />;
  }
  return <Navigate to={`/job-details/${encodeURIComponent(safeUid)}`} replace />;
}

export default function App() {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith("/quote/");

  return (
    <Suspense fallback={<AppRouteLoader />}>
      <>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inquiry-direct" element={<Navigate to="/inquiry-details/new" replace />} />
          <Route path="/inquiry-direct/new" element={<Navigate to="/inquiry-details/new" replace />} />
          <Route path="/inquiry-direct/:inquiryuid" element={<LegacyInquiryDirectRedirect />} />
          <Route path="/inquiry-details/new" element={<InquiryDetailsPage />} />
          <Route path="/inquiry-details/:uid" element={<InquiryDetailsPage />} />
          <Route path="/job-details/new" element={<JobDetailsPage />} />
          <Route path="/job-details/:uid" element={<JobDetailsPage />} />
          <Route path="/quote/:uid" element={<PublicJobSheetPage />} />
          <Route path="/details/:uid" element={<LegacyJobDetailsRedirect />} />
          <Route path="/job-direct" element={<Navigate to="/" replace />} />
          <Route path="/job-direct/:jobuid" element={<LegacyJobDirectRedirect />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
        {!isPublicRoute && <RecentActivitiesDock />}
      </>
    </Suspense>
  );
}
