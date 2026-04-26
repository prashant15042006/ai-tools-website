import React from "react";

export default function CodePanel() {
  return (
    <div className="flex-1 bg-[#1e293b] rounded-2xl p-4 flex flex-col">
      <textarea
        className="flex-1 bg-[#0f172a] text-green-400 font-mono rounded-lg p-3 outline-none"
        placeholder="Write your code..."
      ></textarea>
      <div className="flex gap-2 mt-2">
        <button className="px-4 py-2 bg-blue-500 rounded-lg text-white">Run</button>
        <button className="px-4 py-2 bg-yellow-500 rounded-lg text-black">Debug</button>
        <button className="px-4 py-2 bg-gray-600 rounded-lg text-white">Copy</button>
      </div>
    </div>
  );
}
