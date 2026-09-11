import { useMemo } from "react";

export type TrackingMode = "lot" | "unit";

/**
 * Resolves the active tracking mode (FR11):
 * the `?tracking=lot|unit` query parameter wins over the compile-time
 * default injected as __WIP_TRACKING__ (from WIP_TRACKING / -WIP).
 */
export default function useTrackingMode(): {
  mode: TrackingMode;
  isLot: boolean;
} {
  return useMemo(() => {
    const param = new URLSearchParams(window.location.search)
      .get("tracking")
      ?.toLowerCase();
    const mode: TrackingMode =
      param === "lot" || param === "unit" ? param : __WIP_TRACKING__;
    return { mode, isLot: mode === "lot" };
  }, []);
}
