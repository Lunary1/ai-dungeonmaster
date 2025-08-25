"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User, Mail, Shield, Calendar, LogOut } from "lucide-react";

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUser(user);

      // Load profile data
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
      } else {
        setProfile(profile);
        setDisplayName(profile.display_name || "");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .update({ display_name: displayName })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      setMessage("Profile updated successfully!");

      // Clear message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage("Failed to update profile");
    } finally {
      setUpdating(false);
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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "DM":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "PLAYER":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Account Settings
          </h1>
          <p className="text-slate-300">Manage your profile and preferences</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-2xl text-white font-bold">
              {profile?.display_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {profile?.display_name || "Unknown User"}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300 text-sm">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
              <Shield className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm text-slate-400">Role</div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getRoleIcon(profile?.role)}</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs border ${getRoleBadgeColor(
                      profile?.role
                    )}`}
                  >
                    {profile?.role || "Not Set"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <div className="text-sm text-slate-400">Member Since</div>
                <div className="text-white">
                  {profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : "Unknown"}
                </div>
              </div>
            </div>
          </div>

          {/* Update Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter your display name"
                maxLength={50}
              />
            </div>

            {message && (
              <div
                className={`text-sm text-center ${
                  message.includes("successfully")
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={updating || !displayName.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              {updating ? "Updating..." : "Update Profile"}
            </button>
          </form>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>

          <button
            onClick={handleSignOut}
            className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
