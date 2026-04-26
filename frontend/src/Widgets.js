// Widgets.js
import React from "react";

export default function Widgets() {
  const items = [
    { label: "📜 Recent Activity", desc: "View your latest actions" },
    { label: "💾 Saved Chats", desc: "Access stored conversations" },
    { label: "📊 Task Progress", desc: "Track ongoing tasks" },
    { label: "⚡ Quick Actions", desc: "Perform shortcuts instantly" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-[#1e293b] rounded-xl p-4 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1 cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-[#58a6ff] mb-2">
            {item.label}
          </h3>
          <p className="text-sm text-gray-400">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

