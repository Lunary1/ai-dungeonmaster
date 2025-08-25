"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Settings,
  Coins,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const buttonRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    loadUserData();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        setUser(session.user);
        await loadProfile(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setUser(user);
      await loadProfile(user.id);
    }
  };

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleAccountMenuToggle = () => {
    if (!showAccountMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setShowAccountMenu(!showAccountMenu);
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "DM":
        return "🎯";
      case "PLAYER":
        return "⚔️";
      default:
        return "❓";
    }
  };

  return (
    <>
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="text-3xl">🐉</div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  AI Dungeon Master
                </h1>
                <p className="text-slate-300 text-sm">Welcome, {user?.email}</p>
              </div>
            </div>

            {/* Navigation and Account menu */}
            <div className="flex items-center gap-4">
              {/* Navigation buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  🏠 Dashboard
                </button>
                <button
                  onClick={() => router.push("/campaigns/new")}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  ➕ Create
                </button>
                <button
                  onClick={() => router.push("/join")}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors text-sm"
                >
                  🎯 Join
                </button>
              </div>

              {/* Account menu */}
              {user ? (
                <div className="relative">
                  <button
                    ref={buttonRef}
                    onClick={handleAccountMenuToggle}
                    className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-xs text-white font-semibold">
                      {profile?.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-medium hidden sm:block">
                      {profile?.display_name || "Account"}
                    </span>
                    {profile?.role && (
                      <span className="text-xs">
                        {getRoleIcon(profile.role)}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/login")}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Portal-style dropdown that appears at document level */}
      {showAccountMenu && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-[9998]"
            onClick={() => setShowAccountMenu(false)}
          />

          {/* Dropdown menu positioned absolutely to the document */}
          <div
            className="fixed w-48 bg-slate-800 border border-white/20 rounded-lg shadow-xl py-1 z-[9999]"
            style={{
              top: `${dropdownPosition.top}px`,
              right: `${dropdownPosition.right}px`,
            }}
          >
            <div className="px-3 py-2 border-b border-white/10">
              <div className="text-sm font-medium text-white">
                {profile?.display_name || "User"}
              </div>
              <div className="text-xs text-slate-400">{user?.email}</div>
              {profile?.role && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs">{getRoleIcon(profile.role)}</span>
                  <span className="text-xs text-slate-300">{profile.role}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                router.push("/account");
                setShowAccountMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              Account Settings
            </button>

            <button
              onClick={() => {
                handleSignOut();
                setShowAccountMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10 flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </>
  );
}
