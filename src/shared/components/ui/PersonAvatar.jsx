import { useEffect, useMemo, useState } from "react";
import { toText } from "../../utils/formatters.js";

function buildInitials(name) {
  const normalizedName = toText(name);
  if (!normalizedName || normalizedName.toLowerCase() === "unknown") return "U";

  const parts = normalizedName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
  }

  return normalizedName.slice(0, 2).toUpperCase();
}

export function PersonAvatar({
  name = "",
  image = "",
  className = "h-8 w-8 text-xs",
  initialsClassName = "",
}) {
  const normalizedName = toText(name) || "Unknown";
  const normalizedImage = toText(image);
  const initials = useMemo(() => buildInitials(normalizedName), [normalizedName]);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImage]);

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8f0fb] font-semibold text-[#003882] ${className}`}
      title={normalizedName}
      aria-hidden="true"
    >
      {normalizedImage && !imageFailed ? (
        <img
          src={normalizedImage}
          alt={normalizedName}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={initialsClassName}>{initials}</span>
      )}
    </div>
  );
}
