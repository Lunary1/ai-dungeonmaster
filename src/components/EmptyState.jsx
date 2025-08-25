import { BookOpen, Plus } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 p-4 rounded-full bg-gradient-to-br from-plum/20 to-plum/10 border border-glass animate-float">
        <BookOpen className="w-12 h-12 text-plum" />
      </div>

      <h2 className="font-heading text-2xl font-semibold text-parchment mb-3">
        No campaigns yet
      </h2>

      <p className="text-steel mb-8 max-w-md">
        Create one to get started! Your story begins with a single click.
      </p>

      <button className="inline-flex items-center gap-2 rounded-xl2 px-4 py-2 font-medium text-ink bg-amber hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber/60 active:translate-y-[1px] transition">
        <Plus className="w-4 h-4" />
        New Campaign
      </button>
    </div>
  );
}
