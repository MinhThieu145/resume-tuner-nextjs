"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  content: string;
  thread_id: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMessage: Message = { role: "user", content: input };
    setMessages((msgs) => [...msgs, userMessage]);
    setInput("");
    setIsLoading(true);
    
    try {
      // Send all messages to maintain conversation context
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: input,
          thread_id: threadId || "default"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data: ChatResponse = await response.json();
      
      // Save thread ID for continuing the conversation
      setThreadId(data.thread_id);
      
      // Add assistant's response to messages
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", content: data.content },
      ]);
    } catch (error) {
      console.error("Error calling API:", error);
      setMessages((msgs) => [
        ...msgs,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 && (
          <div className="text-gray-400 text-center pt-4">Start the conversation...</div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`px-2 py-1.5 rounded-lg max-w-[85%] whitespace-pre-wrap text-sm ${
                msg.role === "user"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-black dark:bg-[#232323] dark:text-white"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSend}
        className="border-t border-[#e5e5e5] dark:border-[#232323] p-2 bg-white dark:bg-black flex gap-2"
      >
        <input
          className="flex-1 px-2 py-1.5 rounded-lg border border-[#e5e5e5] dark:border-[#232323] bg-white dark:bg-black text-black dark:text-white focus:outline-none focus:ring-1 focus:ring-black/30 dark:focus:ring-white/30 text-sm"
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-2 py-1.5 rounded-lg bg-black text-white dark:bg-white dark:text-black text-sm font-medium hover:bg-gray-900 dark:hover:bg-gray-200 transition disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
          ) : (
            "Send"
          )}
        </button>
      </form>
    </div>
  );
}
