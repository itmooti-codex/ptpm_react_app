import { useContext } from "react";
import { AnnouncementsContext } from "../providers/AnnouncementsProvider.jsx";

export function useAnnouncements() {
  const context = useContext(AnnouncementsContext);
  if (!context) {
    throw new Error("useAnnouncements must be used within AnnouncementsProvider.");
  }
  return context;
}
