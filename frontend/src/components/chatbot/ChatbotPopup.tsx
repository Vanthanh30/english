"use client";

import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { chatbotApi, ChatSession, ChatMessage } from "@/services/chatbot.service";

// Determine if a message actually contains exercises to show helper buttons
function isExerciseMessage(text: string): boolean {
  if (!text) return false;
  const cleanText = text.replace(/\\_/g, "_");
  const lower = cleanText.toLowerCase();

  // 1. If it has clear blanks or multiple choice options, it is a practice sheet!
  const hasBlanks = /_{3,}|\.{3,}/.test(cleanText);
  const hasOptions = /^[A-D]\.\s+/gim.test(cleanText);
  
  if (hasBlanks || hasOptions) {
    return true;
  }

  // 2. If the message is AI's grading response, it shouldn't show "Làm bài tập" or "Tải về"
  if (
    lower.includes("chính xác!") || 
    lower.includes("chưa chính xác") || 
    lower.includes("sửa lại:") || 
    lower.includes("grading result") || 
    lower.includes("điểm số") || 
    lower.includes("score:") ||
    lower.includes("tuyệt vời!") ||
    lower.includes("hoàn thành bài tập")
  ) {
    return false;
  }

  // 3. Fallback checks for exercises
  return (
    lower.includes("bài tập") ||
    lower.includes("exercise") ||
    lower.includes("câu hỏi") ||
    /\d+[\.\)]\s+/.test(cleanText)
  );
}

interface Option {
  key: string;
  text: string;
}

interface Question {
  id: number;
  prompt: string;
  options: Option[];
  type: "multiple-choice" | "fill-in-the-blank" | "short-answer";
  rawText: string;
  isCorrect?: boolean;
}


function isOutroLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  const outroKeywords = [
    "hãy làm bài",
    "chúc bạn",
    "chúc các bạn",
    "cứ làm",
    "cứ từ từ",
    "nếu có câu hỏi",
    "nếu bạn có",
    "đừng ngần ngại",
    "đừng lo",
    "hy vọng",
    "hope this helps",
    "good luck",
    "let me know if",
    "chúc học vui",
    "chúc học tốt",
    "chúc mừng",
    "hẹn gặp",
    "cảm ơn bạn"
  ];
  return outroKeywords.some(keyword => lower.includes(keyword));
}

function isFeedbackLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  const feedbackKeywords = [
    "chính xác!",
    "chính xác.",
    "chưa chính xác",
    "bạn chưa điền",
    "chưa điền vào",
    "gợi ý:",
    "sửa lại:",
    "hãy thử điền",
    "hãy thử làm",
    "bạn hãy thử",
    "với chủ ngữ",
    "động từ phải",
    "lưu ý:",
    "chú ý:",
    "nhớ suy nghĩ"
  ];
  return feedbackKeywords.some(keyword => lower.includes(keyword));
}

