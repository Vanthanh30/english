"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ListeningTopic, type ContentLevel } from "@/services/listening.service";

export default function AdminListeningPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [topics, setTopics] = useState<ListeningTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listeningService.listAdminTopics({
        search: search.trim() || undefined,
        level: levelFilter || undefined,
      });
      setTopics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load listening topics");
    } finally {
      setLoading(false);
    }
  }, [search, levelFilter]);

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
    loadTopics();
  }, [sessionReady, user, router, loadTopics]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await listeningService.deleteAdminTopic(id);
      setTopics(topics.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete topic");
    }
  };

  if (!sessionReady || loading && topics.length === 0) {
    return (
      <main className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Loading listening dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-app min-h-screen flex bg-[#0f172a] text-[#f8fafc] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b] border-r border-[#334155] flex flex-col p-6 shrink-0">
        <Link className="flex items-center gap-3 mb-8" href="/dashboard">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-violet-500/20">
            EQ
          </div>
          <div>
            <strong className="block text-slate-100 text-sm font-semibold tracking-wide">ENGLISH QUEST</strong>
            <small className="block text-violet-400 text-xs font-medium">Admin Workspace</small>
          </div>
        </Link>

        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">Workspace</div>
        <nav className="flex flex-col gap-2 mb-auto">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#334155]/50 transition-all font-medium text-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" /></svg>
            Dashboard
          </Link>
          <Link href="/admin/content" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#334155]/50 transition-all font-medium text-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Content library
          </Link>
          <span className="flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-600/25 text-violet-400 font-semibold text-sm border border-violet-500/25">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            Dictation CMS
          </span>
        </nav>

        {/* User Card */}
        <div className="flex items-center gap-3 p-4 bg-[#0f172a]/40 border border-[#334155]/40 rounded-xl mt-6">
          <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold text-sm shadow">
            {user?.displayName?.slice(0, 1).toUpperCase() || "A"}
          </div>
          <div className="overflow-hidden">
            <strong className="block text-slate-200 text-xs font-semibold truncate">{user?.displayName || "Admin"}</strong>
            <small className="block text-slate-400 text-[10px] truncate">{user?.email}</small>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="flex-grow flex flex-col min-w-0">
        {/* Topbar */}
        <header className="px-10 py-6 border-b border-[#334155] flex items-center justify-between bg-[#1e293b]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <span>Admin</span>
              <span>/</span>
              <span className="text-violet-400">Dictation CMS</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100">Listening Dictation Exercises</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage study exercises, upload audio/youtube, and transcribe automatically.</p>
          </div>
          <Link href="/admin/listening/create" className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-violet-500/20 active:scale-[0.98] transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
            Add New Exercise
          </Link>
        </header>

        {/* Content Body */}
        <div className="p-10 flex-grow overflow-auto">
          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span>{error}</span>
            </div>
          )}

          {/* Filters & Actions */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-grow relative">
              <span className="absolute left-4 top-3 text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="Search exercises by title or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-all"
              />
            </div>
            
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-slate-300 focus:outline-none focus:border-violet-500 text-sm transition-all w-full md:w-48"
            >
              <option value="">All Levels</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>

          {/* Table List */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : topics.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 bg-[#1e293b]/20 border border-[#334155]/40 rounded-2xl p-8">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              </div>
              <h3 className="text-slate-200 font-bold text-lg mb-1">No Dictation Exercises Found</h3>
              <p className="text-slate-500 text-sm max-w-sm">Add your first exercises by uploading audios or providing youtube video links.</p>
              <Link href="/admin/listening/create" className="mt-5 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all">
                Create First Exercise
              </Link>
            </div>
          ) : (
            <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-2xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#334155] bg-[#1e293b]/60">
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Exercise Info</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Level</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Sentences</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider">Source type</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334155]/60">
                    {topics.map((topic) => (
                      <tr key={topic.id} className="hover:bg-[#1e293b]/20 transition-all">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <strong className="text-slate-100 font-bold text-base hover:text-violet-400 transition-colors">
                              <Link href={`/admin/listening/${topic.id}`}>{topic.title}</Link>
                            </strong>
                            <span className="text-xs text-slate-400 mt-1 max-w-md truncate">{topic.description || "No description provided."}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            topic.level === "BEGINNER"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : topic.level === "INTERMEDIATE"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {topic.level}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-semibold text-sm">
                          {topic.sentenceCount || 0} sentences
                        </td>
                        <td className="px-6 py-4">
                          {topic.youtubeUrl ? (
                            <span className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.163a3.003 3.003 0 00-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 00-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 002.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 002.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                              YouTube
                            </span>
                          ) : topic.audioUrl ? (
                            <span className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                              Audio file
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs font-medium">Text script only</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/admin/listening/${topic.id}`}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all text-xs font-bold inline-flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(topic.id, topic.title)}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg transition-all text-xs font-bold inline-flex items-center gap-1 border border-rose-500/20"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
