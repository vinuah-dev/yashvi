import React, { Suspense } from "react";
import EditMemberClient from "./EditMemberClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 safe-area-inset-bottom">
          {/* Header Placeholder */}
          <div className="bg-white border-b border-gray-200 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-100 rounded-lg animate-pulse"></div>
              <div className="flex-1">
                <div className="h-6 w-32 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-24 bg-gray-100 rounded mt-1 animate-pulse"></div>
              </div>
            </div>
          </div>
          
          {/* Main Content Placeholder */}
          <div className="p-4">
            {/* Form Placeholder */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="space-y-2">
                    <div className="h-4 w-20 bg-gray-100 rounded"></div>
                    <div className="h-12 bg-gray-50 rounded-lg"></div>
                  </div>
                ))}
              </div>
              
              {/* Button Placeholder */}
              <div className="mt-6 space-y-3">
                <div className="h-12 bg-gradient-to-r from-orange-100 to-orange-100 rounded-lg"></div>
                <div className="h-12 bg-gray-100 rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <EditMemberClient />
    </Suspense>
  );
}