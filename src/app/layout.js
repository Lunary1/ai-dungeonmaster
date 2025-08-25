import { Inter } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthWrapper from "@/components/AuthWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "🐉 AI Dungeonmaster - D&D 5e Adventure",
  description:
    "AI-powered Dungeons & Dragons 5e web app for immersive adventures",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased min-h-screen bg-gray-900 text-white`}
      >
        <ErrorBoundary>
          <AuthWrapper>{children}</AuthWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
