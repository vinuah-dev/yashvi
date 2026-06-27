import { Dumbbell } from "lucide-react";

const loadingImages = {
  members: "/loading-states/fetch-members.png",
  trainers: "/loading-states/fetch-trainers.png",
  amenities: "/loading-states/fetch-amenities.png",
  notifications: "/loading-states/fetch-notifications.png",
  finance: "/loading-states/fetch-finance.png",
  knowledge: "/loading-states/fetch-knowledge.png",
  shop: "/loading-states/fetch-shop.png",
};

const loadingLabels = {
  members: "Fetching members",
  trainers: "Fetching personal trainers",
  amenities: "Fetching gym amenities",
  notifications: "Fetching notifications",
  finance: "Fetching finance data",
  knowledge: "Fetching knowledge posts",
  shop: "Fetching shop products",
};

export default function RouteLoadingScreen({
  label,
  variant = "default",
  compact = false,
}) {
  const image = loadingImages[variant];
  const displayLabel = label || loadingLabels[variant] || "Loading your workspace";

  return (
    <div className={`flex items-center justify-center bg-[#f1efed] px-6 ${compact ? "min-h-[420px] rounded-3xl" : "min-h-screen"}`}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-[#f0813d]/20 bg-white text-center shadow-[0_22px_60px_rgba(26,28,28,0.12)]">
        {image ? (
          <div className="relative aspect-square overflow-hidden bg-[#1a1c1c]">
            <img
              src={image}
              alt={displayLabel}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        ) : (
          <div className="mx-auto mt-6 mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#f0813d] to-[#9c4400] shadow-[0_16px_34px_rgba(240,129,61,0.32)]">
            <Dumbbell className="h-8 w-8 text-white" />
          </div>
        )}
        <div className="p-6">
          <h2 className="text-xl font-black text-[#1a1c1c]">SS Fitness</h2>
          <p className="mt-2 text-sm font-semibold text-[#897267]">{displayLabel}</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#ffdbca]">
          <div className="h-full w-1/2 animate-[routeLoading_1.05s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#f0813d] to-[#9c4400]" />
          </div>
        </div>
      </div>
    </div>
  );
}
