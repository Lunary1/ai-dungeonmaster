import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    console.log("Testing database schema...");

    // Test if role column exists by trying to select it
    const { data: schemaTest, error: schemaError } = await supabase
      .from("user_profiles")
      .select("id, display_name, role, email")
      .limit(1);

    if (schemaError) {
      return NextResponse.json({
        success: false,
        error: "Schema test failed",
        details: schemaError.message,
        hasRoleColumn: false,
      });
    }

    // Test creating a dummy profile to see if it works
    const testUserId = "test-user-" + Date.now();
    const { data: createTest, error: createError } = await supabase
      .from("user_profiles")
      .insert({
        id: testUserId,
        display_name: "Test User",
        email: "test@example.com",
      })
      .select();

    // Clean up test data
    if (createTest) {
      await supabase.from("user_profiles").delete().eq("id", testUserId);
    }

    return NextResponse.json({
      success: true,
      hasRoleColumn: true,
      schemaTestResult: schemaTest,
      createTestSuccess: !createError,
      createError: createError?.message || null,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Test failed",
      details: error.message,
    });
  }
}
