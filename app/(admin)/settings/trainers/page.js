"use client";

import TrainersView from "@/components/shared/TrainersView";

// The trainer list also appears behind the Member/Trainer switch on /members.
// Both render the same component so the two never drift apart.
export default function TrainersPage() {
  return <TrainersView />;
}
