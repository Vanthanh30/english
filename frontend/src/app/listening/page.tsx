"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ListeningTopic } from "@/services/listening.service";

export default function StudentListeningListPage() {
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
      const data = await listeningService.listTopics({
        search: search.trim() || undefined,
        level: levelFilter || undefined,
      });
      setTopics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load listening exercises");
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
    loadTopics();
  }, [sessionReady, user, router, loadTopics]);

  if (!sessionReady || loading && topics.length === 0) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium animate-pulse">Loading dictation exercises...</p>
        </div>
      </main>
    );
  }

  // Calculate some simple stats
  const completedCount = topics.filter((t) => t.progress?.completed).length;

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-16">
      {/* Header section with glassmorphism navbar */}
      <nav className="border-b border-[#334155]/60 bg-[#1e293b]/40 backdrop-blur-md sticky top-0 z-10 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-bold text-white shadow shadow-indigo-500/20 active:scale-95 transition-transform">
            EQ
          </Link>
          <span className="font-bold text-lg tracking-wide bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            English Quest
          </span>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === "ADMIN" && (
            <Link href="/admin/listening" className="px-3.5 py-1.5 rounded-lg border border-[#334155] text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">
              Dictation CMS
            </Link>
          )}
          <Link href="/dashboard" className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md active:scale-[0.98]">
            Dashboard
          </Link>
        </div>
      </nav>

      {/* Main body wrapper */}
      <div className="max-w-6xl mx-auto px-6 mt-10">
        
        {/* Banner with stats */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/15 rounded-3xl p-8 mb-10 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-60 h-60 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              Dictation Practice
            </h1>
            <p className="text-slate-400 text-sm max-w-xl mt-2 leading-relaxed">
              Listen to sentences and type what you hear. Improve your English listening comprehension, spelling, and grammar in an interactive environment.
            </p>
          </div>

          <div className="flex gap-4 shrink-0 bg-[#0f172a]/60 border border-slate-700/40 rounded-2xl p-4 backdrop-blur">
            <div className="text-center px-4">
              <span className="block text-2xl font-black text-indigo-400">{topics.length}</span>
              <small className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Total exercises</small>
            </div>
            <div className="w-px h-10 bg-slate-800 self-center"></div>
            <div className="text-center px-4">
              <span className="block text-2xl font-black text-emerald-400">{completedCount}</span>
              <small className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Completed</small>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl flex items-center gap-3 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>{error}</span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-grow relative">
            <span className="absolute left-4 top-3 text-slate-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="Search by topic title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 bg-[#1e293b]/60 border border-[#334155]/60 rounded-2xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all shadow-inner"
            />
          </div>
          
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-4 py-2.5 bg-[#1e293b]/60 border border-[#334155]/60 rounded-2xl text-slate-300 focus:outline-none focus:border-indigo-500 text-sm transition-all w-full md:w-48 shadow-inner"
          >
            <option value="">All Levels</option>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </div>

        {/* Catalog list */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 bg-[#1e293b]/10 border border-[#334155]/30 rounded-3xl p-8">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
            </div>
            <h3 className="text-slate-300 font-bold text-lg mb-1">No Dictation Exercises Found</h3>
            <p className="text-slate-500 text-sm max-w-sm">No exercises matched your search query or level filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic) => {
              const hasStarted = !!topic.progress;
              const isCompleted = !!topic.progress?.completed;

              return (
                <div
                  key={topic.id}
                  className="group bg-[#1e293b]/40 hover:bg-[#1e293b]/65 border border-[#334155]/60 hover:border-indigo-500/40 rounded-2xl overflow-hidden shadow-md hover:shadow-indigo-500/5 hover:-translate-y-0.5 transition-all duration-300 flex flex-col h-full"
                >
                  <div className="p-6 flex-grow">
                    {/* Level Badge and completion */}
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        topic.level === "BEGINNER"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : topic.level === "INTERMEDIATE"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}>
                        {topic.level}
                      </span>
                      
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                          COMPLETED
                        </span>
                      ) : hasStarted ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                          IN PROGRESS
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          NEW
                        </span>
                      )}
                    </div>

                    <h3 className="text-slate-100 font-extrabold text-lg leading-tight group-hover:text-indigo-400 transition-colors mb-2 line-clamp-2">
                      {topic.title}
                    </h3>
                    <p className="text-slate-400 text-xs line-clamp-3 leading-relaxed mb-4">
                      {topic.description || "Tune your hearing with this clean voice transcription exercise."}
                    </p>
                  </div>

                  {/* Foot Card Info */}
                  <div className="px-6 py-4 bg-[#111c30]/40 border-t border-[#334155]/60 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5 font-medium">
                      <svg className="w-4 h-4 text-indigo-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H8.679c-1.53 0-2.5-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" /></svg>
                      {topic.sentenceCount || 0} sentences
                    </span>

                    <Link
                      href={`/listening/${topic.slug}`}
                      className="px-4 py-2 bg-[#2e3748]/50 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 group-hover:bg-[#3b4b66]"
                    >
                      {isCompleted ? "Practice Again" : hasStarted ? "Resume" : "Start"}
                      <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
