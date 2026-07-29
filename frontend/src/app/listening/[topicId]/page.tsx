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
    <main className="dashboard-shell" style={{ marginTop: "20px" }}>
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
              <div style={{ display: "flex", background: "#edf1ed", borderRadius: "10px", padding: "3px" }}>
                <button
                  type="button"
                  onClick={() => setStudyMode("full")}
                  className={`button button-small ${studyMode === "full" ? "" : "button-secondary"}`}
                >
                  Full Type Sense
                </button>
                <button
                  type="button"
                  onClick={() => setStudyMode("blank")}
                  className={`button button-small ${studyMode === "blank" ? "" : "button-secondary"}`}
                >
                  Fill in Blank
                </button>
              </div>
            ) : (
              <span className="profile-badge role">
                {studyMode === "full" ? "Full Type Sense" : "Fill in Blank"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div style={{ maxWidth: "860px", margin: "32px auto 0", padding: "0 16px" }}>

        {/* Progress header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          <span>Sentence {currentIndex + 1} of {sentences.length}</span>
          <span style={{ color: "var(--green)", fontWeight: 800 }}>{Math.round(((currentIndex + 1) / sentences.length) * 100)}% Complete</span>
        </div>
        <div style={{ width: "100%", background: "#edf1ed", borderRadius: "999px", height: "8px", marginBottom: "32px", overflow: "hidden" }}>
          <div
            style={{ background: "#2f6d4f", height: "100%", borderRadius: "999px", width: `${((currentIndex + 1) / sentences.length) * 100}%`, transition: "all 0.3s" }}
          ></div>
        </div>

        {/* Audio controller card */}
        <div className="dashboard-card" style={{ padding: "28px", marginBottom: "28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>

          {/* Speed & Loop settings */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "20px" }}>
            {/* Speed selectors */}
            <div style={{ display: "flex", background: "#edf1ed", borderRadius: "10px", padding: "3px", fontSize: "12px", fontWeight: 700 }}>
              {([0.5, 0.75, 1.0, 1.25] as number[]).map((spd) => (
                <button
                  key={spd}
                  onClick={() => !(isAudioLocked || listenedCount >= (topic?.maxPlays || 5)) && handleSpeedChange(spd)}
                  disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
                  className={`button button-small ${playbackSpeed === spd ? "" : "button-secondary"}`}
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Loop Toggle */}
            <button
              type="button"
              onClick={() => !(isAudioLocked || listenedCount >= (topic?.maxPlays || 5)) && setIsLooping(!isLooping)}
              disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
              className={`button button-small ${isLooping ? "" : "button-outline"}`}
              style={{ fontSize: "11px" }}
            >
              🔄 LOOP SEGMENT
            </button>
          </div>

          {/* Play/Pause Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginBottom: "16px" }}>
            <button
              onClick={handlePlayPause}
              disabled={isAudioLocked || listenedCount >= (topic?.maxPlays || 5)}
              title={isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "Audio Locked - Max plays reached" : "Play / Pause"}
              style={{ width: "64px", height: "64px", borderRadius: "50%", background: isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "#cbd5e1" : "linear-gradient(135deg, #2f6d4f, #214f3a)", color: "white", display: "grid", placeItems: "center", border: 0, cursor: isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "not-allowed" : "pointer", boxShadow: "0 8px 24px rgba(47, 109, 79, 0.3)" }}
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
              className="button button-outline"
              style={{ width: "48px", height: "48px", borderRadius: "14px", display: "grid", placeItems: "center", padding: 0 }}
              title={isAudioLocked || listenedCount >= (topic?.maxPlays || 5) ? "Audio Locked" : "Replay Sentence segment"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" /></svg>
            </button>
          </div>

          <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
            Mistakes in segment: <span style={{ color: "#dc2626" }}>{errorCount}</span> | Plays: <span style={{ color: "var(--green)" }}>{listenedCount}</span>
          </span>
        </div>

        {/* Input area card */}
        <div className="dashboard-card" style={{ padding: "28px", marginBottom: "28px" }}>

          {studyMode === "full" ? (
            /* Full Type Sense typing engine */
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ textAlign: "center", minHeight: "4rem", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "8px", padding: "16px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "16px" }}>
                {activeSentence.text.split(/\s+/).map((word, wordIdx) => {
                  const prevWordsLength = activeSentence.text.split(/\s+/).slice(0, wordIdx).join(" ").length + (wordIdx > 0 ? 1 : 0);

                  return (
                    <span key={wordIdx} style={{ display: "inline-flex", gap: "2px", fontSize: "18px", fontWeight: 800, fontFamily: "monospace" }}>
                      {word.split("").map((char, charIdx) => {
                        const globalIdx = prevWordsLength + charIdx;
                        const hasTyped = typedText.length > globalIdx;
                        const isCharCorrect = hasTyped && typedText[globalIdx]?.toLowerCase() === char.toLowerCase();

                        const colorStyle = (showErrorHighlight && isHintsUnlocked)
                          ? isCharCorrect
                            ? "#16a34a"
                            : hasTyped
                              ? "#dc2626"
                              : "transparent"
                          : hasTyped
                            ? "#14251d"
                            : "transparent";

                        return (
                          <span
                            key={charIdx}
                            style={{ borderBottom: "2px solid #cbd5e1", color: colorStyle, minWidth: "12px", textAlign: "center" }}
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
                  className="form-input"
                  style={{ width: "100%", height: "80px", resize: "none", fontFamily: "monospace", padding: "12px 16px" }}
                />
              </div>

              {/* Action buttons (Check Answer & Hint popover) */}
              {!(isFullCorrect || isAnswerRevealed) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginTop: "16px" }}>
                  {/* Single Hint button when threshold reached */}
                  {isHintsUnlocked && (
                    <div style={{ position: "relative" }} ref={hintMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsHintMenuOpen((prev) => !prev)}
                        className="button button-small button-outline"
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>💡</span>
                        <span>{isHintMenuOpen ? "Close Hint" : "Hint"}</span>
                      </button>

                      {/* Floating Hint Popover */}
                      {isHintMenuOpen && (
                        <div style={{ position: "absolute", right: 0, bottom: "100%", marginBottom: "12px", width: "360px", background: "white", border: "1px solid #dce5dc", borderRadius: "16px", padding: "16px", boxShadow: "0 12px 36px rgba(0,0,0,0.12)", zIndex: 50 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #edf0ed", paddingBottom: "8px", marginBottom: "12px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 800, color: "#173f2d", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
                              💡 Available Hints
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsHintMenuOpen(false)}
                              style={{ background: "transparent", border: 0, color: "#718078", fontWeight: 800, cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Hint Display Content */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "240px", overflowY: "auto" }}>
                            {(!topic || !topic.activeHints || topic.activeHints.includes("vietnamese")) && activeSentence?.vietnameseTranslation && (
                              <div style={{ padding: "12px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "12px" }}>
                                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Gợi ý tiếng Việt</span>
                                <p style={{ margin: 0, fontSize: "13px", color: "#173f2d", fontStyle: "italic" }}>"{activeSentence.vietnameseTranslation}"</p>
                              </div>
                            )}

                            {(!topic || !topic.activeHints || topic.activeHints.includes("first_letter")) && (
                              <div style={{ padding: "12px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "12px" }}>
                                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Gợi ý chữ cái đầu</span>
                                <div style={{ display: "flex", flexWrap: "wrap", fontSize: "13px", fontFamily: "monospace", color: "#173f2d" }}>{renderFirstLetterHint()}</div>
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
                    className="button button-small"
                  >
                    Check Answer ({errorCount}/{topic?.maxPlays || 5})
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Fill in the Blank mode */
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ lineHeight: 1.6, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", padding: "16px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "16px", fontSize: "16px", fontWeight: 600, color: "#14251d" }}>
                {blankWords.map((item, idx) => {
                  const isHidden = !item.isHinted;

                  if (!isHidden) {
                    return (
                      <span key={idx} style={{ color: "#14251d" }}>
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
                      className="form-input"
                      style={{ width: "84px", textAlign: "center", fontWeight: 800, padding: "6px 8px" }}
                    />
                  );
                })}
              </div>

              {!(isBlankCorrect || isAnswerRevealed) && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                  {/* Single Hint button when threshold reached */}
                  {isHintsUnlocked && (
                    <div style={{ position: "relative" }} ref={hintMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsHintMenuOpen((prev) => !prev)}
                        className="button button-small button-outline"
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>💡</span>
                        <span>{isHintMenuOpen ? "Close Hint" : "Hint"}</span>
                      </button>

                      {/* Floating Hint Popover */}
                      {isHintMenuOpen && (
                        <div style={{ position: "absolute", right: 0, bottom: "100%", marginBottom: "12px", width: "360px", background: "white", border: "1px solid #dce5dc", borderRadius: "16px", padding: "16px", boxShadow: "0 12px 36px rgba(0,0,0,0.12)", zIndex: 50 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #edf0ed", paddingBottom: "8px", marginBottom: "12px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 800, color: "#173f2d", textTransform: "uppercase", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: "6px" }}>
                              💡 Available Hints
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsHintMenuOpen(false)}
                              style={{ background: "transparent", border: 0, color: "#718078", fontWeight: 800, cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          </div>

                          {/* Hint Display Content */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "240px", overflowY: "auto" }}>
                            {(!topic || !topic.activeHints || topic.activeHints.includes("vietnamese")) && activeSentence?.vietnameseTranslation && (
                              <div style={{ padding: "12px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "12px" }}>
                                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Gợi ý tiếng Việt</span>
                                <p style={{ margin: 0, fontSize: "13px", color: "#173f2d", fontStyle: "italic" }}>"{activeSentence.vietnameseTranslation}"</p>
                              </div>
                            )}

                            {(!topic || !topic.activeHints || topic.activeHints.includes("first_letter")) && (
                              <div style={{ padding: "12px", background: "#f8faf7", border: "1px solid #dfe5df", borderRadius: "12px" }}>
                                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Gợi ý chữ cái đầu</span>
                                <div style={{ display: "flex", flexWrap: "wrap", fontSize: "13px", fontFamily: "monospace", color: "#173f2d" }}>{renderFirstLetterHint()}</div>
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
                    className="button button-small"
                  >
                    Check Answer ({errorCount}/{topic?.maxPlays || 5})
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Correct feedback overlay */}
          {(isFullCorrect || isBlankCorrect) && (
            <div style={{ marginTop: "16px", padding: "16px", background: "#eaf3ec", border: "1px solid #b2d8be", color: "#1c5035", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px", fontWeight: 700 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>✨ Perfect transcription!</span>
              </div>
              <button
                type="button"
                onClick={handleNext}
                className="button button-small"
              >
                {currentIndex < sentences.length - 1 ? "Next sentence →" : "Finish Exercise 🎉"}
              </button>
            </div>
          )}

          {/* Skip option when check-submit limit is hit (answer revealed) */}
          {!(isFullCorrect || isBlankCorrect) && isAnswerRevealed && (
            <div style={{ marginTop: "16px", padding: "20px", background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🔒 Max attempts reached ({errorCount}/{topic?.maxPlays || 5} checks)</span>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "#7f1d1d" }}>You have used all your attempts. Here is the correct answer:</p>
              <div style={{ padding: "12px", background: "white", border: "1px solid #fca5a5", borderRadius: "12px", fontFamily: "monospace", fontSize: "16px", fontWeight: 800, color: "#991b1b", textAlign: "center" }}>
                {activeSentence.text}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={handleNext}
                  className="button button-small"
                  style={{ background: "#dc2626", color: "white" }}
                >
                  {currentIndex < sentences.length - 1 ? "Next sentence →" : "Finish Exercise"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
