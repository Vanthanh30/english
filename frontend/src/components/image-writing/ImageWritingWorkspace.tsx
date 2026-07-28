"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { authApi } from "@/services/auth.service";
import { imageWritingApi } from "@/services/image-writing.service";
import type { ImageWritingSession, NewVocabularyItem } from "@/types";

export default function ImageWritingWorkspace({ initialSessionId }: { initialSessionId?: string }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [history, setHistory] = useState<ImageWritingSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ImageWritingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSessionId && sessionReady && user) {
      const loadSession = async () => {
        try {
          const session = await imageWritingApi.getSession(initialSessionId);
          setCurrentSession(session);
          setRevisedText(session.revisedText ?? session.userText);
        } catch (err) {
          console.error("Failed to load session from params:", err);
          setError("Failed to load requested writing session.");
        }
      };
      loadSession();
    }
  }, [initialSessionId, sessionReady, user]);

  // Form input state
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userText, setUserText] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Revision state
  const [revisedText, setRevisedText] = useState("");
  const [reEvaluating, setReEvaluating] = useState(false);

  // Saved vocabulary state tracking
  const [savedWords, setSavedWords] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"grammar" | "rewrite" | "vocab" | "structures">("grammar");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionReady && !user) {
      router.replace("/login");
    }
  }, [router, sessionReady, user]);

  const loadHistory = async () => {
    if (!sessionReady || !user) return;
    setLoading(true);
    try {
      const data = await imageWritingApi.listHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load image writing history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [sessionReady, user]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileProcess(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleFileProcess = (selectedFile: File) => {
    if (!selectedFile.type.match("image/(jpeg|png|webp)")) {
      setError("Supported file formats are JPEG, PNG, and WEBP only.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Maximum file size is 5MB.");
      return;
    }
    setFile(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const handleClearUpload = () => {
    setFile(null);
    setImagePreview(null);
    setUserText("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || userText.trim().length < 20) return;

    setAnalyzing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const session = await imageWritingApi.submit(file, userText);
      setCurrentSession(session);
      setRevisedText(session.userText); // init revision text
      // Refresh history
      const updatedHistory = await imageWritingApi.listHistory();
      setHistory(updatedHistory);
      setSuccessMessage("AI evaluation complete!");
    } catch (err: any) {
      setError(err?.message || "AI writing evaluation failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || revisedText.trim().length < 20 || revisedText === currentSession.userText) return;

    setReEvaluating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const session = await imageWritingApi.resubmit(currentSession.id, revisedText);
      setCurrentSession(session);
      // Refresh history
      const updatedHistory = await imageWritingApi.listHistory();
      setHistory(updatedHistory);
      setSuccessMessage("Re-evaluation complete! Check your new score.");
    } catch (err: any) {
      setError(err?.message || "Re-evaluation failed. Please try again.");
    } finally {
      setReEvaluating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await imageWritingApi.deleteSession(id);
      if (currentSession?.id === id) {
        setCurrentSession(null);
        handleClearUpload();
      }
      setHistory(history.filter((s) => s.id !== id));
      setSuccessMessage("Session deleted successfully.");
    } catch (err) {
      setError("Failed to delete session.");
    }
  };

  const handleSaveVocab = async (vocab: NewVocabularyItem) => {
    try {
      await imageWritingApi.saveVocab({
        word: vocab.word,
        meaning: vocab.vietnameseMeaning, // map UI translation to meaning field in backend DTO
        meaningVi: vocab.vietnameseMeaning,
        partOfSpeech: vocab.partOfSpeech,
        exampleSentence: vocab.exampleSentence,
      });

      setSavedWords((prev) => ({ ...prev, [vocab.word.toLowerCase()]: true }));
      setSuccessMessage(`Saved "${vocab.word}" to Flashcards!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError("Failed to save vocabulary word.");
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage("Copied to clipboard!");
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  async function logout() {
    await authApi.logout().catch(() => undefined);
    clearSession();
    router.replace("/login");
  }

  if (!sessionReady || !user) {
    return (
      <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <p style={{ fontWeight: 600, fontSize: '15px' }}>Restoring your session...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen pb-16 font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        .iw-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: 0 10px 30px rgba(20, 37, 29, 0.02);
          overflow: hidden;
        }
        .iw-dropzone {
          border: 2px dashed var(--line);
          border-radius: 20px;
          padding: 60px 24px;
          text-align: center;
          cursor: pointer;
          background: rgba(20, 37, 29, 0.02);
          transition: all 0.25s ease;
        }
        .iw-dropzone:hover {
          border-color: var(--green);
          background: rgba(20, 37, 29, 0.04);
        }
        .iw-dropzone.drag-active {
          border-color: var(--green);
          background: rgba(47, 109, 79, 0.05);
        }
        .score-circle {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 22px;
          background: rgba(47, 109, 79, 0.06);
          color: var(--green);
          border: 3px solid rgba(47, 109, 79, 0.25);
          flex-shrink: 0;
        }
        .score-circle.warning {
          background: #fef3c7;
          color: #d97706;
          border-color: #fde68a;
        }
        .score-circle.danger {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }
        .tab-capsule {
          display: flex;
          background: rgba(20, 37, 29, 0.05);
          border-radius: 12px;
          padding: 4px;
          gap: 2px;
        }
        .tab-capsule-btn {
          flex: 1;
          padding: 10px 8px;
          font-size: 12px;
          font-weight: 700;
          color: var(--muted);
          border-radius: 8px;
          transition: all 0.2s;
          cursor: pointer;
          border: none;
          background: transparent;
        }
        .tab-capsule-btn:hover {
          color: var(--ink);
        }
        .tab-capsule-btn.active {
          background: var(--paper);
          color: var(--green);
          box-shadow: 0 4px 6px -1px rgba(20, 37, 29, 0.05), 0 2px 4px -1px rgba(20, 37, 29, 0.03);
        }
        .custom-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scroll::-webkit-scrollbar-thumb {
          background: rgba(20, 37, 29, 0.15);
          border-radius: 10px;
        }
        .custom-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(20, 37, 29, 0.3);
        }
        .accent-block {
          border-left: 4px solid var(--green);
          background: rgba(20, 37, 29, 0.02);
          border-radius: 0 12px 12px 0;
        }
        .accent-block.success {
          border-left-color: #10b981;
          background: rgba(16, 185, 129, 0.03);
        }
        .accent-block.error {
          border-left-color: #ef4444;
          background: rgba(239, 68, 68, 0.03);
        }
        .accent-block.warning {
          border-left-color: #f59e0b;
          background: rgba(245, 158, 11, 0.03);
        }
        .btn-gradient {
          background: linear-gradient(135deg, var(--green) 0%, var(--green-dark) 100%);
          transition: all 0.2s;
        }
        .btn-gradient:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .btn-gradient-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          transition: all 0.2s;
        }
        .btn-gradient-success:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
      `}} />

      {/* Global Navigation Header - fully consistent with the rest of system */}
      <header className="site-header">
        <div className="site-nav">
          <Link className="brand" href="/">
            <span className="brand-mark">EQ</span>
            <span>English Quest</span>
          </Link>
          <div className="nav-actions">
            <Link className="user-nav-profile" href="/dashboard">
              <div className="avatar-mini">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="username">{user.displayName}</span>
            </Link>
            <button className="text-button" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page Content layout with standard system widths & background colors */}
      <div className="max-w-[1180px] mx-auto px-6 lg:px-8 mt-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center justify-between text-sm shadow-sm">
            <span className="font-medium flex items-center gap-2">⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold">&times;</button>
          </div>
        )}
        {successMessage && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-between text-sm shadow-sm">
            <span className="font-medium flex items-center gap-2">✨ {successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-600 font-bold">&times;</button>
          </div>
        )}

        {/* Reading Header Style page banner */}
        <div className="reading-header">
          <div className="reading-header-copy">
            <p className="eyebrow">Sprint 9 · Writing Coach</p>
            <h1 className="text-[var(--ink)]">AI Image Writing Practice</h1>
            <p>
              Học viết tiếng Anh tương tác qua hình ảnh thực tế. Hãy chọn ảnh, nhập đoạn văn mô tả tiếng Anh và nhận chấm điểm IELTS/TOEIC, phân tích lỗi ngữ pháp và đề xuất nâng cấp từ vựng từ AI.
            </p>
          </div>
        </div>

        {!currentSession ? (
          /* Render Upload state layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
            <div className="lg:col-span-8 space-y-6">
              {/* Create Practice View */}
              <div className="iw-card p-8 space-y-6">
                <h2 className="text-base font-extrabold text-[var(--ink)] border-b pb-3 border-[var(--line)]">Start New Writing Quest</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* File Upload Zone */}
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">1. Upload Image Context</label>
                    {imagePreview ? (
                      <div className="relative rounded-2xl overflow-hidden bg-slate-50/50 border border-[var(--line)] p-2 shadow-inner">
                        <img src={imagePreview} alt="Preview" className="w-full max-h-[360px] object-contain mx-auto rounded-xl" />
                        <button
                          type="button"
                          onClick={handleClearUpload}
                          className="absolute top-4 right-4 bg-slate-900/85 text-white rounded-full p-2.5 hover:bg-slate-950 transition-colors shadow-lg"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`iw-dropzone ${dragActive ? "drag-active" : ""}`}
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                        />
                        <span className="text-3xl block mb-2">📸</span>
                        <span className="block font-extrabold text-[var(--ink)] text-sm">Click or drag image here</span>
                        <span className="text-[11px] text-[var(--muted)] block mt-1">Supports JPG, PNG, WEBP (Max 5MB)</span>
                      </div>
                    )}
                  </div>

                  {/* Writing Input */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-[var(--muted)] uppercase tracking-wider">2. Write English Description</label>
                      <span className={`text-[11px] font-bold ${userText.trim().length >= 20 ? "text-emerald-600" : "text-[var(--muted)]"}`}>
                        {userText.trim().length} chars (min 20)
                      </span>
                    </div>
                    <textarea
                      value={userText}
                      onChange={(e) => setUserText(e.target.value)}
                      placeholder="Describe what you see in the image in English..."
                      className="w-full h-32 px-4 py-3 rounded-xl border border-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent text-[var(--ink)] placeholder-[var(--muted)]/50 text-sm shadow-inner bg-[var(--paper)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={analyzing || !file || userText.trim().length < 20}
                    className="w-full py-3.5 btn-gradient disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm"
                  >
                    {analyzing ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Analyzing with Generative AI...
                      </>
                    ) : (
                      "Submit for Review"
                    )}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-4">
              {/* Attempt History Card (Upload state sidebar) */}
              <div className="iw-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Attempt History</h3>
                {loading ? (
                  <div className="text-center py-8 text-[var(--muted)]">
                    <span className="animate-spin inline-block w-5 h-5 border-2 border-[var(--line)] border-t-transparent rounded-full mb-1"></span>
                    <p className="text-[10px]">Loading history...</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-[var(--muted)] text-[11px]">
                    No writing sessions found. Upload an image to start!
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1 custom-scroll">
                    {history.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => {
                          setCurrentSession(session);
                          setRevisedText(session.revisedText ?? session.userText);
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        className="p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:bg-[var(--cream)]/40 hover:shadow-sm border-[var(--line)]"
                      >
                        <img src={session.imageUrl} alt="Thumbnail" className="w-10 h-10 object-cover rounded-lg border bg-slate-50 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-1 mb-0.5">
                            <span className="text-[9px] text-[var(--muted)] font-extrabold">
                              {new Date(session.createdAt).toLocaleDateString()}
                            </span>
                            <span className={`text-[9px] font-extrabold ${session.revisedScore ? "text-emerald-600" : "text-[var(--green)]"}`}>
                              Score: {session.revisedScore ?? session.overallScore}
                            </span>
                          </div>
                          <p className="text-[10px] text-[var(--muted)] font-medium truncate italic">
                            &quot;{session.userText}&quot;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Render Active Session state layout */
          <div className="space-y-8 mt-8">
            {/* ROW 1: Details and Score + Coaching Tabs */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column - Details and Score */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Back button and status bar */}
                <div className="flex justify-between items-center bg-[var(--paper)] p-3 px-4 rounded-xl border border-[var(--line)] shadow-sm">
                  <button
                    onClick={() => {
                      setCurrentSession(null);
                      handleClearUpload();
                    }}
                    className="text-xs font-extrabold text-[var(--green)] hover:text-[var(--green-dark)] flex items-center gap-1 cursor-pointer"
                  >
                    &larr; Start New Practice
                  </button>
                  <button
                    onClick={() => handleDelete(currentSession.id)}
                    className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    Delete Session
                  </button>
                </div>

                {/* Workspace Split card */}
                <div className="iw-card p-6 flex-1 flex flex-col justify-center">
                  <div className="flex flex-col md:flex-row gap-6 items-stretch">
                    <div className="flex-1">
                      <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--muted)] mb-2">Reference image Context</h4>
                      <div className="bg-slate-50 border border-[var(--line)] p-1.5 rounded-xl flex items-center justify-center h-[200px]">
                        <img src={currentSession.imageUrl} alt="Context" className="rounded-lg max-h-[190px] object-contain mx-auto" />
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--muted)] mb-1.5">Original Submission</h4>
                        <div className="text-[var(--ink)] font-medium bg-slate-50/50 p-3.5 rounded-xl border border-[var(--line)] text-xs italic max-h-[90px] overflow-y-auto">
                          &quot;{currentSession.userText}&quot;
                        </div>
                      </div>
                      {currentSession.revisedText && (
                        <div>
                          <h4 className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--muted)] mb-1.5">Revised Attempt</h4>
                          <div className="text-[var(--ink)] font-medium bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50 text-xs italic max-h-[90px] overflow-y-auto">
                            &quot;{currentSession.revisedText}&quot;
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score & Accuracy Card */}
                <div className="iw-card p-5 flex items-center gap-5">
                  {(() => {
                    const score = currentSession.revisedScore ?? currentSession.overallScore;
                    let scoreClass = "";
                    if (score >= 80) scoreClass = "";
                    else if (score >= 50) scoreClass = "warning";
                    else scoreClass = "danger";

                    return (
                      <div className="flex flex-col items-center">
                        <div className={`score-circle ${scoreClass}`}>
                          {score}
                          <span className="text-[9px] uppercase font-extrabold tracking-wider opacity-60">Score</span>
                        </div>
                        {currentSession.revisedScore && (
                          <div className="text-[9px] font-extrabold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full mt-2 shadow-sm">
                            {currentSession.overallScore} &rarr; {currentSession.revisedScore}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex-1 space-y-1">
                    <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-1.5">
                      <span>🎯 Visual Accuracy Feedback</span>
                    </h3>
                    <p className="text-[var(--muted)] text-xs leading-relaxed">{currentSession.accuracyFeedback}</p>
                  </div>
                </div>
              </div>

              {/* Right Column - Coaching Tabs wrapper using absolute positioning to match Left column height */}
              <div className="lg:col-span-5 relative min-h-[450px] lg:min-h-0">
                <div className="lg:absolute lg:inset-0 flex flex-col">
                  <div className="iw-card flex flex-col flex-1 h-full">
                    {/* Tab Headers capsule style */}
                    <div className="p-3 bg-[var(--cream)]/30 border-b border-[var(--line)]">
                      <div className="tab-capsule">
                        <button
                          onClick={() => setActiveTab("grammar")}
                          className={`tab-capsule-btn ${activeTab === "grammar" ? "active" : ""}`}
                        >
                          ✏️ Grammar
                        </button>
                        <button
                          onClick={() => setActiveTab("rewrite")}
                          className={`tab-capsule-btn ${activeTab === "rewrite" ? "active" : ""}`}
                        >
                          💡 Rewrite
                        </button>
                        <button
                          onClick={() => setActiveTab("vocab")}
                          className={`tab-capsule-btn ${activeTab === "vocab" ? "active" : ""}`}
                        >
                          📚 Vocab
                        </button>
                        <button
                          onClick={() => setActiveTab("structures")}
                          className={`tab-capsule-btn ${activeTab === "structures" ? "active" : ""}`}
                        >
                          🔤 Rules
                        </button>
                      </div>
                    </div>

                    {/* Tab Body with scroll */}
                    <div className="p-5 flex-1 min-h-0 overflow-y-auto custom-scroll">
                      {/* GRAMMAR TAB */}
                      {activeTab === "grammar" && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b pb-2 border-[var(--line)]/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Grammar Diagnostics</h3>
                            {(!currentSession.grammarFeedback || currentSession.grammarFeedback.length === 0) && (
                              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shadow-sm">Perfect</span>
                            )}
                          </div>

                          {!currentSession.grammarFeedback || currentSession.grammarFeedback.length === 0 ? (
                            <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 text-emerald-700 rounded-xl text-xs font-medium">
                              ✨ Excellent! No grammar errors were detected in your writing description.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {currentSession.grammarFeedback.map((item, index) => (
                                <div key={`grammar-${index}`} className="p-3.5 rounded-xl accent-block error space-y-1.5 text-xs shadow-sm border border-[var(--line)] bg-[var(--paper)]">
                                  <div className="flex items-start gap-2">
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase">Error</span>
                                    <p className="text-red-700 font-medium line-through">{item.error}</p>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 uppercase">Correct</span>
                                    <p className="text-emerald-700 font-bold">{item.correction}</p>
                                  </div>
                                  <p className="text-slate-500 text-[10px] pl-10 leading-relaxed font-medium italic mt-1 bg-white/70 p-1.5 rounded border border-slate-100/30 whitespace-pre-line">
                                    {item.explanation}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* REWRITE TAB */}
                      {activeTab === "rewrite" && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center border-b pb-2 border-[var(--line)]/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Suggested Model Paragraph</h3>
                            <button
                              onClick={() => handleCopyText(currentSession.improvedParagraph)}
                              className="text-[11px] font-bold text-[var(--green)] hover:text-[var(--green-dark)] flex items-center gap-1 cursor-pointer"
                            >
                              Copy Rewrite
                            </button>
                          </div>
                          <div className="p-4 bg-blue-50/20 border border-blue-100/50 rounded-xl text-slate-600 text-xs italic leading-relaxed shadow-sm">
                            &quot;{currentSession.improvedParagraph}&quot;
                          </div>
                        </div>
                      )}

                      {/* VOCABULARY TAB */}
                      {activeTab === "vocab" && (
                        <div className="space-y-4">
                          <div className="border-b pb-2 border-[var(--line)]/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Contextual Vocabulary</h3>
                            <p className="text-[10px] text-[var(--muted)] mt-0.5">Study words observed in the image context</p>
                          </div>

                          <div className="space-y-3">
                            {currentSession.newVocabulary && currentSession.newVocabulary.map((item, index) => {
                              const isSaved = savedWords[item.word.toLowerCase()] || item.alreadySaved;

                              return (
                                <div key={`vocab-${index}`} className="p-3.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] space-y-2 flex flex-col justify-between shadow-sm">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <h4 className="font-extrabold text-[var(--green)] text-xs">{item.word}</h4>
                                      <span className="text-[9px] text-[var(--muted)] font-bold uppercase">{item.partOfSpeech}</span>
                                    </div>
                                    <button
                                      onClick={() => handleSaveVocab(item)}
                                      disabled={isSaved}
                                      className={`text-[9px] px-2 py-0.5 rounded-full font-bold border transition-all cursor-pointer ${
                                        isSaved
                                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                          : "bg-[var(--paper)] text-[var(--green)] border-[var(--green)]/30 hover:bg-[var(--cream)]/30"
                                      }`}
                                    >
                                      {isSaved ? "Saved" : "+ Save"}
                                    </button>
                                  </div>
                                  <p className="text-xs font-bold text-[var(--ink)]">{item.vietnameseMeaning}</p>
                                  <p className="text-[10px] text-[var(--muted)] border-t pt-1.5 italic font-medium leading-relaxed border-[var(--line)]/50">
                                    &quot;{item.exampleSentence}&quot;
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* RULES TAB */}
                      {activeTab === "structures" && (
                        <div className="space-y-4">
                          <div className="border-b pb-2 border-[var(--line)]/50">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Grammar Structures</h3>
                          </div>
                          
                          {!currentSession.grammarPatterns || currentSession.grammarPatterns.length === 0 ? (
                            <p className="text-[var(--muted)] text-xs italic">No grammar patterns suggested for this session.</p>
                          ) : (
                            <div className="space-y-3">
                              {currentSession.grammarPatterns.map((pattern, index) => (
                                <div key={`pattern-${index}`} className="p-3.5 accent-block shadow-sm border border-[var(--line)] space-y-1.5">
                                  <h4 className="font-extrabold text-[var(--ink)] text-xs flex items-center gap-1.5">
                                    {pattern.pattern}
                                  </h4>
                                  <p className="text-[10px] text-[var(--muted)] leading-relaxed font-medium pl-0.5 whitespace-pre-line">{pattern.explanation}</p>
                                  <p className="text-[10px] text-[var(--muted)] font-bold italic pl-2.5 border-l-2 border-[var(--line)] mt-2">
                                    Example: &quot;{pattern.example}&quot;
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 2: Revise & Resubmit + Attempt History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Left Column - Revise & Resubmit */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="iw-card p-6 border border-emerald-100 bg-emerald-50/5 flex flex-col flex-1 space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-[var(--ink)]">🔄 Revise & Resubmit</h3>
                    <p className="text-[11px] text-[var(--muted)] mt-0.5 leading-relaxed">
                      Sử dụng các gợi ý và sửa lỗi ở tab bên phải để viết lại bài mô tả của bạn bên dưới.
                    </p>
                  </div>

                  <form onSubmit={handleResubmit} className="space-y-4 flex-1 flex flex-col justify-between">
                    <textarea
                      value={revisedText}
                      onChange={(e) => setRevisedText(e.target.value)}
                      className="w-full h-24 px-4 py-3 rounded-xl border border-[var(--line)] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-[var(--ink)] text-xs shadow-inner flex-1 mb-4 bg-[var(--paper)]"
                    />
                    <button
                      type="submit"
                      disabled={reEvaluating || revisedText.trim().length < 20 || revisedText === currentSession.userText}
                      className="py-2.5 px-6 btn-gradient-success disabled:bg-slate-200 disabled:from-slate-200 disabled:to-slate-300 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-xs self-start"
                    >
                      {reEvaluating ? (
                        <>
                          <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                          Re-evaluating...
                        </>
                      ) : (
                        "Resubmit revised attempt"
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column - Attempt History */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="iw-card p-6 flex flex-col flex-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] border-b pb-2 border-[var(--line)]">Attempt History</h3>

                  {loading ? (
                    <div className="text-center py-8 text-[var(--muted)] flex-1 flex flex-col justify-center items-center">
                      <span className="animate-spin inline-block w-5 h-5 border-2 border-[var(--line)] border-t-transparent rounded-full mb-1"></span>
                      <p className="text-[10px]">Loading history...</p>
                    </div>
                  ) : history.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted)] text-[11px] flex-1 flex flex-col justify-center">
                      No writing sessions found. Upload an image to start!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 custom-scroll flex-1 mt-4">
                      {history.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => {
                            setCurrentSession(session);
                            setRevisedText(session.revisedText ?? session.userText);
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className={`p-2.5 rounded-xl border flex items-center gap-3 cursor-pointer transition-all hover:bg-[var(--cream)]/40 hover:shadow-sm ${
                            currentSession.id === session.id ? "border-[var(--green)] bg-[var(--green)]/5" : "border-[var(--line)]"
                          }`}
                        >
                          <img src={session.imageUrl} alt="Thumbnail" className="w-10 h-10 object-cover rounded-lg border bg-slate-50 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center gap-1 mb-0.5">
                              <span className="text-[9px] text-[var(--muted)] font-extrabold">
                                {new Date(session.createdAt).toLocaleDateString()}
                              </span>
                              <span className={`text-[9px] font-extrabold ${session.revisedScore ? "text-emerald-600" : "text-[var(--green)]"}`}>
                                Score: {session.revisedScore ?? session.overallScore}
                              </span>
                            </div>
                            <p className="text-[10px] text-[var(--muted)] font-medium truncate italic">
                              &quot;{session.userText}&quot;
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
