"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          // User is authenticated, redirect to dashboard
          router.push("/dashboard");
        } else {
          // User is not authenticated, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Auth check error:", error);
        // Default to login on error
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Show loading while checking auth
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🐉</div>
        <h1 className="text-3xl font-bold text-white mb-2">
          AI Dungeon Master
        </h1>
        <p className="text-slate-300 mb-6">Loading...</p>
        <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full mx-auto"></div>
      </div>
    </div>
  );
}
