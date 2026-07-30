"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, FormEvent } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ContentLevel, type ListeningSentence, type ListeningTopic } from "@/services/listening.service";

export default function EditListeningTopicPage() {
  const router = useRouter();
  const params = useParams();
  const topicId = params.id as string;

  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  // Form State
  const [topic, setTopic] = useState<ListeningTopic | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<ContentLevel>("BEGINNER");
  const [sourceType, setSourceType] = useState<"audio" | "youtube">("audio");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioPublicId, setAudioPublicId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [studyMode, setStudyMode] = useState<"both" | "full" | "blank">("both");
  const [activeHints, setActiveHints] = useState<string[]>(["vietnamese", "first_letter", "error_highlight"]);
  const [maxPlays, setMaxPlays] = useState<number>(5);
  const [errorLimit, setErrorLimit] = useState<number>(3);

  const [transcript, setTranscript] = useState("");
  const [sentences, setSentences] = useState<ListeningSentence[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadTopicDetails = useCallback(async () => {
    if (!topicId) return;
    setLoading(true);
    try {
      const data = await listeningService.getAdminTopic(topicId);
      setTopic(data);
      setTitle(data.title);
      setDescription(data.description || "");
      setLevel(data.level);
      setTranscript(data.transcript || "");
      setSentences(data.sentences || []);
      setStatus(data.status || "DRAFT");
      setStudyMode(data.studyMode || "both");
      setActiveHints(data.activeHints || ["vietnamese", "first_letter", "error_highlight"]);
      setMaxPlays(data.maxPlays || 5);
      setErrorLimit(data.errorLimit || 3);

      if (data.youtubeUrl) {
        setSourceType("youtube");
        setYoutubeUrl(data.youtubeUrl);
      } else if (data.audioUrl) {
        setSourceType("audio");
        setAudioUrl(data.audioUrl);
        setAudioPublicId(data.audioPublicId || "");
      }
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load exercise details");
    } finally {
      setLoading(false);
    }
  }, [topicId]);

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
    loadTopicDetails();
  }, [sessionReady, user, router, loadTopicDetails]);

  const toggleHint = (hintKey: string) => {
    if (activeHints.includes(hintKey)) {
      setActiveHints(activeHints.filter((h) => h !== hintKey));
    } else {
      setActiveHints([...activeHints, hintKey]);
    }
  };

  const handleAudioUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(20);
    setError(null);
    try {
      const res = await listeningService.uploadAudio(file);
      setUploadProgress(100);
      setAudioUrl(res.url);
      setAudioPublicId(res.publicId);
      setSuccess("Audio file uploaded successfully to Cloudinary!");
    } catch (err: any) {
      setError(err.message || "Failed to upload audio file");
    } finally {
      setUploading(false);
    }
  };

  const handleAutoTranscribe = async () => {
    if (sourceType === "audio" && !audioUrl) {
      setError("Please upload an audio file first before transcribing.");
      return;
    }
    if (sourceType === "youtube" && !youtubeUrl) {
      setError("Please enter a valid YouTube video URL.");
      return;
    }

    setError(null);
    setTranscribing(true);
    try {
      const result = await listeningService.autoTranscribe({
        audioUrl: sourceType === "audio" ? audioUrl : undefined,
        youtubeUrl: sourceType === "youtube" ? youtubeUrl : undefined,
      });

      setTranscript(result.transcript);
      setSentences(result.sentences.map((s, idx) => ({ ...s, id: `temp-${idx}`, topicId })));

      if (result.audioUrl) {
        setAudioUrl(result.audioUrl);
      }
      if (result.audioPublicId) {
        setAudioPublicId(result.audioPublicId);
      }

      setSuccess(
        sourceType === "youtube"
          ? "YouTube video successfully converted to hosted audio & transcribed!"
          : "Audio transcribed successfully!"
      );
    } catch (err: any) {
      setError(err.message || "Failed to transcribe audio. Ensure Gemini API key is valid.");
    } finally {
      setTranscribing(false);
    }
  };

  const handleSentenceChange = (index: number, field: keyof ListeningSentence, value: any) => {
    const list = [...sentences];
    list[index] = { ...list[index], [field]: value };
    setSentences(list);

    if (field === "text") {
      const fullTxt = list.map((s) => s.text).join(" ");
      setTranscript(fullTxt);
    }
  };

  const removeSentence = (index: number) => {
    const list = sentences.filter((_, i) => i !== index);
    const updated = list.map((s, idx) => ({ ...s, order: idx + 1 }));
    setSentences(updated);
    setTranscript(updated.map((s) => s.text).join(" "));
  };

  const addSentence = () => {
    const newOrder = sentences.length + 1;
    setSentences([
      ...sentences,
      {
        id: `new-${Date.now()}`,
        topicId,
        order: newOrder,
        text: "",
        vietnameseTranslation: "",
        startTime: 0,
        endTime: 5,
      },
    ]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Exercise title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sourceChanged = (sourceType === "audio" && audioUrl !== topic?.audioUrl) || (sourceType === "youtube" && youtubeUrl !== topic?.youtubeUrl);

      await listeningService.updateAdminTopic(topicId, {
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
      <main className="admin-loading">
        <span className="admin-loading-mark">EQ</span>
        <p>Loading exercise details...</p>
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
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin / Dictation CMS / Edit</p>
            <h1>Edit Dictation Exercise</h1>
            <p>Update exercise info, configure hint rules, and edit timestamps.</p>
          </div>
          <Link href="/admin/listening" className="admin-back-link">
            Back to List
          </Link>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "960px" }}>
          {error && <p className="form-message form-error">{error}</p>}
          {success && <p className="form-message form-success">{success}</p>}

          {/* Exercise Info Card */}
          <div style={{ background: "white", border: "1px solid #dfe5df", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#173f2d", borderBottom: "1px solid #edf0ed", paddingBottom: "10px" }}>
              1. Exercise General Info
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Exercise Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily English Conversation 01 - Weather"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Content Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as ContentLevel)}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                >
                  <option value="BEGINNER">Beginner (A1 - A2)</option>
                  <option value="INTERMEDIATE">Intermediate (B1 - B2)</option>
                  <option value="ADVANCED">Advanced (C1 - C2)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                Short Description
              </label>
              <textarea
                placeholder="Give a brief summary of this conversation, vocabulary topic, or speech..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input"
                style={{ width: "100%", height: "80px", resize: "none", padding: "10px 14px" }}
              />
            </div>
          </div>

          {/* Settings Info Card */}
          <div style={{ background: "white", border: "1px solid #dfe5df", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#173f2d", borderBottom: "1px solid #edf0ed", paddingBottom: "10px" }}>
              2. Exercise Configurations & Hint Rules
            </h3>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Exercise Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "DRAFT" | "PUBLISHED")}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Study Mode Allowed
                </label>
                <select
                  value={studyMode}
                  onChange={(e) => setStudyMode(e.target.value as "both" | "full" | "blank")}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                >
                  <option value="both">Both (Full Type Sense & Fill in Blank)</option>
                  <option value="full">Full Type Sense Only</option>
                  <option value="blank">Fill in Blank Only</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Mistake Threshold for Hint
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={errorLimit}
                  onChange={(e) => setErrorLimit(parseInt(e.target.value) || 3)}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                />
                <small style={{ color: "#718078", fontSize: "11px", marginTop: "4px", display: "block" }}>Number of spelling mistakes before active hints are unlocked.</small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  Max Plays per Sentence
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxPlays}
                  onChange={(e) => setMaxPlays(parseInt(e.target.value) || 5)}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                />
                <small style={{ color: "#718078", fontSize: "11px", marginTop: "4px", display: "block" }}>Number of playback repeats before active hints are unlocked.</small>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "10px" }}>
                Active Hints Allowed
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#173f2d", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={activeHints.includes("vietnamese")}
                    onChange={() => toggleHint("vietnamese")}
                    style={{ width: "16px", height: "16px", accentColor: "#173f2d" }}
                  />
                  <span>Vietnamese Translation Hint</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#173f2d", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={activeHints.includes("first_letter")}
                    onChange={() => toggleHint("first_letter")}
                    style={{ width: "16px", height: "16px", accentColor: "#173f2d" }}
                  />
                  <span>First Letter Hint</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#173f2d", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={activeHints.includes("error_highlight")}
                    onChange={() => toggleHint("error_highlight")}
                    style={{ width: "16px", height: "16px", accentColor: "#173f2d" }}
                  />
                  <span>Highlight Incorrect Words Hint</span>
                </label>
              </div>
            </div>
          </div>

          {/* Audio Source Options */}
          <div style={{ background: "white", border: "1px solid #dfe5df", borderRadius: "16px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #edf0ed", paddingBottom: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#173f2d" }}>3. Audio / Video Source</h3>
              
              <div style={{ display: "flex", background: "#edf1ed", padding: "3px", borderRadius: "10px" }}>
                <button
                  type="button"
                  onClick={() => setSourceType("audio")}
                  className={`button button-small ${sourceType === "audio" ? "" : "button-secondary"}`}
                >
                  Audio File Upload
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType("youtube")}
                  className={`button button-small ${sourceType === "youtube" ? "" : "button-secondary"}`}
                >
                  YouTube Link
                </button>
              </div>
            </div>

            {sourceType === "audio" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e" }}>
                  Select Audio File (MP3, WAV, M4A, etc.)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
                    <button
                      type="button"
                      className="button button-small button-outline"
                    >
                      Choose Audio File
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
                      style={{ position: "absolute", left: 0, top: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                    />
                  </div>
                  <span style={{ fontSize: "13px", color: "#69776e" }}>
                    {audioFile ? audioFile.name : "No file chosen"}
                  </span>
                </div>

                {uploading && (
                  <div style={{ width: "100%", background: "#edf1ed", borderRadius: "999px", height: "8px", overflow: "hidden", marginTop: "8px" }}>
                    <div
                      style={{ background: "#246044", height: "100%", borderRadius: "999px", width: `${uploadProgress}%`, transition: "all 0.3s" }}
                    ></div>
                  </div>
                )}
                {audioUrl && (
                  <div style={{ marginTop: "12px", padding: "12px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", color: "#173f2d" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "500px" }}>Cloudinary URL: {audioUrl}</span>
                    <audio src={audioUrl} controls style={{ height: "32px", marginLeft: "12px" }} />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#69776e", marginBottom: "6px" }}>
                  YouTube Video URL
                </label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=xxxxxxxxxxx"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="form-input"
                  style={{ width: "100%", padding: "10px 14px" }}
                />
                <small style={{ color: "#718078", fontSize: "11px", marginTop: "4px", display: "block" }}>E.g., TED-Ed talks, news, or dialogue videos. Make sure the video is public.</small>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid #dfe5df", paddingTop: "20px" }}>
            <Link href="/admin/listening" className="button button-outline">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || uploading}
              className="button"
            >
              {saving ? "Updating Exercise..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
