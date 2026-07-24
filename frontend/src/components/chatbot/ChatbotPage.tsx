"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { chatbotApi, ChatSession, ChatMessage } from "@/services/chatbot.service";

// Simple custom Markdown parser
function renderMarkdown(text: string) {
  if (!text) return "";
  
  // Clean backslashes from underscores and LaTeX symbols before rendering
  let cleanText = text
    .replace(/\\_/g, "_")
    .replace(/\$\\rightarrow\$/g, "→")
    .replace(/\\rightarrow/g, "→");

  let html = cleanText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Remove raw #, ##, ### markdown headers and replace with clean bold titles
  html = html.replace(
    /^\s*#{1,6}\s+(.+)$/gm,
    '<div class="font-extrabold text-[#2f6d4f] text-sm my-2 pb-0.5 border-b border-[#2f6d4f]/10">$1</div>'
  );

  // Code blocks: ```code```
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre class="bg-emerald-950/90 text-emerald-100 p-4 rounded-xl my-3 font-mono text-sm overflow-x-auto border border-emerald-800/30">${code.trim()}</pre>`
  );

  // Inline code: `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-emerald-100/60 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono text-xs text-emerald-800 font-semibold">$1</code>'
  );

  // Bold: **text**
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");

  // Bullet points: - item or * item
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-5 list-disc my-1">$1</li>');

  // Highlight & bold question prompts (in đậm câu): e.g. 1. "...", Câu 1: ..., Question 1: ...
  html = html.replace(
    /^(\s*(?:(?:Question|Câu)\s+)?\d+\s*[\.\:\)]\s*)(.+)$/gim,
    '<div class="font-bold text-[#14251d] text-sm my-1.5 leading-relaxed">$1<span class="font-extrabold text-[#2f6d4f]">$2</span></div>'
  );

  // Format multiple choice options A., B., C., D.
  html = html.replace(
    /^([A-D])\.\s+(.+)$/gim,
    '<div class="my-1 pl-3 font-semibold text-[#2f6d4f]">$1. <span class="text-[#14251d] font-normal">$2</span></div>'
  );

  // Replace sequences of underscores (3 or more) with a styled dashed blank space element
  html = html.replace(
    /_{3,}/g,
    '<span class="inline-block border-b border-dashed border-[#2f6d4f]/60 min-w-[70px] mx-1 h-3 align-middle"></span>'
  );

  // Paragraphs / line breaks
  html = html.replace(/\n/g, "<br />");

  return <div dangerouslySetInnerHTML={{ __html: html }} className="prose max-w-none text-sm leading-relaxed space-y-1" />;
}

