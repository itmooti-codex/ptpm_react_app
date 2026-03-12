export function WorkspaceTabPanel({ isMounted = false, isActive = false, children }) {
  if (!isMounted) return null;
  return (
    <div className={isActive ? "block" : "hidden"} aria-hidden={!isActive}>
      {children}
    </div>
  );
}
