import React, { useState } from "react";
import { motion } from "framer-motion";
import API_BASE_URL from "./apiConfig";

export default function ChatPanel() {
  const [messages, setMessages] = useState([{ text: "Hello 👋", sender: "ai" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await response.json();
      const aiMessage = { text: data.reply || "❌ Error connecting to backend", sender: "ai" };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      setMessages((prev) => [...prev, { text: "❌ Error connecting to backend", sender: "ai" }]);
    }

    setLoading(false);
    setInput("");
  };

  return (
    <motion.div
      className="bg-[#1e293b] rounded-2xl p-4 flex flex-col h-[350px]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl max-w-[70%] ${
              msg.sender === "user"
                ? "bg-blue-500 text-black self-end"
                : "bg-gray-700 text-white self-start"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-xl bg-gray-700 text-white self-start">
            AI is typing...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 p-2 rounded-lg bg-gray-800 text-white outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white font-bold"
          onClick={sendMessage}
        >
          Send
        </button>
      </div>
    </motion.div>
  );
}
