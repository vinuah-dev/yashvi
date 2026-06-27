"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";

export default function ScanAttendancePage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);

  // Mock scan result
  const handleMockScan = () => {
    setScanning(true);
    setTimeout(() => {
      setLastScanned({
        name: "John Doe",
        memberId: "GYM001",
        plan: "Premium",
        status: "active",
        action: "check-in",
        time: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      setScanning(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-900 pb-24">
      <Header title="Scan QR" />

      <main className="px-4 py-4">
        {/* Scanner Area */}
        <div className="relative aspect-square max-w-sm mx-auto mb-6">
          <div className="absolute inset-0 border-2 border-white/30 rounded-3xl overflow-hidden">
            {/* Simulated camera view */}
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              {scanning ? (
                <div className="text-white text-center">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p>Scanning...</p>
                </div>
              ) : (
                <div className="text-white/50 text-center">
                  <span className="text-6xl">📷</span>
                  <p className="mt-4">Camera Preview</p>
                </div>
              )}
            </div>
          </div>

          {/* Corner Markers */}
          <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-[#f0813d] rounded-tl-xl"></div>
          <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-[#f0813d] rounded-tr-xl"></div>
          <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-[#f0813d] rounded-bl-xl"></div>
          <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-[#f0813d] rounded-br-xl"></div>
        </div>

        {/* Instructions */}
        <div className="text-center text-white mb-6">
          <p className="text-lg font-medium">Scan Member QR Code</p>
          <p className="text-gray-400 text-sm">
            Position the QR code within the frame
          </p>
        </div>

        {/* Manual Entry Button */}
        <button
          onClick={handleMockScan}
          className="w-full py-4 bg-white text-black rounded-xl font-medium mb-4"
        >
          {scanning ? "Scanning..." : "Simulate Scan (Demo)"}
        </button>

        <button
          onClick={() => router.push("/my-attendance")}
          className="w-full py-4 bg-white/10 text-white rounded-xl font-medium"
        >
          Manual Entry
        </button>

        {/* Last Scanned Result */}
        {lastScanned && (
          <div className="mt-6 bg-[#f0813d] rounded-xl p-4 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">
                ✓
              </div>
              <div className="flex-1">
                <p className="font-semibold">{lastScanned.name}</p>
                <p className="text-orange-100 text-sm">
                  {lastScanned.action === "check-in"
                    ? "Checked In"
                    : "Checked Out"}{" "}
                  at {lastScanned.time}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Scans */}
        <div className="mt-6">
          <h3 className="text-white font-medium mb-3">Recent Scans</h3>
          <div className="space-y-2">
            {[
              { name: "Jane Smith", time: "07:15 AM", action: "in" },
              { name: "Mike Johnson", time: "06:45 AM", action: "in" },
              { name: "Tom Brown", time: "06:30 AM", action: "in" },
            ].map((scan, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white/10 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {scan.name.charAt(0)}
                  </div>
                  <span className="text-white">{scan.name}</span>
                </div>
                <span className="text-gray-400 text-sm">{scan.time}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

