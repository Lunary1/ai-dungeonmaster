"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AuthCallbackHandler from "./AuthCallbackHandler";

export default function AuthWrapper({ children }) {
  const [isHandlingCallback, setIsHandlingCallback] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check if this is an OAuth callback
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);

      // Check for OAuth callback parameters
      if (hashParams.get("access_token") || searchParams.get("code")) {
        setIsHandlingCallback(true);
      }
    };

    // Only run on client side
    if (typeof window !== "undefined") {
      handleAuthCallback();
    }
  }, [pathname]);

  if (isHandlingCallback) {
    return <AuthCallbackHandler />;
  }

  return children;
}
