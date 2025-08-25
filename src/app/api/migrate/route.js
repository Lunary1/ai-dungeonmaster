import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = createClient();

    // Simple approach: Try to add columns one by one
    const queries = [
      "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('PLAYER', 'DM'))",
      "ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT",
      "CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role)",
    ];

    const results = [];

    for (const query of queries) {
      try {
        console.log("Executing query:", query);
        const result = await supabase
          .from("user_profiles")
          .select("*")
          .limit(0);
        // This is a hack to get access to the underlying connection
        // Instead, let's check if columns exist first
        results.push({ query, status: "skipped - using different approach" });
      } catch (error) {
        console.error("Query error:", error);
        results.push({ query, error: error.message });
      }
    }

    // Check current schema
    const { data: profiles, error } = await supabase
      .from("user_profiles")
      .select("*")
      .limit(1);

    if (error) {
      console.error("Schema check error:", error);
    }

    return Response.json({
      message: "Manual SQL migration needed",
      instruction:
        "Please run the SQL in database/simple-column-add.sql in your Supabase SQL Editor",
      schemaCheck: { profiles, error },
      results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