export function ChatbotPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSpeakingId, setIsSpeakingId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starterPrompts = [
    {
      label: "Explain Grammar",
      text: "Giải thích sự khác nhau giữa Thì Hiện tại hoàn thành và Quá khứ đơn bằng tiếng Việt, sau đó cho 3 câu bài tập đục lỗ để tôi làm.",
    },
    {
      label: "Correct My Sentence",
      text: "Sửa lỗi câu sau và giải thích bằng tiếng Việt: 'I have went to the market yesterday for buying some fruits.', sau đó cho bài tập đục lỗ luyện tập.",
    },
    {
      label: "Conversation Practice",
      text: "Let's practice a realistic dialogue! You are a receptionist at a boutique hotel, and I want to book a double room for next weekend. Start the conversation.",
    },
    {
      label: "Business English Collocations",
      text: "Give me 5 common and natural collocations used in professional business meetings, with definitions and examples.",
    },
  ];

  // Auth Guard
  useEffect(() => {
    if (sessionReady && !user) {
      router.replace("/login");
    }
  }, [router, sessionReady, user]);

  // Fetch all chat sessions
  useEffect(() => {
    if (sessionReady && user) {
      fetchSessions();
    }
  }, [sessionReady, user]);

  // Fetch messages when selected session changes
  useEffect(() => {
    if (selectedSessionId) {
      fetchMessages(selectedSessionId);
    } else {
      setMessages([]);
    }
  }, [selectedSessionId]);

  // Scroll to bottom when messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function fetchSessions(selectFirst = false) {
    try {
      const data = await chatbotApi.listSessions();
      setSessions(data);
      if (selectFirst && data.length > 0) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load chat sessions", err);
    }
  }

  async function fetchMessages(sessionId: string) {
    try {
      const data = await chatbotApi.listMessages(sessionId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  }

  async function handleCreateSession(customTitle?: string) {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      const title = customTitle || `Session on ${new Date().toLocaleDateString()}`;
      const newSession = await chatbotApi.createSession(title);
      await fetchSessions();
      setSelectedSessionId(newSession.id);
    } catch (err) {
      console.error("Failed to create new session", err);
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await chatbotApi.deleteSession(id);
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
      }
      fetchSessions();
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    let activeSessionId = selectedSessionId;

    // Create session on the fly if none exists
    if (!activeSessionId) {
      setIsLoading(true);
      try {
        const title = text.length > 25 ? text.substring(0, 25) + "..." : text;
        const newSession = await chatbotApi.createSession(title);
        activeSessionId = newSession.id;
        setSelectedSessionId(activeSessionId);
        // Refresh sessions list
        const sessionsList = await chatbotApi.listSessions();
        setSessions(sessionsList);
      } catch (err) {
        console.error("Failed to auto-create session", err);
        setIsLoading(false);
        return;
      }
    }

    setInputMessage("");
    setIsLoading(true);

    // Optimistically add user's message to UI list
    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sessionId: activeSessionId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const aiReply = await chatbotApi.sendMessage(activeSessionId, text);
      setMessages((prev) => {
        // filter out optimistic message to avoid duplicate or state sync issues, and append response
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...filtered, tempUserMsg, aiReply];
      });
      // Update session order/time in sidebar list
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to get AI reply");
    } finally {
      setIsLoading(false);
    }
  }

  // Text-To-Speech Playback
  function speakMessage(messageId: string, text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeakingId === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeakingId(null);
      return;
    }

    // Cancel current speaking
    window.speechSynthesis.cancel();

    // Clean text from Markdown tags for clean pronunciation
    const cleanText = text
      .replace(/\*\*([^\*]+)\*\*/g, "$1")
      .replace(/\*([^\*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/```[\s\S]*?```/g, "Code block skipped.");

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Select an English voice
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(
      (v) =>
        v.lang.startsWith("en-") &&
        (v.name.includes("Natural") || v.name.includes("Google"))
    ) || voices.find((v) => v.lang.startsWith("en-"));

    if (enVoice) {
      utterance.voice = enVoice;
    }
    utterance.lang = "en-US";
    utterance.rate = 0.95; // Slightly slower for better educational comprehension

    utterance.onend = () => setIsSpeakingId(null);
    utterance.onerror = () => setIsSpeakingId(null);

    setIsSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  }

  async function logout() {
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (!sessionReady || !user) {
    return (
      <main className="dashboard-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", color: "var(--muted)" }}>
          <p style={{ fontWeight: 600, fontSize: "15px" }}>Restoring your session...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#f7f3e8] text-[#14251d]">
      {/* Header */}
      <header className="site-header shrink-0 shadow-sm border-b border-[#14251d]/10 bg-[#f7f3e8]/80 backdrop-blur-md">
        <div className="site-nav flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-[#14251d]/5 md:hidden transition-colors"
              title="Toggle Sidebar"
            >
              ☰
            </button>
            <Link className="brand flex items-center gap-3" href="/dashboard">
              <span className="brand-mark bg-[#14251d] text-[#d8ee8d] font-extrabold w-9 h-9 flex items-center justify-center rounded-xl">EQ</span>
              <span className="font-bold hidden sm:inline text-lg tracking-tight">English Quest</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold hover:text-[#2f6d4f] transition-colors">
              Dashboard
            </Link>
            <button className="text-sm font-semibold text-[#2f6d4f] hover:text-[#214f3a] transition-colors" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            isSidebarOpen ? "translate-x-0 w-80" : "-translate-x-full w-0"
          } transition-all duration-300 ease-in-out border-r border-[#14251d]/10 bg-[#fffdf7] flex flex-col z-20 absolute md:relative h-[calc(100vh-73px)] md:h-auto md:translate-x-0`}
        >
          <div className="p-4 border-b border-[#14251d]/10 flex gap-2">
            <button
              onClick={() => handleCreateSession()}
              disabled={isCreatingSession}
              className="flex-1 py-2.5 px-4 rounded-full bg-[#2f6d4f] text-white font-semibold text-sm hover:bg-[#214f3a] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>+</span> New Session
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <h3 className="px-3 py-2 text-xs font-bold tracking-wider text-[#5d6d64] uppercase">Chat History</h3>
            {sessions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-[#5d6d64] italic">No active sessions. Start a new one!</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    selectedSessionId === s.id
                      ? "bg-[#2f6d4f]/10 text-[#2f6d4f] font-semibold border-l-4 border-[#2f6d4f]"
                      : "hover:bg-[#14251d]/5 text-[#14251d]/85"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-width-0 flex-1 overflow-hidden mr-2">
                    <span>💬</span>
                    <span className="text-sm truncate leading-snug">{s.title}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[#14251d]/10 text-[#5d6d64] hover:text-red-700 transition-all"
                    title="Delete Chat"
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Backdrop for mobile drawer */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-[#14251d]/20 backdrop-blur-xs z-10 md:hidden"
          />
        )}

        {/* Chat Area */}
        <main className="flex-1 flex flex-col bg-[#fffdf7]/50 relative overflow-hidden">
          {/* Active Chat Info */}
          <div className="px-6 py-4 border-b border-[#14251d]/10 bg-[#fffdf7] flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#14251d] text-base leading-tight">
                {selectedSessionId
                  ? sessions.find((s) => s.id === selectedSessionId)?.title || "Active Session"
                  : "AI English Tutor"}
              </h2>
              <p className="text-xs text-[#5d6d64]">
                {selectedSessionId ? "Interactive learning thread" : "Select a session or ask a question to begin"}
              </p>
            </div>
            {selectedSessionId && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-[#2f6d4f] border border-emerald-200">
                Connected
              </span>
            )}
          </div>

          {/* Messages Deck */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.length === 0 && !isLoading ? (
              // Empty State Welcome Dashboard
              <div className="max-w-2xl mx-auto py-10 flex flex-col items-center text-center space-y-8">
                <div className="w-16 h-16 rounded-3xl bg-[#2f6d4f] text-[#d8ee8d] text-3xl flex items-center justify-center shadow-lg transform rotate-[-3deg] hover:rotate-[6deg] transition-all duration-300">
                  🤖
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-extrabold tracking-tight">Your English Learning Assistant</h1>
                  <p className="text-sm text-[#5d6d64] max-w-md mx-auto leading-relaxed">
                    Practice natural conversations, ask grammar questions, translate phrases, or request spelling corrections.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left pt-6">
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p.text)}
                      className="p-5 rounded-2xl bg-[#fffdf7] border border-[#14251d]/10 shadow-xs hover:border-[#2f6d4f] hover:shadow-md hover:translate-y-[-2px] active:translate-y-0 transition-all flex flex-col gap-2 group"
                    >
                      <span className="text-xs font-extrabold text-[#2f6d4f] uppercase tracking-wider">{p.label}</span>
                      <p className="text-xs text-[#5d6d64] leading-snug group-hover:text-[#14251d] transition-colors">{p.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Chat List Stream
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}>
                      {/* AI Avatar */}
                      {!isUser && (
                        <div className="w-8 h-8 rounded-xl bg-[#2f6d4f] text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-xs">
                          👩‍🏫
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl p-4 shadow-sm relative group transition-all duration-200 hover:shadow-md ${
                          isUser
                            ? "bg-[#2f6d4f] text-white rounded-tr-none"
                            : "bg-[#fffdf7] border border-[#14251d]/10 rounded-tl-none text-[#14251d]"
                        }`}
                      >
                        {/* Message content */}
                        {isUser ? (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        ) : (
                          renderMarkdown(m.content)
                        )}

                        {/* Speaker Button overlay on AI Message */}
                        {!isUser && (
                          <div className="flex justify-end mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => speakMessage(m.id, m.content)}
                              className={`p-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:bg-[#14251d]/5 font-semibold transition-colors ${
                                isSpeakingId === m.id ? "text-red-600 bg-red-50" : "text-[#2f6d4f]"
                              }`}
                              title={isSpeakingId === m.id ? "Stop Speaking" : "Listen Response"}
                            >
                              <span>{isSpeakingId === m.id ? "⏹️" : "🔊"}</span>
                              <span className="text-[10px] uppercase tracking-wider">{isSpeakingId === m.id ? "Stop" : "Listen"}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* User Avatar */}
                      {isUser && (
                        <div className="w-8 h-8 rounded-full bg-[#d8ee8d] text-[#214f3a] border border-[#2f6d4f]/20 flex items-center justify-center text-xs font-black shrink-0">
                          {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : "ME"}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* AI Typing Indicator */}
                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-xl bg-[#2f6d4f] text-white flex items-center justify-center text-sm font-bold shrink-0 animate-pulse">
                      👩‍🏫
                    </div>
                    <div className="bg-[#fffdf7] border border-[#14251d]/10 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-1.5 py-5">
                      <span className="w-2 h-2 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Bottom input area */}
          <div className="p-4 border-t border-[#14251d]/10 bg-[#fffdf7]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="max-w-3xl mx-auto flex gap-3 relative items-center"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message or question here..."
                disabled={isLoading}
                className="flex-1 py-3 px-5 pr-14 rounded-full border border-[#14251d]/15 bg-[#fffdf7] focus:outline-none focus:border-[#2f6d4f] focus:ring-2 focus:ring-[#2f6d4f]/10 text-sm placeholder-[#5d6d64]/70 disabled:bg-[#14251d]/5 disabled:cursor-not-allowed transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="absolute right-2 p-2 rounded-full bg-[#2f6d4f] text-white hover:bg-[#214f3a] active:scale-95 disabled:bg-[#14251d]/15 disabled:text-[#5d6d64] disabled:scale-100 disabled:cursor-not-allowed transition-all flex items-center justify-center w-9 h-9 font-bold"
                title="Send Message"
              >
                &rarr;
              </button>
            </form>
            <div className="max-w-3xl mx-auto mt-2 flex justify-between text-[11px] text-[#5d6d64] px-4">
              <span>Press Enter to send. Use Shift+Enter for new lines.</span>
              <span>AI English Tutor can correct errors automatically.</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
