"use client";

import { useEffect } from "react";
import SignInForm from "./SignInForm";

const FEATURES = ["See where students actually go", "Save spots and check in", "Read and share tips"];

// Shown to signed-out visitors: what the site is, plus sign-in.
export default function WelcomeModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Clicking the backdrop deliberately doesn't close it, so it can't be dismissed by accident.
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h1 id="welcome-title" className="text-2xl font-semibold text-slate-900">
          Study Abroad Mapper
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          A shared map of where students abroad actually go, with tips from people who&apos;ve been.
        </p>

        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700 marker:text-indigo-500">
          {FEATURES.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>

        <p className="mt-6 mb-3 text-sm font-medium text-slate-900">
          Create a free account to save, check in and add places.
        </p>
        <SignInForm autoFocus initialMode="signup" />

        <button
          onClick={onClose}
          className="mt-5 block w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Just look around →
        </button>
      </div>
    </div>
  );
}
