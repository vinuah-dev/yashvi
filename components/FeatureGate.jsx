"use client";

import { Lock } from "lucide-react";

export default function FeatureGate({ enabled, featureName, children }) {
  if (enabled === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">
          {featureName || "Feature"} Unavailable
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          This feature is not available for your gym. Please contact your gym admin for more information.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
