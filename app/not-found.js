"use client";

import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-page-dark flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="relative w-80 h-80 sm:w-96 sm:h-96 mx-auto">
          <Image
            src="/notfound/silver-padlock-with-hole-middle-that-says-lock_899894-27949.png"
            alt="Page not found"
            fill
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Page Not Found
          </h1>
          <p className="text-base sm:text-lg text-gray-400 leading-relaxed">
            The page you are looking for doesn&apos;t exist or was moved.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 btn-gradient-orange text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Go Home
        </Link>
      </div>
    </div>
  );
}

