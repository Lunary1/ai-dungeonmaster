import { createClient } from "@supabase/supabase-js";

/**
 * Centralized authentication helper for API routes
 * Extracts and validates user from Authorization header
 */
export async function getAuthenticatedUser(request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return {
        user: null,
        error: new Error("No authorization header"),
        client: null,
      };
    }

    const token = authorization.substring(7);
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      return { user: null, error, client: null };
    }

    return { user, error: null, client };
  } catch (error) {
    console.error("Auth helper error:", error);
    return { user: null, error, client: null };
  }
}

/**
 * Get user profile with role information
 */
export async function getUserProfile(userId, supabaseClient) {
  try {
    const { data: profile, error } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    return { profile, error };
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return { profile: null, error };
  }
}

/**
 * Create user profile if it doesn't exist
 */
export async function ensureUserProfile(user, supabaseClient) {
  try {
    const { profile, error: fetchError } = await getUserProfile(
      user.id,
      supabaseClient
    );

    if (fetchError && fetchError.code === "PGRST116") {
      // Profile doesn't exist, create it
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Adventurer";

      const { data: newProfile, error: insertError } = await supabaseClient
        .from("user_profiles")
        .insert({
          id: user.id,
          display_name: displayName,
          email: user.email,
          // role stays null until user selects it
        })
        .select();

      if (insertError) {
        console.error("Error creating user profile:", insertError);
        return { profile: null, error: insertError };
      }

      if (!newProfile || newProfile.length === 0) {
        return { profile: null, error: new Error("Failed to create profile") };
      }

      return { profile: newProfile[0], error: null };
    }

    return { profile, error: fetchError };
  } catch (error) {
    console.error("Error ensuring user profile:", error);
    return { profile: null, error };
  }
}

/**
 * Update user role (with better error handling and debugging)
 */
export async function setUserRole(userId, role, supabaseClient, user = null) {
  try {
    if (!["PLAYER", "DM"].includes(role)) {
      return { success: false, error: new Error("Invalid role") };
    }

    console.log("setUserRole called with:", { userId, role, hasUser: !!user });

    // First, try to get the current user profile directly
    const { data: currentProfile, error: fetchError } = await supabaseClient
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    console.log("Current profile check:", { currentProfile, fetchError });

    if (fetchError) {
      console.error("Error fetching current profile:", fetchError);
      return { success: false, error: fetchError };
    }

    if (!currentProfile) {
      return {
        success: false,
        error: new Error(
          "User profile not found. Please ensure profile is created first."
        ),
      };
    }

    // Check if role is already set
    if (currentProfile.role && currentProfile.role !== null) {
      return {
        success: false,
        error: new Error(`Role already set to ${currentProfile.role}`),
      };
    }

    // Update the role
    console.log("Updating role for profile:", currentProfile.id);
    const { data, error } = await supabaseClient
      .from("user_profiles")
      .update({ role })
      .eq("id", userId)
      .select();

    console.log("Update result:", { data, error });

    if (error) {
      console.error("Error updating user role:", error);
      return { success: false, error };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: new Error("No profile was updated - user may not exist"),
      };
    }

    return { success: true, profile: data[0], error: null };
  } catch (error) {
    console.error("Error setting user role:", error);
    return { success: false, error };
  }
}
