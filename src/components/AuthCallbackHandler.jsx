"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Handle the OAuth callback
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          router.push("/login?error=auth_callback_failed");
          return;
        }

        if (data.session) {
          // User successfully authenticated
          console.log("User authenticated:", data.session.user);

          // Check if user profile exists, create if not
          const { data: profile, error: profileError } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", data.session.user.id)
            .single();

          if (profileError && profileError.code === "PGRST116") {
            // Profile doesn't exist, create it
            const displayName =
              data.session.user.user_metadata?.full_name ||
              data.session.user.user_metadata?.name ||
              data.session.user.email?.split("@")[0] ||
              "Adventurer";

            const { error: insertError } = await supabase
              .from("user_profiles")
              .insert({
                id: data.session.user.id,
                display_name: displayName,
              });

            if (insertError) {
              console.error("Error creating user profile:", insertError);
              // Don't fail authentication just because profile creation failed
            }
          }

          // Small delay to ensure session is fully established
          setTimeout(() => {
            router.push("/dashboard");
          }, 500);
        } else {
          // No session found
          router.push("/login");
        }
      } catch (error) {
        console.error("Unexpected error in auth callback:", error);
        router.push("/login?error=unexpected_error");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🐉</div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Completing Authentication...
        </h1>
        <div className="flex items-center justify-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-8 w-8 text-purple-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-slate-300">Please wait...</span>
        </div>
      </div>
    </div>
  );
}
