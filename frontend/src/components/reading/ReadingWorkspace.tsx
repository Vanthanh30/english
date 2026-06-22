"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import {
  readingApi,
  type ReadingItem,
  type VocabularyHighlight,
  type HighlightColor,
  type ReadingStatus,
} from "@/services/reading.service";
import DictionaryPopup from "./DictionaryPopup";
import NotePanel from "./NotePanel";

interface ReadingWorkspaceProps {
  id: string;
}

export default function ReadingWorkspace({ id }: ReadingWorkspaceProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPercentageRef = useRef(0);

  const [item, setItem] = useState<ReadingItem | null>(null);
  const [highlights, setHighlights] = useState<VocabularyHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [lineSpacing, setLineSpacing] = useState<"compact" | "normal" | "relaxed">("normal");
  const [theme, setTheme] = useState<"light" | "dark" | "sepia">("light");
  const [fontFamily, setFontFamily] = useState<"serif" | "sans" | "mono">("serif");

  // Sidebar
  const [showNotes, setShowNotes] = useState(false);

  // Dictionary Popup State
  const [popupWord, setPopupWord] = useState<string | null>(null);
  const [popupOffset, setPopupOffset] = useState(-1);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });

  // Reading Stats
  const [timeSpent, setTimeSpent] = useState(0);

  const fetchDetails = async () => {
    try {
      const resItem = await readingApi.get(id);
      setItem(resItem);
      const resHl = await readingApi.listHighlights(id);
      setHighlights(resHl);
      setError(null);

      // Scroll restoration
      if (resItem.bookmarkPosition > 0) {
        setTimeout(() => {
          if (scrollRef.current) {
            const container = scrollRef.current;
            container.scrollTop = resItem.bookmarkPosition * (container.scrollHeight - container.clientHeight);
          }
        }, 300);
      }

      // Mark as reading if not started
      if (resItem.status === "NOT_STARTED") {
        await readingApi.updateStatus(id, "READING");
        setItem((prev) => (prev ? { ...prev, status: "READING" } : null));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionReady && user) {
      fetchDetails();
    }
  }, [id, sessionReady, user]);

  // Track session reading time
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-save bookmark every 30 seconds
  useEffect(() => {
    const autoSaveTimer = setInterval(async () => {
      if (sessionReady && user && item) {
        const pct = scrollPercentageRef.current;
        if (pct >= 0 && pct <= 1) {
          try {
            await readingApi.updateBookmark(id, pct);
          } catch (e) {
            console.error("Failed to auto-save scroll bookmark", e);
          }
        }
      }
    }, 30000);

    return () => clearInterval(autoSaveTimer);
  }, [id, sessionReady, user, item]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const total = container.scrollHeight - container.clientHeight;
      if (total > 0) {
        scrollPercentageRef.current = container.scrollTop / total;
      }
    }
  };

  const handleStatusToggle = async () => {
    if (!item) return;
    const newStatus: ReadingStatus = item.status === "COMPLETED" ? "READING" : "COMPLETED";
    try {
      const updated = await readingApi.updateStatus(id, newStatus);
      setItem(updated);
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const getSelectionCharacterOffsetWithin = (element: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return -1;
    const range = selection.getRangeAt(0);

    let charIndex = 0;
    const nodeStack: Node[] = [element];
    let node: Node | undefined;
    let foundStart = false;

    while ((node = nodeStack.pop())) {
      if (node === range.startContainer) {
        charIndex += range.startOffset;
        foundStart = true;
        break;
      }
      if (node.nodeType === 3) {
        charIndex += (node as CharacterData).length;
      } else {
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
    if (!foundStart) return -1;
    return charIndex;
  };

  const handleTextSelection = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (!selection) return;

    const rawWord = selection.toString();
    const trimmedWord = rawWord.trim();
    
    // Validate selection is a word/phrase, not too long (up to 300 characters for phrases/clauses)
    if (trimmedWord.length > 0 && trimmedWord.length < 300 && containerRef.current) {
      const range = selection.getRangeAt(0);
      const paraElem = range.startContainer.parentElement?.closest(".reader-paragraph") as HTMLElement | null;
      if (!paraElem) return;

      const paraStart = parseInt(paraElem.getAttribute("data-para-start") || "0", 10);
      let localOffset = getSelectionCharacterOffsetWithin(paraElem);
      
      if (localOffset !== -1) {
        // Adjust for leading whitespace in selection
        const leadingWhitespaceLength = rawWord.length - rawWord.trimStart().length;
        localOffset += leadingWhitespaceLength;

        const absoluteOffset = paraStart + localOffset;
        const rect = range.getBoundingClientRect();
        
        setPopupWord(trimmedWord);
        setPopupOffset(absoluteOffset);
        setPopupPos({
          top: window.scrollY + rect.top,
          left: window.scrollX + rect.left + rect.width / 2,
        });
      }
    }
  };

  // Add a highlight
  const applyHighlight = async (color: HighlightColor) => {
    if (!popupWord || popupOffset === -1) return;
    try {
      const newHl = await readingApi.addHighlight(id, {
        word: popupWord,
        color,
        charOffset: popupOffset,
      });
      // Append highlight to state
      setHighlights((prev) => {
        const exists = prev.some(h => h.charOffset === newHl.charOffset && h.word === newHl.word);
        if (exists) return prev;
        return [...prev, newHl];
      });
      setPopupWord(null);
      setPopupOffset(-1);
    } catch (err) {
      alert("Failed to add highlight");
    }
  };

  // Remove a highlight
  const handleRemoveHighlight = async (highlightId: string, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent standard right-click context menu
    if (!confirm("Remove this highlight?")) return;
    try {
      await readingApi.removeHighlight(id, highlightId);
      setHighlights((prev) => prev.filter((h) => h.id !== highlightId));
      setPopupWord(null);
      setPopupOffset(-1);
    } catch (err) {
      alert("Failed to remove highlight");
    }
  };

  // Handle click on existing highlight in content
  const handleHighlightClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("highlight-span")) {
      const word = target.getAttribute("data-word") || "";
      const offsetStr = target.getAttribute("data-offset") || "0";
      const rect = target.getBoundingClientRect();

      setPopupWord(word);
      setPopupOffset(parseInt(offsetStr, 10));
      setPopupPos({
        top: window.scrollY + rect.top,
        left: window.scrollX + rect.left + rect.width / 2,
      });
    }
  };

  const renderContent = () => {
    if (!item) return "";

    // Split text into paragraphs based on newline characters while matching raw offset values
    const paragraphs: { text: string; start: number; end: number }[] = [];
    const newlineRegex = /\r?\n/g;
    let lastIndex = 0;
    let match;

    while ((match = newlineRegex.exec(item.content)) !== null) {
      const text = item.content.substring(lastIndex, match.index);
      paragraphs.push({
        text,
        start: lastIndex,
        end: match.index,
      });
      lastIndex = newlineRegex.lastIndex;
    }
    if (lastIndex <= item.content.length) {
      paragraphs.push({
        text: item.content.substring(lastIndex),
        start: lastIndex,
        end: item.content.length,
      });
    }

    // Process highlights locally inside each paragraph block
    const paragraphHtmls = paragraphs.map((para) => {
      let paraText = para.text;
      
      const paraHighlights = highlights.filter(
        (hl) => hl.charOffset >= para.start && hl.charOffset + hl.word.length <= para.end
      );

      // Sort highlights backwards to preserve offsets during slice replacements
      const sortedParaHighlights = [...paraHighlights].sort((a, b) => b.charOffset - a.charOffset);

      for (const hl of sortedParaHighlights) {
        const localOffset = hl.charOffset - para.start;
        if (localOffset >= 0 && localOffset + hl.word.length <= paraText.length) {
          const before = paraText.substring(0, localOffset);
          const word = paraText.substring(localOffset, localOffset + hl.word.length);
          const after = paraText.substring(localOffset + hl.word.length);

          paraText =
            before +
            `<span class="highlight-span hl-${hl.color.toLowerCase()}" data-highlight-id="${hl.id}" data-word="${word}" data-offset="${hl.charOffset}">${word}</span>` +
            after;
        }
      }

      if (!paraText.trim()) {
        return `<p class="reader-paragraph empty-line" data-para-start="${para.start}" data-para-end="${para.end}">&nbsp;</p>`;
      }

      return `<p class="reader-paragraph" data-para-start="${para.start}" data-para-end="${para.end}">${paraText}</p>`;
    });

    return paragraphHtmls.join("");
  };

  const getStats = () => {
    if (!item) return null;
    const yellow = highlights.filter((h) => h.color === "YELLOW").length;
    const green = highlights.filter((h) => h.color === "GREEN").length;
    const red = highlights.filter((h) => h.color === "RED").length;

    const min = Math.floor(timeSpent / 60);
    const sec = timeSpent % 60;
    const timeDisplay = `${min}m ${sec}s`;

    return {
      yellow,
      green,
      red,
      total: highlights.length,
      timeDisplay,
    };
  };

  if (!sessionReady || !user) {
    return <main className="reading-loading">Accessing Reading Workspace...</main>;
  }

  if (loading) {
    return <main className="reading-loading">Loading reading workspace...</main>;
  }

  if (error || !item) {
    return (
      <main className="reading-error">
        <h2>Failed to open document</h2>
        <p>{error || "Document not found"}</p>
        <Link href="/reading" className="back-link">
          Return to Library
        </Link>
      </main>
    );
  }

  const stats = getStats();

  return (
    <main className={`reading-workspace-page theme-${theme}`}>
      {/* Top progress bar */}
      <div className="workspace-progress-track">
        <div className="progress-bar" style={{ width: `${scrollPercentageRef.current * 100}%` }}></div>
      </div>

      <header className="workspace-header">
        <div className="header-left">
          <Link href="/reading" className="back-btn">
            ← Library
          </Link>
          <span className="workspace-title-badge">Reading Workspace</span>
        </div>

        {/* Styling controls toolbar */}
        <div className="workspace-controls-toolbar">
          <div className="control-group">
            <span className="control-lbl">Theme</span>
            <div className="control-opts">
              <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Light</button>
              <button className={theme === "sepia" ? "active" : ""} onClick={() => setTheme("sepia")}>Sepia</button>
              <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Dark</button>
            </div>
          </div>

          <div className="control-group">
            <span className="control-lbl">Font</span>
            <div className="control-opts">
              <button className={fontFamily === "serif" ? "active" : ""} onClick={() => setFontFamily("serif")}>Serif</button>
              <button className={fontFamily === "sans" ? "active" : ""} onClick={() => setFontFamily("sans")}>Sans</button>
              <button className={fontFamily === "mono" ? "active" : ""} onClick={() => setFontFamily("mono")}>Mono</button>
            </div>
          </div>

          <div className="control-group">
            <span className="control-lbl">Size</span>
            <div className="control-opts">
              <button className={fontSize === "sm" ? "active" : ""} onClick={() => setFontSize("sm")}>A-</button>
              <button className={fontSize === "md" ? "active" : ""} onClick={() => setFontSize("md")}>A</button>
              <button className={fontSize === "lg" ? "active" : ""} onClick={() => setFontSize("lg")}>A+</button>
              <button className={fontSize === "xl" ? "active" : ""} onClick={() => setFontSize("xl")}>A++</button>
            </div>
          </div>

          <div className="control-group">
            <span className="control-lbl">Spacing</span>
            <div className="control-opts">
              <button className={lineSpacing === "compact" ? "active" : ""} onClick={() => setLineSpacing("compact")}>Compact</button>
              <button className={lineSpacing === "normal" ? "active" : ""} onClick={() => setLineSpacing("normal")}>Normal</button>
              <button className={lineSpacing === "relaxed" ? "active" : ""} onClick={() => setLineSpacing("relaxed")}>Relaxed</button>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button className={`notes-toggle-btn ${showNotes ? "active" : ""}`} onClick={() => setShowNotes(!showNotes)}>
            📝 Notes Side Panel
          </button>
        </div>
      </header>

      <div className="workspace-body-container">
        {/* Main reading content body */}
        <div
          ref={scrollRef}
          className="workspace-reader-scrollable"
          onScroll={handleScroll}
        >
          <div className="workspace-reader-inner">
            <div className="article-header">
              <h1>{item.title}</h1>
              <div className="article-meta">
                <span>⏱️ Estimated: {Math.ceil(item.wordCount / 200)} min read</span>
                <span>📊 {item.wordCount} words</span>
                {item.sourceUrl && (
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link">
                    Open Original Link ↗
                  </a>
                )}
              </div>
            </div>

            <div
              ref={containerRef}
              className={`workspace-content-body font-${fontSize} spacing-${lineSpacing} family-${fontFamily}`}
              onMouseUp={handleTextSelection}
              onClick={handleHighlightClick}
              onContextMenu={(e) => {
                const target = e.target as HTMLElement;
                if (target.classList.contains("highlight-span")) {
                  const hlId = target.getAttribute("data-highlight-id") || "";
                  handleRemoveHighlight(hlId, e);
                }
              }}
              dangerouslySetInnerHTML={{ __html: renderContent() }}
            />

            <div className="article-footer">
              <div className="footer-status-control">
                <span className="status-label">Reading Status: <strong>{item.status}</strong></span>
                <button className="status-toggle-btn" onClick={handleStatusToggle}>
                  {item.status === "COMPLETED" ? "Reopen Document" : "Mark as Completed"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right notes side panel */}
        {showNotes && (
          <aside className="workspace-notes-sidebar">
            <button className="sidebar-close-btn" onClick={() => setShowNotes(false)}>✕</button>
            <NotePanel readingItemId={id} />
          </aside>
        )}
      </div>

      {/* Floating stats bar */}
      {stats && (
        <div className="workspace-floating-stats">
          <div className="stat-pill duration">⏱️ {stats.timeDisplay}</div>
          <div className="stat-pill yellow" title="Unknown vocabulary">🟡 {stats.yellow}</div>
          <div className="stat-pill green" title="Learned vocabulary">🟢 {stats.green}</div>
          <div className="stat-pill red" title="Important vocabulary">🔴 {stats.red}</div>
          <div className="stat-tip-hint">Double click to look up. Right click highlight to remove.</div>
        </div>
      )}

      {/* Floating dictionary popup */}
      {popupWord && (
        <DictionaryPopup
          word={popupWord}
          charOffset={popupOffset}
          position={popupPos}
          onClose={() => {
            setPopupWord(null);
            setPopupOffset(-1);
          }}
          onHighlightApplied={applyHighlight}
        />
      )}
    </main>
  );
}
