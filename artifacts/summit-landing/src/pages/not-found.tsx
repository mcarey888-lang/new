import { Link } from "react-router-dom";
import { Mountain } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function NotFound() {
  usePageMeta({
    title: "Page Not Found — SummitReady",
    description: "The page you're looking for doesn't exist.",
  });

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-950 text-white px-4">
      <Mountain className="h-16 w-16 text-green-500 mb-6 opacity-60" />
      <h1 className="text-5xl font-bold mb-3">404</h1>
      <p className="text-xl text-gray-400 mb-8">Page not found</p>
      <p className="text-gray-500 text-center max-w-xs mb-10">
        The page you're looking for has moved or doesn't exist.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-semibold transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
