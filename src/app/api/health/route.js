import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "OpenAI API key not configured. Please add OPENAI_API_KEY to your .env.local file.",
        },
        { status: 500 }
      );
    }

    if (process.env.OPENAI_API_KEY === "your_openai_api_key_here") {
      return NextResponse.json(
        {
          error:
            "Please replace the placeholder OpenAI API key in .env.local with your actual API key.",
        },
        { status: 500 }
      );
    }

    // Check if key has valid format
    if (!process.env.OPENAI_API_KEY.startsWith("sk-")) {
      return NextResponse.json(
        {
          error:
            'OpenAI API key appears to be invalid. Keys should start with "sk-".',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      openai: "configured",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}
