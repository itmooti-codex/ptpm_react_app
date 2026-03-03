import { useContext } from "react";
import { CurrentUserProfileContext } from "../providers/CurrentUserProfileProvider.jsx";

export function useCurrentUserProfile() {
  const context = useContext(CurrentUserProfileContext);
  if (!context) {
    throw new Error("useCurrentUserProfile must be used within CurrentUserProfileProvider.");
  }
  return context;
}
