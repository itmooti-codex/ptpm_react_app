import { useEffect, useRef } from "react";
import {
  ensureGooglePlacesLoaded,
  parseGoogleAddressComponents,
} from "../lib/googlePlaces.js";

export function useGoogleAddressLookup({
  enabled = true,
  country = "au",
  onAddressSelected,
} = {}) {
  const inputRef = useRef(null);
  const onAddressSelectedRef = useRef(onAddressSelected);

  useEffect(() => {
    onAddressSelectedRef.current = onAddressSelected;
  }, [onAddressSelected]);

  useEffect(() => {
    if (!enabled) return undefined;
    let isCancelled = false;
    let listener = null;

    ensureGooglePlacesLoaded()
      .then(() => {
        if (isCancelled || !inputRef.current || !window.google?.maps?.places?.Autocomplete) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          types: ["address"],
          componentRestrictions: country ? { country } : undefined,
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const parsed = parseGoogleAddressComponents(place);
          onAddressSelectedRef.current?.(parsed, place);
        });
      })
      .catch((error) => {
        if (!isCancelled) {
          console.error("[GooglePlaces] Failed to initialize autocomplete", error);
        }
      });

    return () => {
      isCancelled = true;
      if (listener?.remove) listener.remove();
    };
  }, [country, enabled]);

  return inputRef;
}
