import Link from "next/link";
import SignInForm from "@/components/SignInForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Study Abroad Mapper</h1>
        <p className="mt-1 mb-6 text-sm text-slate-600">
          Sign in to add places, leave tips, and save spots.
        </p>

        <SignInForm />

        <Link href="/" className="mt-6 block text-center text-sm text-slate-500 hover:text-slate-700">
          ← Back to the map
        </Link>
      </div>
    </main>
  );
}
