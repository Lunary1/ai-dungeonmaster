"use client";

import { useState, useEffect } from "react";

export default function StartupCheck({ onReady }) {
  const [checks, setChecks] = useState({
    env: {
      status: "checking",
      message: "Checking environment configuration...",
    },
    api: { status: "pending", message: "Waiting for environment check..." },
  });

  useEffect(() => {
    performChecks();
  }, []);

  const performChecks = async () => {
    // Check environment variables
    try {
      const envResponse = await fetch("/api/health");
      if (envResponse.ok) {
        setChecks((prev) => ({
          ...prev,
          env: {
            status: "success",
            message: "Environment configured correctly",
          },
        }));

        // If env check passes, test the API
        await testAPI();
      } else {
        const envData = await envResponse.json();
        setChecks((prev) => ({
          ...prev,
          env: {
            status: "error",
            message: envData.error || "Environment configuration failed",
          },
          api: {
            status: "skipped",
            message: "Skipped due to environment error",
          },
        }));
      }
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        env: {
          status: "error",
          message: "Could not check environment configuration",
        },
        api: { status: "skipped", message: "Skipped due to environment error" },
      }));
    }
  };

  const testAPI = async () => {
    setChecks((prev) => ({
      ...prev,
      api: { status: "checking", message: "Testing AI API connection..." },
    }));

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "test",
          campaignId: "startup-test",
          messageHistory: [],
        }),
      });

      if (response.ok) {
        setChecks((prev) => ({
          ...prev,
          api: { status: "success", message: "AI API is working correctly" },
        }));

        // All checks passed, app is ready
        setTimeout(() => onReady(), 1000);
      } else {
        const errorData = await response.json();
        setChecks((prev) => ({
          ...prev,
          api: {
            status: "error",
            message: errorData.error || "API test failed",
          },
        }));
      }
    } catch (error) {
      setChecks((prev) => ({
        ...prev,
        api: { status: "error", message: "Could not connect to AI API" },
      }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "checking":
        return "⏳";
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "skipped":
        return "⏭️";
      default:
        return "⏸️";
    }
  };

  const allChecksComplete = Object.values(checks).every(
    (check) =>
      check.status === "success" ||
      check.status === "error" ||
      check.status === "skipped"
  );

  const hasErrors = Object.values(checks).some(
    (check) => check.status === "error"
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-black bg-opacity-30 rounded-lg backdrop-blur-sm border border-purple-500 border-opacity-30 shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            🐉 AI Dungeonmaster
          </h1>
          <p className="text-purple-200">Preparing your adventure...</p>
        </div>

        <div className="space-y-4">
          {Object.entries(checks).map(([key, check]) => (
            <div
              key={key}
              className="flex items-start gap-3 p-3 bg-purple-900 bg-opacity-30 rounded-lg"
            >
              <span className="text-xl">{getStatusIcon(check.status)}</span>
              <div className="flex-1">
                <div className="text-white font-medium capitalize">
                  {key} Check
                </div>
                <div className="text-purple-200 text-sm">{check.message}</div>
              </div>
            </div>
          ))}
        </div>

        {allChecksComplete && hasErrors && (
          <div className="mt-6 p-4 bg-red-800 bg-opacity-50 border border-red-600 rounded-lg">
            <h3 className="text-red-200 font-medium mb-2">
              ⚙️ Configuration Needed
            </h3>
            <p className="text-red-300 text-sm mb-3">
              Please check your setup. Make sure you have:
            </p>
            <ul className="text-red-300 text-sm space-y-1 list-disc list-inside">
              <li>Added your OpenAI API key to .env.local</li>
              <li>Restarted the development server</li>
              <li>Valid API key with sufficient credits</li>
            </ul>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              Retry Checks
            </button>
          </div>
        )}

        {allChecksComplete && !hasErrors && (
          <div className="mt-6 text-center">
            <div className="text-green-400 font-medium">
              🎉 Ready to adventure!
            </div>
            <div className="text-purple-200 text-sm">
              Loading your chat interface...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
