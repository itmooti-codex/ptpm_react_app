export function buildLookupDisplayLabel(
  primaryText = "",
  emailText = "",
  mobileText = "",
  fallbackText = ""
) {
  const primary = String(primaryText || "").trim();
  const email = String(emailText || "").trim();
  const mobile = String(mobileText || "").trim();
  const fallback = String(fallbackText || "").trim();
  const nameWithEmail = primary && email ? `${primary} <${email}>` : primary || email || "";
  if (nameWithEmail && mobile) return `${nameWithEmail} | ${mobile}`;
  return nameWithEmail || mobile || fallback;
}
