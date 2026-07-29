"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { listeningService, type ListeningTopic, type ListeningSentence } from "@/services/listening.service";

type StudyMode = "full" | "blank";

interface BlankWord {
  index: number;
  word: string;
  cleaned: string;
  isHinted: boolean;
  value: string;
  isCorrect: boolean;
}

export default function StudentListeningExercisePage() {
  const router = useRouter();
  const { topicId } = useParams() as { topicId: string };
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  // Data states
  const [topic, setTopic] = useState<ListeningTopic | null>(null);
  const [sentences, setSentences] = useState<ListeningSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exercise Navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Playback settings
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isLooping, setIsLooping] = useState(false);

  // Study states
  const [studyMode, setStudyMode] = useState<StudyMode>("full");
  const [errorLimit, setErrorLimit] = useState(3);
  const [errorCount, setErrorCount] = useState(0);
  const [listenedCount, setListenedCount] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  // Hint activation states
  const [showViHint, setShowViHint] = useState(false);
  const [showFirstLetterHint, setShowFirstLetterHint] = useState(false);
  const [showErrorHighlight, setShowErrorHighlight] = useState(false);

  // Active sentence configuration
  const activeSentence = sentences[currentIndex];

  // Full Type Sense State
  const [typedText, setTypedText] = useState("");
  const [isFullCorrect, setIsFullCorrect] = useState(false);

  // Fill in the Blank State
  const [blankWords, setBlankWords] = useState<BlankWord[]>([]);
  const [isBlankCorrect, setIsBlankCorrect] = useState(false);

  // Statistics
  const [totalErrors, setTotalErrors] = useState(0);
  const [totalListened, setTotalListened] = useState(0);
  const [completedSentences, setCompletedSentences] = useState<string[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);

  // Media Player References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Timer for segment loop checking
  const checkTimeInterval = useRef<any>(null);

  // Load Exercise from backend
  useEffect(() => {
    if (!sessionReady) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await listeningService.getTopic(topicId);
        setTopic(res);
        setSentences(res.sentences || []);

        // Restore progress if available
        if (res.progress) {
          setCompletedSentences(res.progress.completedSentences || []);
          setTotalErrors(res.progress.errorCount || 0);
          setTotalListened(res.progress.listenedCount || 0);
        }

        // Apply topic settings
        if (res.studyMode && res.studyMode !== "both") {
          setStudyMode(res.studyMode as StudyMode);
        }
        if (res.errorLimit !== undefined) {
          setErrorLimit(res.errorLimit);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load dictation topic");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionReady, user, router, topicId]);

  // Setup YouTube player API if needed
  useEffect(() => {
    if (!topic?.youtubeUrl) return;

    // Load Youtube Iframe API
    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Set global callback
    (window as any).onYouTubeIframeAPIReady = () => {
      initYoutubePlayer();
    };

    if ((window as any).YT && (window as any).YT.Player) {
      initYoutubePlayer();
    }

    return () => {
      if (checkTimeInterval.current) clearInterval(checkTimeInterval.current);
    };

    function initYoutubePlayer() {
      // Extract video ID
      let videoId = "";
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = topic?.youtubeUrl?.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }

      if (!videoId) return;

      ytPlayerRef.current = new (window as any).YT.Player("youtube-player", {
        height: "0",
        width: "0",
        videoId: videoId,
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
        },
        events: {
          onReady: () => {
            setYtReady(true);
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }
          },
        },
      });
    }
  }, [topic]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (checkTimeInterval.current) clearInterval(checkTimeInterval.current);
    };
  }, []);

  // Monitor playback range for segment control
  const monitorPlaybackRange = useCallback(() => {
    if (!activeSentence) return;
    const { startTime, endTime } = activeSentence;
    if (startTime === null || endTime === null) return;

    if (checkTimeInterval.current) clearInterval(checkTimeInterval.current);

    const maxP = topic?.maxPlays || 5;

    checkTimeInterval.current = setInterval(() => {
      let currentTime = 0;
      if (topic?.youtubeUrl && ytPlayerRef.current?.getCurrentTime) {
        currentTime = ytPlayerRef.current.getCurrentTime();
        if (currentTime >= endTime - 0.05) {
          if (isLooping && listenedCount < maxP) {
            ytPlayerRef.current.seekTo(startTime);
            setListenedCount((prev) => prev + 1);
            setTotalListened((prev) => prev + 1);
          } else {
            ytPlayerRef.current.pauseVideo();
            ytPlayerRef.current.seekTo(startTime);
            setIsPlaying(false);
            if (checkTimeInterval.current) clearInterval(checkTimeInterval.current);
            if (listenedCount >= maxP) {
              setIsAudioLocked(true);
            }
          }
        }
      } else if (audioRef.current) {
        currentTime = audioRef.current.currentTime;
        if (currentTime >= endTime - 0.05) {
          if (isLooping && listenedCount < maxP) {
            audioRef.current.currentTime = startTime;
            setListenedCount((prev) => prev + 1);
            setTotalListened((prev) => prev + 1);
          } else {
            audioRef.current.pause();
            audioRef.current.currentTime = startTime;
            setIsPlaying(false);
            if (checkTimeInterval.current) clearInterval(checkTimeInterval.current);
            if (listenedCount >= maxP) {
              setIsAudioLocked(true);
            }
          }
        }
      }
    }, 100);
  }, [activeSentence, topic, isLooping, listenedCount]);

  // Control playback: Play/Pause Segment
  const handlePlayPause = () => {
    const maxP = topic?.maxPlays || 5;
    if (isAudioLocked || listenedCount >= maxP) {
      setIsAudioLocked(true);
      return;
    }
    if (!activeSentence) return;
    const { startTime } = activeSentence;

    if (topic?.youtubeUrl && ytPlayerRef.current) {
      if (isPlaying) {
        ytPlayerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        const currentTime = ytPlayerRef.current.getCurrentTime();
        if (startTime !== null && (currentTime < startTime || currentTime >= (activeSentence.endTime || 9999) - 0.2)) {
          ytPlayerRef.current.seekTo(startTime);
        }
        ytPlayerRef.current.setPlaybackRate(playbackSpeed);
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        setListenedCount((prev) => prev + 1);
        setTotalListened((prev) => prev + 1);
        monitorPlaybackRange();
      }
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const currentTime = audioRef.current.currentTime;
        if (startTime !== null && (currentTime < startTime || currentTime >= (activeSentence.endTime || 9999) - 0.2)) {
          audioRef.current.currentTime = startTime;
        }
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play();
        setIsPlaying(true);
        setListenedCount((prev) => prev + 1);
        setTotalListened((prev) => prev + 1);
        monitorPlaybackRange();
      }
    }
  };

  // Control playback: Replay active segment
  const handleReplaySegment = () => {
    const maxP = topic?.maxPlays || 5;
    if (isAudioLocked || listenedCount >= maxP) {
      setIsAudioLocked(true);
      return;
    }
    if (!activeSentence) return;
    const { startTime } = activeSentence;

    if (topic?.youtubeUrl && ytPlayerRef.current) {
      if (startTime !== null) ytPlayerRef.current.seekTo(startTime);
      ytPlayerRef.current.setPlaybackRate(playbackSpeed);
      ytPlayerRef.current.playVideo();
      setIsPlaying(true);
      setListenedCount((prev) => prev + 1);
      setTotalListened((prev) => prev + 1);
      monitorPlaybackRange();
    } else if (audioRef.current) {
      if (startTime !== null) audioRef.current.currentTime = startTime;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
      setListenedCount((prev) => prev + 1);
      setTotalListened((prev) => prev + 1);
      monitorPlaybackRange();
    }
  };

  // Adjust playback speed
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (topic?.youtubeUrl && ytPlayerRef.current) {
      ytPlayerRef.current.setPlaybackRate(speed);
    } else if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  // Hint popover menu states & click-outside ref
  const [isHintMenuOpen, setIsHintMenuOpen] = useState(false);
  const hintMenuRef = useRef<HTMLDivElement | null>(null);

  // Click outside listener for hint menu popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (hintMenuRef.current && !hintMenuRef.current.contains(event.target as Node)) {
        setIsHintMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize blanks for Fill-in-the-Blank mode
  const initBlankMode = useCallback(() => {
    if (!activeSentence) return;
    const words = activeSentence.text.split(/\s+/);

    // Choose which words to hide: hide roughly every 3rd word, excluding tiny words
    const list: BlankWord[] = words.map((w, idx) => {
      const cleaned = w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      // Hide logic: hide index 1, 4, 7, etc., unless cleaned is empty
      const shouldHide = cleaned.length > 1 && (idx % 3 === 1 || idx % 4 === 0);

      return {
        index: idx,
        word: w,
        cleaned: cleaned,
        isHinted: !shouldHide,
        value: shouldHide ? "" : w,
        isCorrect: !shouldHide,
      };
    });

    setBlankWords(list);
    setIsBlankCorrect(false);
  }, [activeSentence]);

  // Mode Switch & Initialization of fields
  useEffect(() => {
    if (!activeSentence) return;

    // Reset typing states
    setTypedText("");
    setIsFullCorrect(false);
    setErrorCount(0);
    setListenedCount(0);
    setIsAudioLocked(false);
    setIsAnswerRevealed(false);
    setShowViHint(false);
    setShowFirstLetterHint(false);
    setShowErrorHighlight(false);
    setIsHintMenuOpen(false);
    setIsLooping(false);

    // Stop and reset audio to sentence startTime
    if (audioRef.current) {
      audioRef.current.pause();
      if (activeSentence.startTime !== null) {
        audioRef.current.currentTime = activeSentence.startTime;
      }
    }
    if (ytPlayerRef.current?.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
      if (activeSentence.startTime !== null) {
        ytPlayerRef.current.seekTo(activeSentence.startTime);
      }
    }
    setIsPlaying(false);

    // Initialize blanks
    initBlankMode();
  }, [currentIndex, activeSentence, initBlankMode]);

  // Full Mode Key Checking Logic (Simply capture typing)
  const handleFullTyping = (value: string) => {
    if (isFullCorrect || isAnswerRevealed) return;
    if (isHintMenuOpen) setIsHintMenuOpen(false);
    setTypedText(value);
  };

  // Blank Mode checking logic (Simply capture values)
  const handleBlankWordChange = (idx: number, val: string) => {
    if (isBlankCorrect || isAnswerRevealed) return;
    if (isHintMenuOpen) setIsHintMenuOpen(false);
    const list = [...blankWords];
    const item = list[idx];
    if (item) {
      item.value = val;
      setBlankWords(list);
    }
  };

  // Mark sentence complete and save to progress
  const markSentenceComplete = () => {
    if (!activeSentence) return;
    if (!completedSentences.includes(activeSentence.id)) {
      const list = [...completedSentences, activeSentence.id];
      setCompletedSentences(list);

      // Save progress to backend
      listeningService.updateProgress(topic?.id || "", {
        completedSentences: list,
        listenedCount: totalListened,
        errorCount: totalErrors,
      }).catch(console.error);
    }
  };

  const isHintsUnlocked = errorCount >= errorLimit;
  const [isAudioLocked, setIsAudioLocked] = useState(false);

  // Manual Check Submissions logic for Full Mode
  const checkAnswer = () => {
    if (isAnswerRevealed || isFullCorrect || !activeSentence) return;

    const cleanInput = typedText.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ");
    const cleanTarget = activeSentence.text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ");

    const isCorrect = cleanInput === cleanTarget;

    if (isCorrect) {
      setIsFullCorrect(true);
      markSentenceComplete();
    } else {
      const newErrors = errorCount + 1;
      setErrorCount(newErrors);
      setTotalErrors((prev) => prev + 1);

      if (newErrors >= (topic?.maxPlays || 5)) {
        setIsAnswerRevealed(true);
      }
    }
  };

  // Manual Check Submissions logic for Blank Mode
  const checkBlankAnswer = () => {
    if (isAnswerRevealed || isBlankCorrect || !activeSentence) return;

    const list = [...blankWords];
    let isAllCorrect = true;

    list.forEach((item) => {
      if (!item.isHinted) {
        const isCorrect = item.value.trim().toLowerCase() === item.cleaned.toLowerCase();
        item.isCorrect = isCorrect;
        if (!isCorrect) {
          isAllCorrect = false;
        }
      }
    });

    setBlankWords(list);

    if (isAllCorrect) {
      setIsBlankCorrect(true);
      markSentenceComplete();
    } else {
      const newErrors = errorCount + 1;
      setErrorCount(newErrors);
      setTotalErrors((prev) => prev + 1);

      if (newErrors >= (topic?.maxPlays || 5)) {
        setIsAnswerRevealed(true);
      }
    }
  };

  // Auto activate hints if limits are exceeded
  useEffect(() => {
    if (isHintsUnlocked) {
      if (!topic?.activeHints || topic.activeHints.includes("vietnamese")) {
        setShowViHint(true);
      }
      if (!topic?.activeHints || topic.activeHints.includes("first_letter")) {
        setShowFirstLetterHint(true);
      }
      if (!topic?.activeHints || topic.activeHints.includes("error_highlight")) {
        setShowErrorHighlight(true);
      }
    } else {
      setShowViHint(false);
      setShowFirstLetterHint(false);
      setShowErrorHighlight(false);
    }
  }, [isHintsUnlocked, topic]);

  // Handle auto-pausing when audio is locked
  useEffect(() => {
    if (isAudioLocked) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (ytPlayerRef.current?.pauseVideo) {
        ytPlayerRef.current.pauseVideo();
      }
      setIsPlaying(false);
    }
  }, [isAudioLocked]);

  // Navigate: Previous sentence
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Navigate: Next sentence
  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Completed last sentence
      setIsFinished(true);
      submitFinalProgress();
    }
  };

  // Submit completion status
  const submitFinalProgress = async () => {
    setSavingProgress(true);
    try {
      await listeningService.updateProgress(topic?.id || "", {
        completedSentences: sentences.map((s) => s.id),
        listenedCount: totalListened,
        errorCount: totalErrors,
      });
    } catch (err) {
      console.error("Failed to save final progress", err);
    } finally {
      setSavingProgress(false);
    }
  };

  // Hint Helpers
  const renderFirstLetterHint = () => {
    if (!activeSentence) return null;
    const words = activeSentence.text.split(/\s+/);
    return words.map((w, i) => {
      const clean = w.replace(/[^a-zA-Z0-9]/g, "");
      const punctuation = w.replace(/[a-zA-Z0-9]/g, "");
      if (clean.length === 0) return w;
      return (
        <span key={i} className="inline-block mr-2 font-mono text-slate-400">
          <span className="text-violet-400 font-bold">{clean[0]}</span>
          {"_".repeat(clean.length - 1)}
          <span className="text-slate-500">{punctuation}</span>
        </span>
      );
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Preparing dictation workspace...</p>
        </div>
      </main>
    );
  }

  if (error || !topic) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4 border border-rose-500/25">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h3 className="text-slate-200 font-bold text-lg mb-2">Error Occurred</h3>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{error || "Could not fetch topic"}</p>
        <Link href="/listening" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all">
          Back to exercises
        </Link>
      </main>
    );
  }

  // Congratulations screen
  if (isFinished) {
    return (
      <main className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="relative p-10 bg-slate-900/60 border border-indigo-500/20 rounded-3xl max-w-lg w-full shadow-2xl backdrop-blur-md">
          <div className="absolute right-0 top-0 -mt-12 -mr-12 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-500/20 mx-auto mb-6">
            🎉
          </div>

          <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Congratulations!</h2>
          <p className="text-slate-400 text-sm mb-8">You have completed the dictation exercise: <strong>{topic.title}</strong></p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/40">
              <span className="block text-2xl font-black text-violet-400">{totalErrors}</span>
              <small className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Mistakes</small>
            </div>
            <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/40">
              <span className="block text-2xl font-black text-indigo-400">{totalListened}</span>
              <small className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Times Listened</small>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link href="/listening" className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold shadow transition-all active:scale-[0.98]">
              Practice other exercises
            </Link>
            <button
              onClick={() => {
                setCurrentIndex(0);
                setIsFinished(false);
                setTotalErrors(0);
                setTotalListened(0);
                setCompletedSentences([]);
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-all"
            >
              Restart Practice
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isCompleted = completedSentences.includes(activeSentence.id);

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-16">
      {/* Invisible media players */}
      {topic.audioUrl && (
        <audio
          ref={audioRef}
          src={topic.audioUrl}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      {topic.youtubeUrl && (
        <div className="hidden">
          <div id="youtube-player"></div>
        </div>
      )}

      {/* English Quest Navbar */}
      <header className="site-header">
        <div className="site-nav" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <Link className="brand" href="/dashboard">
              <span className="brand-mark">EQ</span>
              <span>English Quest</span>
            </Link>
            <Link href="/listening" className="button button-small button-outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              ← Back to Exercises
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", display: "none" }} className="md:inline">
              Exercise: {topic.title}
            </span>

            {/* Study Mode Selector */}
            {!topic || topic.studyMode === "both" ? (
              <div style={{ display: "flex", background: "#0f172a", borderRadius: "8px", padding: "2px", border: "1px solid #334155" }}>
                <button
                  type="button"
                  onClick={() => setStudyMode("full")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${studyMode === "full"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Full Type Sense
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("blank")}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${studyMode === "blank"
                      ? "bg-indigo-600 text-white shadow"
                      : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                  Fill in Blank
                </button>
              </div>
            ) : (
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", padding: "6px 12px", background: "#0f172a", border: "1px solid #334155", borderRadius: "8px", textTransform: "uppercase" }}>
                {studyMode === "full" ? "Full Type Sense" : "Fill in Blank"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="max-w-4xl mx-auto px-6 mt-10">

        {/* Progress header */}
        <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span>Sentence {currentIndex + 1} of {sentences.length}</span>
          <span className="text-indigo-400 font-semibold">{Math.round(((currentIndex + 1) / sentences.length) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-[#1e293b] rounded-full h-1.5 mb-8 border border-slate-800 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
          ></div>
        </div>

        {/* Audio controller card */}
        <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-3xl p-6 mb-8 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

          {/* Speed & Loop settings */}
          <div className="flex items-center justify-between w-full mb-6">
            {/* Speed selectors */}
            <div className="flex bg-[#0f172a]/60 rounded-xl p-0.5 border border-[#334155]/60 text-[10px] font-bold">
              {([0.5, 0.75, 1.0, 1.25] as number[]).map((spd) => (
                <button
                  key={spd}
                  onClick={() => !(isAudioLocked || listenedCount >= (topic?.maxPlays || 5)) && handleSpeedChange(spd)}
                  disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${playbackSpeed === spd
                      ? "bg-slate-700 text-white"
                      : "text-slate-500 hover:text-slate-300"
                    } disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => !(isAudioLocked || listenedCount >= (topic?.maxPlays || 5)) && setIsLooping(!isLooping)}
              disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold tracking-wider transition-all ${isLooping
                  ? "bg-violet-600/10 border-violet-500/30 text-violet-400"
                  : "bg-transparent border-slate-700/60 text-slate-500"
                } disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" /></svg>
              LOOP SEGMENT
            </button>
          </div>

          {/* Play/Pause Button */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={handlePlayPause}
              disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
              title={isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "Audio Locked - Max plays reached" : "Play / Pause"}
              className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 active:scale-95 transition-all disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none"
            >
              {isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? (
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              ) : isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            <button
              onClick={handleReplaySegment}
              disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
              className="p-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-all border border-[#334155]/60 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
              title={isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "Audio Locked" : "Replay Sentence segment"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" /></svg>
            </button>
          </div>

          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            Mistakes in segment: <span className="text-rose-400">{errorCount}</span> | Plays: <span className="text-indigo-400">{listenedCount}</span>
          </span>
        </div>

        {/* Input area */}
        <div className="bg-[#1e293b]/40 border border-[#334155]/60 rounded-3xl p-8 mb-8 shadow-lg">

          {studyMode === "full" ? (
            /* Full Type Sense typing engine */
            <div className="flex flex-col gap-6">
              <div className="text-center min-h-[4rem] flex items-center justify-center flex-wrap gap-x-2 gap-y-3 p-4 bg-[#0f172a]/60 rounded-2xl border border-slate-800 shadow-inner">
                {activeSentence.text.split(/\s+/).map((word, wordIdx) => {
                  const prevWordsLength = activeSentence.text.split(/\s+/).slice(0, wordIdx).join(" ").length + (wordIdx > 0 ? 1 : 0);

                  return (
                    <span key={wordIdx} className="inline-flex gap-x-0.5 text-lg font-bold font-mono tracking-wide">
                      {word.split("").map((char, charIdx) => {
                        const globalIdx = prevWordsLength + charIdx;
                        const hasTyped = typedText.length > globalIdx;
                        const isCharCorrect = hasTyped && typedText[globalIdx]?.toLowerCase() === char.toLowerCase();

                        const highlightStyle = (showErrorHighlight && isHintsUnlocked)
                          ? isCharCorrect
                            ? "text-emerald-400 border-emerald-500"
                            : hasTyped
                              ? "text-rose-400 border-rose-500 animate-shake"
                              : "text-transparent border-slate-800"
                          : hasTyped
                            ? "text-slate-100 border-indigo-500"
                            : "text-transparent border-slate-800";

                        return (
                          <span
                            key={charIdx}
                            className={`border-b-2 transition-all ${highlightStyle}`}
                          >
                            {hasTyped ? typedText[globalIdx] : "."}
                          </span>
                        );
                      })}
                    </span>
                  );
                })}
              </div>

              <div>
                <textarea
                  autoFocus
                  placeholder={isAnswerRevealed ? "Answer revealed below." : "Type the exact English letters you hear..."}
                  value={typedText}
                  onChange={(e) => handleFullTyping(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      checkAnswer();
                    }
                  }}
                  disabled={isFullCorrect || isAnswerRevealed}
                  className={`w-full px-4 py-3 bg-[#0f172a] border rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none text-sm transition-all h-20 resize-none font-mono ${isFullCorrect
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                      : isAnswerRevealed
                        ? "border-rose-500/50 bg-[#1e293b]/30 cursor-not-allowed opacity-50"
                        : "border-[#334155] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    }`}
                />
              </div>

              {/* Action buttons (Check Answer & Hint popover) */}
              {!(isFullCorrect || isAnswerRevealed) && (
                <div className="flex items-center justify-end gap-3 mt-3">
                  {/* Single Hint button when threshold reached */}
                  {isHintsUnlocked && (
                    <div className="relative" ref={hintMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsHintMenuOpen((prev) => !prev)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border active:scale-95 ${isHintMenuOpen
                            ? "bg-amber-500 border-amber-400 text-slate-950 font-black shadow-amber-500/20"
                            : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300"
                          }`}
                      >
                        <span className="text-sm">💡</span>
                        <span>{isHintMenuOpen ? "Close Hint" : "Hint"}</span>
                      </button>

                      {/* Floating Hint Popover */}
                      {isHintMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-3 w-80 md:w-96 bg-[#1e293b] border border-amber-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-fade-in backdrop-blur-xl">
                          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-3">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                              💡 Available Hints
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsHintMenuOpen(false)}
                              className="text-slate-400 hover:text-slate-200 text-xs font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Hint Display Content */}
                          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
                            {(!topic || !topic.activeHints || topic.activeHints.includes("vietnamese")) && activeSentence?.vietnameseTranslation && (
                              <div className="p-3 bg-[#0f172a] border border-amber-500/20 rounded-xl">
                                <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Gợi ý tiếng Việt</span>
                                <p className="text-xs text-slate-200 italic">"{activeSentence.vietnameseTranslation}"</p>
                              </div>
                            )}

                            {(!topic || !topic.activeHints || topic.activeHints.includes("first_letter")) && (
                              <div className="p-3 bg-[#0f172a] border border-amber-500/20 rounded-xl">
                                <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Gợi ý chữ cái đầu</span>
                                <div className="flex flex-wrap text-xs font-mono">{renderFirstLetterHint()}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Check Answer button */}
                  <button
                    type="button"
                    onClick={checkAnswer}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    Check Answer ({errorCount}/{topic?.maxPlays || 5})
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Fill in the Blank mode */
            <div className="flex flex-col gap-6">
              <div className="leading-relaxed flex flex-wrap items-center gap-x-2 gap-y-3 p-4 bg-[#0f172a]/60 rounded-2xl border border-slate-800 text-base font-medium">
                {blankWords.map((item, idx) => {
                  const isHidden = !item.isHinted;

                  if (!isHidden) {
                    return (
                      <span key={idx} className="text-slate-200">
                        {item.word}
                      </span>
                    );
                  }

                  // Render input field for missing word
                  return (
                    <input
                      key={idx}
                      type="text"
                      value={item.value}
                      placeholder="..."
                      onChange={(e) => handleBlankWordChange(idx, e.target.value)}
                      disabled={item.isCorrect || isAnswerRevealed}
                      className={`px-2 py-1 bg-[#1e293b] border rounded-lg text-sm text-center font-bold tracking-wide focus:outline-none focus:ring-1 transition-all w-20 ${item.isCorrect
                          ? "border-emerald-500/50 text-emerald-400"
                          : isAnswerRevealed
                            ? "border-rose-500/30 bg-[#1e293b]/20 text-rose-300 cursor-not-allowed opacity-50"
                            : (showErrorHighlight && isHintsUnlocked && item.value.trim() !== "" && !item.isCorrect)
                              ? "border-rose-500/50 text-rose-400"
                              : "border-slate-700 focus:border-indigo-500 focus:ring-indigo-500 text-slate-300"
                        }`}
                    />
                  );
                })}
              </div>

              {!(isBlankCorrect || isAnswerRevealed) && (
                <div className="flex items-center justify-end gap-3 mt-1">
                  {/* Single Hint button when threshold reached */}
                  {isHintsUnlocked && (
                    <div className="relative" ref={hintMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsHintMenuOpen((prev) => !prev)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 border active:scale-95 ${isHintMenuOpen
                            ? "bg-amber-500 border-amber-400 text-slate-950 font-black shadow-amber-500/20"
                            : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 text-amber-300"
                          }`}
                      >
                        <span className="text-sm">💡</span>
                        <span>{isHintMenuOpen ? "Close Hint" : "Hint"}</span>
                      </button>

                      {/* Floating Hint Popover */}
                      {isHintMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-3 w-80 md:w-96 bg-[#1e293b] border border-amber-500/40 rounded-2xl p-4 shadow-2xl z-50 animate-fade-in backdrop-blur-xl">
                          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-3">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                              💡 Available Hints
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsHintMenuOpen(false)}
                              className="text-slate-400 hover:text-slate-200 text-xs font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Hint Display Content */}
                          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
                            {(!topic || !topic.activeHints || topic.activeHints.includes("vietnamese")) && activeSentence?.vietnameseTranslation && (
                              <div className="p-3 bg-[#0f172a] border border-amber-500/20 rounded-xl">
                                <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Gợi ý tiếng Việt</span>
                                <p className="text-xs text-slate-200 italic">"{activeSentence.vietnameseTranslation}"</p>
                              </div>
                            )}

                            {(!topic || !topic.activeHints || topic.activeHints.includes("first_letter")) && (
                              <div className="p-3 bg-[#0f172a] border border-amber-500/20 rounded-xl">
                                <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1">Gợi ý chữ cái đầu</span>
                                <div className="flex flex-wrap text-xs font-mono">{renderFirstLetterHint()}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={checkBlankAnswer}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                    Check Answer ({errorCount}/{topic?.maxPlays || 5})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Correct feedback overlay */}
          {(isFullCorrect || isBlankCorrect) && (
            <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-2xl flex items-center justify-between text-sm animate-fade-in shadow-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>Perfect transcription!</span>
              </div>
              <button
                onClick={handleNext}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all active:scale-[0.97]"
              >
                {currentIndex < sentences.length - 1 ? "Next sentence" : "Finish Exercise"}
              </button>
            </div>
          )}

          {/* Skip option when check-submit limit is hit (answer revealed) */}
          {!(isFullCorrect || isBlankCorrect) && isAnswerRevealed && (
            <div className="mt-4 p-5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-2xl flex flex-col gap-3 shadow-lg animate-fade-in">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <span>Max attempts reached ({errorCount}/{topic?.maxPlays || 5} checks)</span>
              </div>
              <p className="text-slate-300 text-sm">You have used all your attempts. Here is the correct answer:</p>
              <div className="p-3 bg-[#0f172a] border border-[#334155] rounded-xl font-mono text-slate-100 text-base font-semibold text-center select-all">
                {activeSentence.text}
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleNext}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition-all active:scale-[0.97]"
                >
                  {currentIndex < sentences.length - 1 ? "Next sentence" : "Finish Exercise"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
