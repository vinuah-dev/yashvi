"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";

const mockExercises = {
  1: {
    name: "Squats",
    muscle: "Quadriceps, Glutes",
    sets: 4,
    reps: "12",
    rest: "60s",
    instructions: [
      "Stand with feet shoulder-width apart",
      "Keep your chest up and core tight",
      "Lower down as if sitting in a chair",
      "Push through your heels to stand back up",
      "Keep knees in line with toes",
    ],
    tips: "Focus on depth rather than speed. Keep your back straight throughout the movement.",
    video: null,
  },
};

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTime, setRestTime] = useState(60);

  const exercise = mockExercises[id] || mockExercises[1];

  const startRest = () => {
    setIsResting(true);
    const timer = setInterval(() => {
      setRestTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsResting(false);
          setRestTime(60);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const completeSet = () => {
    if (currentSet < exercise.sets) {
      setCurrentSet((prev) => prev + 1);
      startRest();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title={exercise.name} />

      <main className="px-4 py-4 space-y-4">
        {/* Exercise Image Placeholder */}
        <div className="bg-gray-200 rounded-xl aspect-video flex items-center justify-center">
          <span className="text-6xl">🏋️</span>
        </div>

        {/* Exercise Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {exercise.name}
          </h2>
          <p className="text-gray-500 mb-4">Target: {exercise.muscle}</p>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.sets}
              </p>
              <p className="text-xs text-gray-500">Sets</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.reps}
              </p>
              <p className="text-xs text-gray-500">Reps</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-2xl font-bold text-gray-900">
                {exercise.rest}
              </p>
              <p className="text-xs text-gray-500">Rest</p>
            </div>
          </div>
        </div>

        {/* Set Tracker */}
        <div className="bg-orange-50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium text-orange-900">Current Set</span>
            <span className="text-[#f0813d]">
              {currentSet} of {exercise.sets}
            </span>
          </div>
          <div className="flex gap-2 mb-4">
            {[...Array(exercise.sets)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full ${
                  i < currentSet ? "bg-[#f0813d]" : "bg-orange-200"
                }`}
              ></div>
            ))}
          </div>

          {isResting ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#f0813d] mb-2">Rest Time</p>
              <p className="text-4xl font-bold text-orange-900">{restTime}s</p>
            </div>
          ) : (
            <button
              onClick={completeSet}
              className="w-full py-3 bg-[#f0813d] text-white rounded-xl font-medium"
            >
              {currentSet >= exercise.sets
                ? "Complete Exercise"
                : "Complete Set"}
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">How to Do It</h3>
          <ol className="space-y-2">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                  {i + 1}
                </span>
                <span className="text-gray-700 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Tips */}
        <div className="bg-orange-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <p className="font-medium text-orange-900">Pro Tip</p>
              <p className="text-sm text-[#f0813d]">{exercise.tips}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
