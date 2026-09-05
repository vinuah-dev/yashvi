"use client";

import TrainersView from "@/components/shared/TrainersView";

// Trainers is its own module in the main nav rather than a Settings sub-page.
// /settings/trainers still renders the same component so existing links and the
// back button from trainer detail pages keep working.
export default function TrainersPage() {
  return <TrainersView />;
}
