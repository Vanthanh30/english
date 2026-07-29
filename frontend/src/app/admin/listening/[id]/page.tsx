"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ContentLevel, type ListeningSentence } from "@/services/listening.service";

export default function AdminListeningEditPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<ContentLevel>("BEGINNER");
  const [sourceType, setSourceType] = useState<"audio" | "youtube">("audio");
  const [topic, setTopic] = useState<any>(null);
  
  // Custom Settings
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [studyMode, setStudyMode] = useState<"both" | "full" | "blank">("both");
  const [errorLimit, setErrorLimit] = useState(3);
  const [maxPlays, setMaxPlays] = useState(5);
  const [activeHints, setActiveHints] = useState<string[]>(["vietnamese", "first_letter", "error_highlight"]);

  const toggleHint = (hint: string) => {
    if (activeHints.includes(hint)) {
      setActiveHints(activeHints.filter((h) => h !== hint));
    } else {
      setActiveHints([...activeHints, hint]);
    }
  };
  
  // Audio upload state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioPublicId, setAudioPublicId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Youtube state
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Transcription & Sentences state
  const [transcript, setTranscript] = useState("");
  const [sentences, setSentences] = useState<Omit<ListeningSentence, "id" | "topicId">[]>([]);
  const [transcribing, setTranscribing] = useState(false);

  // General states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }

    const loadTopic = async () => {
      setLoading(true);
      try {
        const topicData = await listeningService.getAdminTopic(id);
        setTopic(topicData);
        setTitle(topicData.title);
        setDescription(topicData.description || "");
        setLevel(topicData.level);
        setTranscript(topicData.transcript);
        
        setStatus(topicData.status || "DRAFT");
        setStudyMode(topicData.studyMode || "both");
        setErrorLimit(topicData.errorLimit !== undefined ? topicData.errorLimit : 3);
        setMaxPlays(topicData.maxPlays !== undefined ? topicData.maxPlays : 5);
        setActiveHints(topicData.activeHints || ["vietnamese", "first_letter", "error_highlight"]);
        
        if (topicData.youtubeUrl) {
          setSourceType("youtube");
          setYoutubeUrl(topicData.youtubeUrl);
        } else {
          setSourceType("audio");
          setAudioUrl(topicData.audioUrl || "");
          setAudioPublicId(topicData.audioPublicId || "");
        }

        // Strip metadata IDs from sentences
        const cleanSentences = (topicData.sentences || []).map((s) => ({
          text: s.text,
          vietnameseTranslation: s.vietnameseTranslation,
          startTime: s.startTime,
          endTime: s.endTime,
          order: s.order,
        }));
        setSentences(cleanSentences);
      } catch (err: any) {
        setError(err.message || "Failed to load listening topic");
      } finally {
        setLoading(false);
      }
    };

    loadTopic();
  }, [sessionReady, user, router, id]);

  // Handle immediate audio upload to get Cloudinary URL
  const handleAudioUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    setUploadProgress(10);
    try {
      setUploadProgress(40);
      const res = await listeningService.uploadAudio(file);
      setUploadProgress(90);
      setAudioUrl(res.url);
      setAudioPublicId(res.publicId);
      setUploadProgress(100);
      setSuccess("Audio file uploaded successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to upload audio file");
      setAudioFile(null);
    } finally {
      setUploading(false);
    }
  };

  // Trigger Gemini AI transcription
  const handleTranscribe = async () => {
    setError(null);
    setSuccess(null);
    if (sourceType === "audio" && !audioUrl) {
      setError("Please upload an audio file first before transcribing.");
      return;
    }
    if (sourceType === "youtube" && !youtubeUrl) {
      setError("Please provide a YouTube video URL first before transcribing.");
      return;
    }

    setTranscribing(true);
    try {
      const result = await listeningService.autoTranscribe({
        audioUrl: sourceType === "audio" ? audioUrl : undefined,
        youtubeUrl: sourceType === "youtube" ? youtubeUrl : undefined,
      });

      setTranscript(result.transcript);
      setSentences(result.sentences);
      setSuccess("Transcription completed successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio. Ensure Gemini API key is valid.");
    } finally {
      setTranscribing(false);
    }
  };

  // Sentence grid operations
  const handleSentenceChange = (index: number, field: keyof Omit<ListeningSentence, "id" | "topicId">, value: any) => {
    const list = [...sentences];
    list[index] = { ...list[index], [field]: value };
    setSentences(list);

    // If changing text, regenerate full transcript
    if (field === "text") {
      const fullTxt = list.map((s) => s.text).join(" ");
      setTranscript(fullTxt);
    }
  };

  const removeSentence = (index: number) => {
    const list = sentences.filter((_, i) => i !== index);
    // Recalculate orders
    const updated = list.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSentences(updated);
    setTranscript(updated.map((s) => s.text).join(" "));
  };

  const addSentence = () => {
    const newOrder = sentences.length + 1;
    setSentences([
      ...sentences,
      {
        text: "",
        vietnameseTranslation: "",
        startTime: null,
        endTime: null,
        order: newOrder,
      },
    ]);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (sourceType === "audio" && !audioUrl) {
      setError("Audio file is required for audio mode.");
      return;
    }

    if (sourceType === "youtube" && !youtubeUrl) {
      setError("YouTube URL is required for YouTube mode.");
      return;
    }

    setSaving(true);
    try {
      const originalSourceUrl = topic?.youtubeUrl || topic?.audioUrl || "";
      const currentSourceUrl = sourceType === "youtube" ? youtubeUrl : audioUrl;
      const sourceChanged = originalSourceUrl !== currentSourceUrl;

      await listeningService.updateAdminTopic(id, {
        title,
        description,
        level,
        audioUrl: sourceType === "audio" ? audioUrl : null,
        audioPublicId: sourceType === "audio" ? audioPublicId : null,
        youtubeUrl: sourceType === "youtube" ? youtubeUrl : null,
        sentences: sourceChanged ? [] : sentences,
        transcript: sourceChanged ? "" : transcript,
        status,
        studyMode,
        activeHints,
        maxPlays,
        errorLimit,
      });

      setSuccess("Exercise updated successfully! Redirecting...");
      setTimeout(() => {
        router.push("/admin/listening");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update listening exercise");
    } finally {
      setSaving(false);
    }
  };

  if (!sessionReady || loading) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Loading exercise details...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-app">
      {/* Admin Sidebar */}
      <aside className="admin-sidebar">
        <Link className="admin-logo" href="/dashboard">
          <span>EQ</span>
          <div>
            <strong>English Quest</strong>
            <small>Admin workspace</small>
          </div>
        </Link>

        <div className="admin-sidebar-label">Workspace</div>
        <nav className="admin-side-nav" aria-label="Admin navigation">
          <Link href="/dashboard">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
            Dashboard
          </Link>
          <Link href="/admin/content">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5M9 19V5M14 19V5"/><path d="m18 5 2 14"/></svg>
            Content library
          </Link>
          <Link href="/admin/listening" className="active">
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" stroke="currentColor" strokeWidth="1.8"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
            Dictation CMS
          </Link>
        </nav>

        <div className="admin-sidebar-card">
          <span className="admin-sidebar-card-icon">
            ⚡
          </span>
          <strong>Sprint 2 workspace</strong>
          <p>Edit dictation exercise details and timestamp script.</p>
        </div>

        <div className="admin-user">
          <span>{user?.displayName?.slice(0, 1).toUpperCase() || "A"}</span>
          <div>
            <strong>{user?.displayName || "Administrator"}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
      </aside>

      {/* Main Form Area */}
      <section className="admin-main">
        <header className="px-10 py-6 border-b border-[#334155] flex items-center justify-between bg-[#1e293b]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <Link href="/admin/listening" className="hover:text-slate-200 transition-colors">Listening CMS</Link>
              <span>/</span>
              <span className="text-violet-400">Edit</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Edit Dictation Exercise</h1>
          </div>
          <Link href="/admin/listening" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to List
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="p-10 max-w-5xl flex flex-col gap-8">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{success}</span>
            </div>
          )}

          {/* Exercise Info Card */}
          <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-2xl p-6 flex flex-col gap-5">
            <h3 className="text-slate-200 font-bold text-base border-b border-[#334155] pb-2">1. Exercise General Info</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Exercise Title</label>
                <input
                  type="text"
                  placeholder="e.g. Daily English Conversation 01 - Weather"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Content Level</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ContentLevel)}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition-all"
                >
                  <option value="BEGINNER">Beginner (A1 - A2)</option>
                  <option value="INTERMEDIATE">Intermediate (B1 - B2)</option>
                  <option value="ADVANCED">Advanced (C1 - C2)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Short Description</label>
              <textarea
                placeholder="Give a brief summary of this conversation, vocabulary topic, or speech..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 text-sm transition-all h-20 resize-none"
              />
            </div>
          </div>

          {/* Settings Info Card */}
          <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-2xl p-6 flex flex-col gap-5">
            <h3 className="text-slate-200 font-bold text-base border-b border-[#334155] pb-2">2. Exercise Configurations & Hint Rules</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Exercise Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition-all"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Study Mode Allowed</label>
                <select
                  value={studyMode}
                  onChange={(e) => setStudyMode(e.target.value as "both" | "full" | "blank")}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 text-sm transition-all"
                >
                  <option value="both">Both (Full Type Sense & Fill in Blank)</option>
                  <option value="full">Full Type Sense Only</option>
                  <option value="blank">Fill in Blank Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Mistake Threshold for Hint</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={errorLimit}
                  onChange={(e) => setErrorLimit(parseInt(e.target.value) || 3)}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 text-sm transition-all"
                />
                <small className="block text-slate-500 mt-1">Number of spelling mistakes before active hints are unlocked.</small>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Max Plays per Sentence</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxPlays}
                  onChange={(e) => setMaxPlays(parseInt(e.target.value) || 5)}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 text-sm transition-all"
                />
                <small className="block text-slate-500 mt-1">Number of playback repeats before active hints are unlocked.</small>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Active Hints Allowed</label>
              <div className="flex flex-wrap gap-6 mt-2">
                <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeHints.includes("vietnamese")}
                    onChange={() => toggleHint("vietnamese")}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Vietnamese Translation Hint</span>
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeHints.includes("first_letter")}
                    onChange={() => toggleHint("first_letter")}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>First Letter Hint</span>
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeHints.includes("error_highlight")}
                    onChange={() => toggleHint("error_highlight")}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>Highlight Incorrect Words Hint</span>
                </label>
              </div>
            </div>
          </div>

          {/* Audio Source Options */}
          <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-2xl p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-[#334155] pb-2">
              <h3 className="text-slate-200 font-bold text-base">2. Audio / Video Source</h3>
              
              {/* Mode Toggle */}
              <div className="flex bg-[#0f172a] rounded-lg p-0.5 border border-[#334155]">
                <button
                  type="button"
                  onClick={() => setSourceType("audio")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    sourceType === "audio"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Audio File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("youtube")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    sourceType === "youtube"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  YouTube Link
                </button>
              </div>
            </div>

            {sourceType === "audio" ? (
              <div className="flex flex-col gap-3">
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider">Select Audio File (MP3, WAV, M4A, etc.)</label>
                <div className="flex items-center gap-4">
                  <div className="relative overflow-hidden inline-block">
                    <button
                      type="button"
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-[#334155] transition-all"
                    >
                      Change Audio File
                    </button>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAudioFile(file);
                          handleAudioUpload(file);
                        }
                      }}
                      className="absolute left-0 top-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <span className="text-slate-400 text-sm">
                    {audioFile ? audioFile.name : "Using current audio file"}
                  </span>
                </div>

                {uploading && (
                  <div className="w-full bg-[#0f172a] rounded-full h-2 mt-2 overflow-hidden border border-[#334155]">
                    <div
                      className="bg-violet-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                )}
                {audioUrl && (
                  <div className="mt-2 p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl flex items-center justify-between text-xs text-slate-400">
                    <span className="truncate max-w-lg">Cloudinary URL: {audioUrl}</span>
                    <audio src={audioUrl} controls className="h-8 shrink-0 ml-3" />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">YouTube Video URL</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=xxxxxxxxxxx"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0f172a] border border-[#334155] rounded-xl text-slate-100 focus:outline-none focus:border-violet-500 text-sm transition-all"
                />
                <small className="block text-slate-500 mt-1">E.g., TED-Ed talks, news, or dialogue videos. Make sure the video is public.</small>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-4 border-t border-[#334155] pt-6">
            <Link href="/admin/listening" className="px-5 py-3 bg-[#1e293b] hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-semibold transition-all">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || uploading}
              className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Updating & Transcribing with AI...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