function parseExercises(text: string): { intro: string; questions: Question[] } {
  if (!text) return { intro: "", questions: [] };

  const lines = text.split("\n");
  const questions: Question[] = [];
  let currentQuestion: Question | null = null;
  const introLines: string[] = [];
  let isOutroActive = false;
  let isFeedbackActive = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isQuestionStart = line.match(/^\s*(?:(?:Question|Câu)\s+)?(\d+)\s*[\.\:\)]\s*(.+)$/i);
    const isOptionStart = line.match(/^\s*[-*]?\s*([A-D]|[a-d])\s*[\.\)\:\-]\s*(.+)$/i);

    // Look ahead to check for remaining questions in the file
    const remainingText = lines.slice(i).join("\n");
    const hasMoreQuestions = /^\s*(?:(?:Question|Câu)\s+)?(\d+)\s*[\.\:\)]/mi.test(remainingText);

    // If we have started parsing questions, check if we entered outro block
    if (questions.length > 0 || currentQuestion) {
      if (!isQuestionStart && !isOptionStart && !hasMoreQuestions) {
        if (isOutroLine(line) || isOutroActive) {
          isOutroActive = true;
          continue; // skip this line, it's conversational outro, not question content
        }
      }
    }

    const questionMatch = line.match(/^\s*(?:(?:Question|Câu)\s+)?(\d+)\s*[\.\:\)]\s*(.+)$/i);

    if (questionMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        id: parseInt(questionMatch[1], 10),
        prompt: questionMatch[2].trim(),
        options: [],
        type: "short-answer",
        rawText: line,
      };
      isFeedbackActive = false; // Reset feedback flag for new question
    } else if (currentQuestion) {
      currentQuestion.rawText += "\n" + line;

      // Check if it's an option like "A. ...", "B) ...", "a. ...", "A - ..."
      const optionMatch = line.match(/^\s*[-*]?\s*([A-D]|[a-d])\s*[\.\)\:\-]\s*(.+)$/);
      if (optionMatch) {
        currentQuestion.options.push({
          key: optionMatch[1].toUpperCase(),
          text: optionMatch[2].replace(/\*\*/g, "").trim(),
        });
        currentQuestion.type = "multiple-choice";
      } else {
        // Check if we hit feedback content
        if (isFeedbackLine(line)) {
          isFeedbackActive = true;
        }
        // Only append to prompt if we haven't hit feedback
        if (!isFeedbackActive) {
          currentQuestion.prompt += "\n" + line;
        }
      }
    } else {
      introLines.push(line);
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  // Refine question types and clean prompt
  questions.forEach((q) => {
    // 1. Remove double asterisks ** from prompt
    let cleanPrompt = q.prompt.replace(/\*\*/g, "").trim();

    // 2. Replace incorrect answers after parenthesized cues with underscores
    cleanPrompt = cleanPrompt.replace(/(\([\w\/\s\.-]+\))\s+((?:not\s+)?(?:[a-zA-Z\/\']+))/gi, "$1 ______");

    q.prompt = cleanPrompt;

    if (q.options.length > 0) {
      q.type = "multiple-choice";
    } else if (q.prompt.includes("______") || q.prompt.includes("...") || q.prompt.includes("___")) {
      q.type = "fill-in-the-blank";
    } else {
      q.type = "short-answer";
    }

    // Identify if the question has already been answered correctly
    const lowerRaw = q.rawText.toLowerCase();
    q.isCorrect = (lowerRaw.includes("chính xác!") || lowerRaw.includes("chính xác.")) && !lowerRaw.includes("chưa chính xác");
  });

  return {
    intro: introLines.join("\n").trim(),
    questions,
  };
}

function generateAnswerSheetText(questions: Question[], answers: Record<number, any>): string {
  let text = "";
  questions.forEach((q) => {
    if (q.type === 'multiple-choice') {
      const selectedKey = answers[q.id] || "";
      const selectedOption = q.options.find((opt: any) => opt.key === selectedKey);
      text += `${q.id}. Selected Answer: ${selectedKey}${selectedOption ? ` (${selectedOption.text})` : ""}\n`;
    } else if (q.type === 'fill-in-the-blank') {
      // Reconstruct the sentence with the filled-in answers bolded
      const parts = q.prompt.split(/_{3,}|\.{3,}/g);
      let reconstructed = "";
      const ansList = answers[q.id] || [];
      parts.forEach((part: string, idx: number) => {
        reconstructed += part;
        if (idx < parts.length - 1) {
          const filled = ansList[idx] || "_______";
          reconstructed += ` **${filled}** `;
        }
      });
      text += `${q.id}. ${reconstructed}\n`;
    } else {
      const ans = answers[q.id] || "";
      text += `${q.id}. Answer: **${ans}**\n`;
    }
  });
  return text;
}

// Clean exercise text by removing markdown escaping backslashes from underscores
function cleanExerciseText(text: string): string {
  if (!text) return "";
  // Remove backslash escapes for underscores (e.g. \_\_\_ to ___)
  let result = text.replace(/\\_/g, "_");
  // Standardize blanks to 10 underscores
  result = result.replace(/_{3,}/g, "__________");
  return result;
}

// Simple custom Markdown parser
function renderMarkdown(text: string) {
  if (!text) return "";
  
  // Clean backslashes from underscores before rendering
  let cleanText = text.replace(/\\_/g, "_");

  let html = cleanText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks: ```code```
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre class="bg-emerald-950 text-emerald-100 p-3 rounded-lg my-2 font-mono text-[11px] overflow-x-auto border border-emerald-800/30">${code.trim()}</pre>`
  );

  // Inline code: `code`
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-emerald-100/60 px-1 py-0.5 rounded font-mono text-[10px] text-emerald-800 font-semibold">$1</code>'
  );

  // Bold: **text**
  html = html.replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text*
  html = html.replace(/\*([^\*]+)\*/g, "<em>$1</em>");

  // Bullet points: - item or * item
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc my-0.5">$1</li>');

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

  return <div dangerouslySetInnerHTML={{ __html: html }} className="prose max-w-none text-xs leading-relaxed space-y-0.5" />;
}

export function ChatbotPopup() {
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionsList, setShowSessionsList] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Interactive Exercise Workspace Modal states
  const [isOpenWorkspace, setIsOpenWorkspace] = useState(false);
  const [activeExerciseText, setActiveExerciseText] = useState("");
  const [userAnswersText, setUserAnswersText] = useState("");
  const [workspaceGradingResult, setWorkspaceGradingResult] = useState<string | null>(null);
  const [isSubmittingWorkspace, setIsSubmittingWorkspace] = useState(false);

  // Phase 2 states
  const [activeExerciseMsgId, setActiveExerciseMsgId] = useState<string | null>(null);
  const [submittedMessageIds, setSubmittedMessageIds] = useState<string[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<"interactive" | "text">("interactive");
  const [parsedExercises, setParsedExercises] = useState<{ intro: string; questions: Question[] }>({ intro: "", questions: [] });
  const [interactiveAnswers, setInteractiveAnswers] = useState<Record<number, any>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const starterPrompts = [
    {
      label: "Give me Exercises",
      text: "Cho tôi 3 câu bài tập trắc nghiệm điền từ tiếng Anh để luyện tập giới từ.",
      icon: "📝"
    },
    {
      label: "Explain present perfect",
      text: "Explain when to use present perfect tense vs simple past in English.",
      icon: "💡"
    },
    {
      label: "Correct sentence",
      text: "Correct this sentence: 'I am study English since two years.'",
      icon: "✏️"
    },
  ];

  // Listen for global open event
  useEffect(() => {
    function handleOpenEvent() {
      setIsOpen(true);
    }
    window.addEventListener("open-ai-tutor", handleOpenEvent);
    return () => {
      window.removeEventListener("open-ai-tutor", handleOpenEvent);
    };
  }, []);

  // Load submitted exercises from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("submitted_exercise_msg_ids");
      if (saved) {
        try {
          setSubmittedMessageIds(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse submitted exercise message IDs", e);
        }
      }
    }
  }, []);

  const markMessageAsSubmitted = (msgId: string) => {
    setSubmittedMessageIds((prev) => {
      const updated = [...prev, msgId];
      if (typeof window !== "undefined") {
        localStorage.setItem("submitted_exercise_msg_ids", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Fetch all chat sessions when user is available
  useEffect(() => {
    if (sessionReady && user && isOpen) {
      fetchSessions();
    }
  }, [sessionReady, user, isOpen]);

  // Fetch messages when selected session changes
  useEffect(() => {
    if (selectedSessionId && isOpen) {
      fetchMessages(selectedSessionId);
    } else {
      setMessages([]);
    }
  }, [selectedSessionId, isOpen]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function fetchSessions() {
    try {
      const data = await chatbotApi.listSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to load sessions", err);
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

  async function handleCreateSession() {
    if (isCreatingSession) return;
    setIsCreatingSession(true);
    try {
      const title = `Session - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const newSession = await chatbotApi.createSession(title);
      await fetchSessions();
      setSelectedSessionId(newSession.id);
      setShowSessionsList(false);
    } catch (err) {
      console.error("Failed to create session", err);
    } finally {
      setIsCreatingSession(false);
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("Delete this session history?")) return;
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

    if (!activeSessionId) {
      setIsLoading(true);
      try {
        const title = text.length > 20 ? text.substring(0, 20) + "..." : text;
        const newSession = await chatbotApi.createSession(title);
        activeSessionId = newSession.id;
        setSelectedSessionId(activeSessionId);
        await fetchSessions();
      } catch (err) {
        console.error("Failed to create session", err);
        setIsLoading(false);
        return;
      }
    }

    setInputMessage("");
    setIsLoading(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sessionId: activeSessionId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const reply = await chatbotApi.sendMessage(activeSessionId, text);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, reply]);
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  }

  const handleSelectOption = (qId: number, optionKey: string) => {
    setInteractiveAnswers((prev) => ({
      ...prev,
      [qId]: optionKey,
    }));
  };

  const handleFillBlankChange = (qId: number, blankIdx: number, val: string) => {
    setInteractiveAnswers((prev) => {
      const currentList = prev[qId] ? [...prev[qId]] : [];
      currentList[blankIdx] = val;
      return {
        ...prev,
        [qId]: currentList,
      };
    });
  };

  const handleShortAnswerChange = (qId: number, val: string) => {
    setInteractiveAnswers((prev) => ({
      ...prev,
      [qId]: val,
    }));
  };

  const hasInteractiveAnswers = () => {
    return Object.values(interactiveAnswers).some((ans) => {
      if (Array.isArray(ans)) {
        return ans.some((item) => item && item.trim().length > 0);
      }
      return ans && ans.trim().length > 0;
    });
  };

  const renderFillInTheBlankPrompt = (q: Question) => {
    const parts = q.prompt.split(/_{3,}|\.{3,}/g);
    return (
      <div className="text-xs leading-relaxed text-[#14251d] font-semibold">
        {parts.map((part: string, idx: number) => {
          const answersList = interactiveAnswers[q.id] || [];
          const currentValue = answersList[idx] || "";
          return (
            <span key={idx} className="align-middle inline">
              {part}
              {idx < parts.length - 1 && (
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => handleFillBlankChange(q.id, idx, e.target.value)}
                  disabled={isSubmittingWorkspace}
                  placeholder={`[${idx + 1}]`}
                  className="mx-1 px-2 py-0.5 border-b-2 border-[#2f6d4f] focus:outline-none focus:border-[#214f3a] bg-emerald-50/20 focus:bg-emerald-50 text-center font-bold text-[#2f6d4f] transition-all w-24 text-xs placeholder-[#2f6d4f]/30"
                />
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Open exercise workspace dialog modal
  function openExerciseWorkspace(text: string, msgId: string) {
    const cleaned = cleanExerciseText(text);
    setActiveExerciseText(cleaned);
    
    const parsed = parseExercises(cleaned);
    setParsedExercises(parsed);
    
    if (parsed.questions.length === 0) {
      setWorkspaceMode("text");
    } else {
      setWorkspaceMode("interactive");
    }

    // Initialize interactive answers
    const initialAnswers: Record<number, any> = {};
    parsed.questions.forEach((q) => {
      if (q.type === "fill-in-the-blank") {
        const parts = q.prompt.split(/_{3,}|\.{3,}/g);
        initialAnswers[q.id] = Array(parts.length - 1).fill("");
      } else {
        initialAnswers[q.id] = "";
      }
    });
    setInteractiveAnswers(initialAnswers);
    
    setUserAnswersText(cleaned); // pre-populate editable layout with cleaned questions
    setActiveExerciseMsgId(msgId);
    setWorkspaceGradingResult(null);
    setIsOpenWorkspace(true);
  }

  // Handle workspace submission for grading
  async function handleSubmitWorkspace() {
    if (!selectedSessionId || !activeExerciseMsgId) return;

    let finalAnswersText = "";
    if (workspaceMode === "interactive") {
      finalAnswersText = generateAnswerSheetText(parsedExercises.questions.filter((q) => !q.isCorrect), interactiveAnswers);
    } else {
      finalAnswersText = userAnswersText;
    }

    if (!finalAnswersText.trim()) return;
    setIsSubmittingWorkspace(true);

    const prompt = `Here are my answers to the exercises for grading:
---
${finalAnswersText}
---
Please grade my answers, provide a score, and explain any corrections.`;

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sessionId: selectedSessionId,
      role: "user",
      content: `[Submitted completed answers for grading via Exercise Workspace]`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const gradingReply = await chatbotApi.sendMessage(selectedSessionId, prompt);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        { ...tempUserMsg, content: `[Submitted completed answers for grading via Workspace]` },
        gradingReply,
      ]);
      
      // Mark this message ID as submitted
      markMessageAsSubmitted(activeExerciseMsgId);
      
      fetchSessions();
      setIsOpenWorkspace(false); // Automatically close popup after submission
    } catch (err: any) {
      alert(err.message || "Failed to submit and grade workspace answers.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsSubmittingWorkspace(false);
    }
  }

  // Handle uploading files for grading
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    let activeSessionId = selectedSessionId;
    if (!activeSessionId) {
      setIsLoading(true);
      try {
        const newSession = await chatbotApi.createSession(`Grading - ${file.name}`);
        activeSessionId = newSession.id;
        setSelectedSessionId(activeSessionId);
        await fetchSessions();
      } catch (err) {
        console.error("Failed to create session for upload", err);
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);

    const tempUserMsg: ChatMessage = {
      id: Date.now().toString(),
      sessionId: activeSessionId,
      role: "user",
      content: `[Uploading completed answers: ${file.name} for AI grading...]`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const gradingReply = await chatbotApi.uploadFile(activeSessionId, file);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        { ...tempUserMsg, content: `[Uploaded completed answers: ${file.name} for grading]` },
        gradingReply,
      ]);
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to upload and grade file.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Client-side download/export of exercises
  function exportMessageExercises(text: string) {
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `English_Quest_AI_Exercises_${new Date().toISOString().split("T")[0]}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export exercises", err);
    }
  }

  if (!sessionReady || !user) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Interactive Exercise Workspace Modal */}
      {isOpenWorkspace && (
        <div className="fixed inset-0 bg-[#14251d]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl h-[85vh] bg-[#fffdf7] rounded-3xl shadow-2xl flex flex-col border border-[#14251d]/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-[#2f6d4f] text-white p-4.5 px-6 flex items-center justify-between shrink-0 select-none">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span>📝</span> QuestTutor - Exercise Workspace
                </h3>
                <p className="text-[10px] text-emerald-100 mt-0.5">
                  Type your answers directly on this question sheet and click Submit to let QuestTutor grade it.
                </p>
              </div>
              <button
                onClick={() => setIsOpenWorkspace(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all"
                title="Close Workspace"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {workspaceGradingResult ? (
              // Show ONLY Graded Result Full Width (Hide Exercises Pane after submit)
              <div className="flex-1 p-6 overflow-y-auto flex flex-col bg-emerald-50/5">
                <div className="flex items-center gap-2 pb-3 border-b border-[#14251d]/5 shrink-0 mb-4 justify-between select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#2f6d4f] uppercase tracking-wider">Evaluation & Corrections</span>
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-[#2f6d4f] rounded-full text-[10px] font-extrabold border border-emerald-200">
                      Graded
                    </span>
                  </div>
                  <p className="text-[10px] text-[#5d6d64]">Review your performance breakdown below</p>
                </div>
                <div className="flex-1 overflow-y-auto bg-white border border-[#14251d]/10 rounded-2xl p-5 shadow-sm">
                  {renderMarkdown(workspaceGradingResult)}
                </div>
              </div>
            ) : (
              // Split pane for exercises and answer sheet (Practice mode)
              <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[#14251d]/10 overflow-hidden">
                {/* Left Pane (Exercise Sheet) */}
                <div className="flex-1 p-5 overflow-y-auto bg-[#f7f3e8]/30 flex flex-col">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#14251d]/5 shrink-0 mb-3">
                    <span className="text-xs font-black text-[#2f6d4f] uppercase tracking-wider">Exercise Sheet</span>
                  </div>
                  <div className="flex-1 overflow-y-auto bg-white border border-[#14251d]/10 rounded-2xl p-4 shadow-2xs">
                    {renderMarkdown(activeExerciseText)}
                  </div>
                </div>

                {/* Right Pane (Your Answer Sheet) */}
                <div className="flex-1 p-5 overflow-y-auto flex flex-col">
                  <div className="flex items-center gap-2 pb-3 border-b border-[#14251d]/5 shrink-0 mb-3 justify-between">
                    <span className="text-xs font-black text-[#2f6d4f] uppercase tracking-wider">Your Answer Sheet</span>
                    
                    {/* Tab switches */}
                    <div className="flex bg-[#f7f3e8] p-0.5 rounded-full border border-[#2f6d4f]/10">
                      <button
                        onClick={() => setWorkspaceMode("interactive")}
                        disabled={parsedExercises.questions.length === 0}
                        className={`py-1 px-3 rounded-full text-[10px] font-bold transition-all ${
                          workspaceMode === "interactive"
                            ? "bg-[#2f6d4f] text-white shadow-xs"
                            : "text-[#5d6d64] hover:text-[#14251d] disabled:opacity-40"
                        }`}
                        title="Dạng trắc nghiệm / điền từ / chọn đáp án trực quan"
                      >
                        Interactive Form
                      </button>
                      <button
                        onClick={() => setWorkspaceMode("text")}
                        className={`py-1 px-3 rounded-full text-[10px] font-bold transition-all ${
                          workspaceMode === "text"
                            ? "bg-[#2f6d4f] text-white shadow-xs"
                            : "text-[#5d6d64] hover:text-[#14251d]"
                        }`}
                        title="Tự soạn câu trả lời bằng văn bản"
                      >
                        Text Editor
                      </button>
                    </div>
                  </div>

                  {workspaceMode === "interactive" ? (
                    // Interactive form rendering
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                      {parsedExercises.questions.filter((q) => !q.isCorrect).map((q) => (
                        <div
                          key={q.id}
                          className="bg-white border border-[#14251d]/10 rounded-2xl p-4 shadow-3xs hover:shadow-2xs transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-emerald-100 text-[#2f6d4f] rounded-full text-[9px] font-black uppercase tracking-wider">
                              Câu {q.id}
                            </span>
                            <span className="text-[10px] text-[#5d6d64] font-medium uppercase tracking-wider">
                              {q.type === "multiple-choice"
                                ? "Chọn đáp án"
                                : q.type === "fill-in-the-blank"
                                ? "Điền vào chỗ trống"
                                : "Trả lời ngắn"}
                            </span>
                          </div>

                          {/* Question contents */}
                          {q.type === "multiple-choice" ? (
                            <div>
                              <p className="text-xs font-semibold text-[#14251d] mb-2.5 leading-relaxed">
                                {q.prompt}
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                {q.options.map((opt: any) => {
                                  const isSelected = interactiveAnswers[q.id] === opt.key;
                                  return (
                                    <button
                                      key={opt.key}
                                      onClick={() => handleSelectOption(q.id, opt.key)}
                                      disabled={isSubmittingWorkspace}
                                      className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center gap-2.5 ${
                                        isSelected
                                          ? "border-[#2f6d4f] bg-[#2f6d4f]/5 text-[#2f6d4f] font-bold shadow-3xs"
                                          : "border-[#14251d]/10 bg-white hover:bg-[#14251d]/5 text-gray-700"
                                      }`}
                                    >
                                      <span
                                        className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-extrabold shrink-0 transition-colors ${
                                          isSelected
                                            ? "bg-[#2f6d4f] text-white border-transparent"
                                            : "border-gray-300 text-gray-400"
                                        }`}
                                      >
                                        {opt.key}
                                      </span>
                                      <span className="leading-tight">{opt.text}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : q.type === "fill-in-the-blank" ? (
                            <div>
                              {renderFillInTheBlankPrompt(q)}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-[#14251d] mb-2 leading-relaxed">
                                {q.prompt}
                              </p>
                              <textarea
                                value={interactiveAnswers[q.id] || ""}
                                onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                                disabled={isSubmittingWorkspace}
                                placeholder="Nhập câu trả lời của bạn tại đây..."
                                className="w-full p-3 border border-[#14251d]/10 rounded-xl bg-white focus:outline-none focus:border-[#2f6d4f] focus:ring-2 focus:ring-[#2f6d4f]/10 text-xs font-medium leading-relaxed resize-none h-20 shadow-3xs disabled:bg-gray-50 text-[#14251d] transition-all"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Textarea fallback editor
                    <textarea
                      value={userAnswersText}
                      onChange={(e) => setUserAnswersText(e.target.value)}
                      disabled={isSubmittingWorkspace}
                      placeholder="Type your answers directly on this question sheet..."
                      className="w-full flex-1 p-4 border border-[#14251d]/10 rounded-2xl bg-white focus:outline-none focus:border-[#2f6d4f] focus:ring-2 focus:ring-[#2f6d4f]/10 text-xs font-mono leading-relaxed resize-none shadow-2xs disabled:bg-gray-50 transition-all text-[#14251d]"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="bg-[#fffdf7] border-t border-[#14251d]/10 p-4 px-6 flex justify-between items-center shrink-0 select-none">
              <button
                onClick={() => setIsOpenWorkspace(false)}
                className="py-2.5 px-4.5 rounded-full border border-[#14251d]/15 text-[#5d6d64] hover:bg-[#14251d]/5 hover:text-[#14251d] font-semibold text-xs transition-colors"
              >
                Close
              </button>

              {!workspaceGradingResult && (
                <button
                  onClick={handleSubmitWorkspace}
                  disabled={
                    isSubmittingWorkspace || 
                    (workspaceMode === "text" ? !userAnswersText.trim() : !hasInteractiveAnswers())
                  }
                  className="py-2.5 px-5.5 rounded-full bg-[#2f6d4f] text-white hover:bg-[#214f3a] disabled:bg-gray-200 disabled:text-gray-400 font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmittingWorkspace ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>AI is grading...</span>
                    </>
                  ) : (
                    <span>Submit to Grade</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Panel (Open state) */}
      {isOpen && (
        <div className="w-[380px] h-[560px] bg-[#fffdf7] border border-[#14251d]/15 shadow-2xl rounded-3xl flex flex-col mb-4 overflow-hidden transform scale-100 origin-bottom-right transition-all duration-300">
          
          {/* Header */}
          <div className="bg-[#2f6d4f] text-white p-4 flex items-center justify-between shadow-sm select-none relative">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Online Indicator Status */}
              <div className="relative flex shrink-0">
                <span className="w-3 h-3 bg-lime-400 border-2 border-[#2f6d4f] rounded-full" />
                <span className="absolute top-0 left-0 w-3 h-3 bg-lime-400 rounded-full animate-ping opacity-75" />
              </div>
              
              {/* Session Selector Pill Dropdown */}
              <button
                onClick={() => setShowSessionsList(!showSessionsList)}
                className="text-sm font-bold truncate hover:bg-white/10 px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 min-w-0 text-left"
              >
                <span className="truncate">
                  {selectedSessionId
                    ? sessions.find((s) => s.id === selectedSessionId)?.title || "Active Session"
                    : "QuestTutor"}
                </span>
                <svg className="w-3 h-3 opacity-80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {/* Header control buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCreateSession}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all text-white"
                title="New Chat Session"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 active:scale-95 transition-all text-white"
                title="Minimize Chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Session history dropdown list (overlay) */}
          {showSessionsList && (
            <div className="absolute top-[60px] left-0 right-0 max-h-60 bg-[#fffdf7] border-b border-[#14251d]/15 shadow-xl overflow-y-auto z-30 p-3 space-y-1">
              <div className="flex justify-between items-center px-2 py-1.5 border-b border-[#14251d]/5 mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#5d6d64]">Select Session</span>
                <button
                  onClick={handleCreateSession}
                  className="text-[10px] text-[#2f6d4f] font-bold hover:underline"
                >
                  + New Session
                </button>
              </div>
              {sessions.length === 0 ? (
                <p className="p-3 text-xs text-[#5d6d64] italic text-center">No previous chats.</p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSessionId(s.id);
                      setShowSessionsList(false);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${
                      selectedSessionId === s.id
                        ? "bg-[#2f6d4f]/10 text-[#2f6d4f] font-semibold"
                        : "hover:bg-[#14251d]/5 text-[#14251d]/85"
                    }`}
                  >
                    <span className="truncate pr-2">💬 {s.title}</span>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="text-red-700 hover:scale-110 p-0.5 rounded transition-transform"
                      title="Delete Session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat message space */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#f7f3e8]/20 scrollbar-thin scrollbar-thumb-gray-200">
            {messages.length === 0 && !isLoading ? (
              // Welcome Screen
              <div className="h-full flex flex-col justify-center items-center text-center space-y-5 p-2">
                <div className="w-14 h-14 bg-[#eef5db] text-[#2f6d4f] rounded-2xl flex items-center justify-center shadow-sm border border-[#2f6d4f]/10">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v7" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-[#14251d] text-base tracking-tight">QuestTutor</h4>
                  <p className="text-xs text-[#5d6d64] max-w-[250px] mx-auto mt-1.5 leading-relaxed">
                    Practice conversations, ask grammar questions, ask for test exercises, or upload completed exercise sheets to get them graded.
                  </p>
                </div>

                <div className="w-full space-y-2 pt-2 text-left">
                  {starterPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(p.text)}
                      className="w-full p-3 rounded-2xl bg-white border border-[#14251d]/10 hover:border-[#2f6d4f] hover:bg-[#2f6d4f]/5 shadow-2xs hover:shadow-xs hover:-translate-y-[1px] active:translate-y-0 text-left transition-all flex items-center gap-3 group"
                    >
                      <span className="text-lg shrink-0">{p.icon}</span>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black text-[#2f6d4f] uppercase tracking-wider block mb-0.5">{p.label}</span>
                        <p className="text-xs text-[#5d6d64] truncate leading-tight group-hover:text-[#14251d] transition-colors">{p.text}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Messages Deck list
              messages.map((m) => {
                const isUser = m.role === "user";
                const showsExercises = !isUser && isExerciseMessage(m.content) && !submittedMessageIds.includes(m.id);
                return (
                  <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-[#2f6d4f] text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v7" />
                        </svg>
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] rounded-2xl p-3 px-3.5 shadow-sm relative group transition-all duration-200 hover:shadow-md ${
                        isUser
                          ? "bg-[#2f6d4f] text-white rounded-tr-none"
                          : "bg-white border border-[#14251d]/10 rounded-tl-none text-[#14251d]"
                      }`}
                    >
                      {/* Message Content */}
                      {isUser ? (
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      ) : (
                        renderMarkdown(m.content)
                      )}

                      {/* Download & Solve exercises buttons for AI replies - only show on actual exercise text */}
                      {showsExercises && (
                        <div className="flex justify-end gap-2 mt-2.5 opacity-50 group-hover:opacity-100 transition-opacity flex-wrap">
                          {/* Solve Exercises Directly Button */}
                          <button
                            onClick={() => openExerciseWorkspace(m.content, m.id)}
                            className="p-1 px-1.5 rounded-md text-[10px] font-semibold text-[#2f6d4f] hover:bg-emerald-50 flex items-center gap-1 transition-colors border border-[#2f6d4f]/10 shadow-3xs"
                            title="Làm bài tập trực tiếp trên đề bài"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="text-[9px] uppercase tracking-wider">Làm bài tập</span>
                          </button>

                          {/* Download exercises button */}
                          <button
                            onClick={() => exportMessageExercises(m.content)}
                            className="p-1 px-1.5 rounded-md text-[10px] font-semibold text-[#5d6d64] hover:text-[#14251d] hover:bg-gray-100 flex items-center gap-1 transition-colors border border-[#14251d]/10 shadow-3xs"
                            title="Export exercises to .txt file"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-[9px] uppercase tracking-wider">Tải về</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* AI Generation Loading Indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-xl bg-[#2f6d4f] text-white flex items-center justify-center shrink-0 animate-pulse">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v7" />
                  </svg>
                </div>
                <div className="bg-white border border-[#14251d]/10 rounded-2xl rounded-tl-none p-3 shadow-xs flex items-center gap-1.5 py-4 px-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2f6d4f] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form input and attachment bar */}
          <div className="p-4 bg-[#fffdf7] border-t border-[#14251d]/10 shrink-0">
            {/* Pill integrated layout */}
            <div className="flex gap-2 items-center relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.pdf,.docx"
                className="hidden"
              />

              <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#14251d]/15 shadow-sm bg-white focus-within:border-[#2f6d4f] focus-within:ring-2 focus-within:ring-[#2f6d4f]/10 transition-all">
                {/* Upload Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-1.5 rounded-full text-[#5d6d64] hover:text-[#2f6d4f] hover:bg-[#2f6d4f]/5 transition-all shrink-0"
                  title="Upload completed answers (.txt, .pdf, .docx) for grading"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                {/* Input Text Box */}
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Ask QuestTutor..."
                  disabled={isLoading}
                  className="bg-transparent border-0 outline-none flex-1 text-xs placeholder-[#5d6d64]/60 text-[#14251d]"
                />

                {/* Send Button */}
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputMessage.trim()}
                  className="w-7 h-7 rounded-full bg-[#2f6d4f] text-white flex items-center justify-center hover:bg-[#214f3a] active:scale-95 disabled:bg-gray-100 disabled:text-gray-400 transition-all shrink-0"
                  title="Send message"
                >
                  <svg className="w-3.5 h-3.5 transform rotate-45 mr-[2px] mt-[-1px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
                  </svg>
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-[#5d6d64]/85 mt-2.5 text-center leading-normal">
              💡 Tip: Nhấn ✏️ Làm bài tập để trả lời trực tiếp hoặc 📎 để nộp tệp bài làm chấm điểm.
            </p>
          </div>
        </div>
      )}

      {/* Floating Trigger Bubble (Hidden when open) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-br from-[#2f6d4f] to-[#214f3a] text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all relative border-2 border-white group hover:shadow-emerald-950/20"
          title="Chat with QuestTutor"
        >
          {/* Beautiful Graduation Cap SVG representing learning / tutoring */}
          <svg className="w-7 h-7 text-white transform group-hover:rotate-6 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm0 0v7" />
          </svg>
          {/* Active pulsing notification dot */}
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-lime-400 border-2 border-white rounded-full" />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-lime-400 border-2 border-white rounded-full animate-ping opacity-75" />
        </button>
      )}
    </div>
  );
}
