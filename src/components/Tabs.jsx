import { useState } from "react";
import { Scroll, Swords } from "lucide-react";

export default function Tabs() {
  const [activeTab, setActiveTab] = useState("campaigns");

  const tabs = [
    {
      id: "campaigns",
      label: "Campaigns",
      icon: Scroll,
    },
    {
      id: "adventures",
      label: "Adventures",
      icon: Swords,
    },
  ];

  return (
    <div className="border-b border-glass bg-white/5 px-4">
      <div className="max-w-7xl mx-auto">
        <nav className="-mb-px flex space-x-8" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber/50 focus:ring-offset-2 focus:ring-offset-ink ${
                  isActive
                    ? "border-amber text-parchment"
                    : "border-transparent text-steel hover:text-parchment hover:border-steel/50"
                }`}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
