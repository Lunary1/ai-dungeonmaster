"use client";

import { useState } from "react";
import { setUserRole } from "@/lib/auth-helper";
import { supabase } from "@/lib/supabase";

export default function RoleSelectionModal({ user, onRoleSelected }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRoleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRole) {
      setError("Please select a role");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("Setting role for user:", user.id, "to:", selectedRole);
      console.log("Full user object:", user);

      const {
        success,
        profile,
        error: roleError,
      } = await setUserRole(user.id, selectedRole, supabase);

      console.log("Role setting result:", {
        success,
        profile,
        error: roleError,
      });

      if (!success) {
        throw new Error(roleError?.message || "Role may have already been set");
      }

      // Call the callback with the updated profile
      onRoleSelected(profile);
    } catch (err) {
      console.error("Role selection error:", err);
      setError(err.message || "Failed to set role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">🎭</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Choose Your Role
          </h2>
          <p className="text-slate-300">
            Are you here to lead adventures or embark on them?
          </p>
        </div>

        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="block">
              <input
                type="radio"
                name="role"
                value="DM"
                checked={selectedRole === "DM"}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="sr-only"
              />
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedRole === "DM"
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <div className="font-semibold text-white">
                      Dungeon Master
                    </div>
                    <div className="text-sm text-slate-300">
                      Create and guide epic adventures
                    </div>
                  </div>
                </div>
              </div>
            </label>

            <label className="block">
              <input
                type="radio"
                name="role"
                value="PLAYER"
                checked={selectedRole === "PLAYER"}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="sr-only"
              />
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedRole === "PLAYER"
                    ? "border-purple-500 bg-purple-500/20"
                    : "border-white/20 hover:border-white/40"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">⚔️</div>
                  <div>
                    <div className="font-semibold text-white">Player</div>
                    <div className="text-sm text-slate-300">
                      Experience thrilling quests and adventures
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedRole}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? "Setting Role..." : "Continue"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-400 text-center">
          This choice is permanent and cannot be changed later.
        </div>
      </div>
    </div>
  );
}
