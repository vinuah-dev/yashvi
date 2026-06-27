import { useState, useEffect } from "react";

// Cache features in memory during session (avoid re-fetching on every page)
const featureCache = {};

export function useFeatureAccess(gymId) {
  const [features, setFeatures] = useState(featureCache[gymId] || null);
  const [loading, setLoading] = useState(!featureCache[gymId]);

  useEffect(() => {
    if (!gymId) { setLoading(false); return; }
    if (featureCache[gymId]) { setFeatures(featureCache[gymId]); setLoading(false); return; }

    fetch(`/api/features?gym_id=${gymId}`)
      .then((r) => r.json())
      .then((data) => {
        const f = data.features || {};
        featureCache[gymId] = f;
        setFeatures(f);
      })
      .catch(() => setFeatures({}))
      .finally(() => setLoading(false));
  }, [gymId]);

  // isEnabled: returns true if feature enabled OR if we have no data (fail open)
  const isEnabled = (moduleId) => {
    if (!features) return true; // loading state — show content, don't flicker
    return features[moduleId] !== false;
  };

  // Invalidate cache (call after SSA toggles a feature)
  const invalidate = () => { delete featureCache[gymId]; };

  return { features, loading, isEnabled, invalidate };
}
