"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { visionApi, type VisionHistory, type VisionWord, type SaveVisionWordInput } from "@/services/vision.service";

export default function VisionWorkspace() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [history, setHistory] = useState<VisionHistory[]>([]);
  const [currentHistory, setCurrentHistory] = useState<VisionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Click point identify state
  const [clickLoadingMarker, setClickLoadingMarker] = useState<{ x: number; y: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Mouse drag selection state
  const [isDrawing, setIsDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

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
      const data = await visionApi.listHistory();
      setHistory(data);
      if (data.length > 0 && !currentHistory) {
        // Auto-select latest item to show by default
        setCurrentHistory(data[0]);
      }
    } catch (err) {
      console.error("Failed to load vision history:", err);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileProcess(e.target.files[0]);
    }
  };

  const handleFileProcess = async (file: File) => {
    if (!file.type.match("image/(jpeg|png|webp)")) {
      setError("Supported file formats are JPEG, PNG, and WEBP only.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Maximum file size is 20MB.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await visionApi.analyzeImage(file);
      setCurrentHistory(result);
      
      // Reload history list so it appears in gallery
      const updatedHistory = await visionApi.listHistory();
      setHistory(updatedHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentHistory || analyzing || clickLoadingMarker) return;
    if (e.button !== 0) return; // Only handle left click

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setDragStart({ x, y });
    setDragCurrent({ x, y });
    setError(null);
    setSuccessMessage(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !dragStart) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    setDragCurrent({ x, y });
  };

  const handleMouseUp = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentHistory || !isDrawing || !dragStart || !dragCurrent) return;
    setIsDrawing(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Calculate dimensions in pixels
    const pixelWidth = Math.abs(dragCurrent.x - dragStart.x);
    const pixelHeight = Math.abs(dragCurrent.y - dragStart.y);

    // Sort coordinates to get min/max
    const minX = Math.min(dragStart.x, dragCurrent.x);
    const maxX = Math.max(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const maxY = Math.max(dragStart.y, dragCurrent.y);

    const startX = dragStart.x;
    const startY = dragStart.y;

    setDragStart(null);
    setDragCurrent(null);

    if (w === 0 || h === 0) return;

    // If drag is very small (less than 8 pixels in both width and height), treat as simple click
    if (pixelWidth < 8 && pixelHeight < 8) {
      // Calculate single point coordinate percentages
      const xPct = Math.round((startX / w) * 100);
      const yPct = Math.round((startY / h) * 100);
      
      setClickLoadingMarker({ x: xPct, y: yPct });
      try {
        const newWord = await visionApi.analyzeClick(currentHistory.id, xPct, yPct);
        appendNewWord(newWord);
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI failed to identify object");
      } finally {
        setClickLoadingMarker(null);
      }
    } else {
      // Bounding box selection
      const xMin = Math.round((minX / w) * 100);
      const xMax = Math.round((maxX / w) * 100);
      const yMin = Math.round((minY / h) * 100);
      const yMax = Math.round((maxY / h) * 100);

      // Center point for the loading indicator badge
      const centerPctX = Math.round((xMin + xMax) / 2);
      const centerPctY = Math.round((yMin + yMax) / 2);

      setClickLoadingMarker({ x: centerPctX, y: centerPctY });
      try {
        const newWord = await visionApi.analyzeClick(
          currentHistory.id,
          undefined,
          undefined,
          xMin,
          yMin,
          xMax,
          yMax
        );
        appendNewWord(newWord);
      } catch (err) {
        setError(err instanceof Error ? err.message : "AI failed to identify object in selection box");
      } finally {
        setClickLoadingMarker(null);
      }
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawing) {
      handleMouseUp(e);
    }
  };

  const appendNewWord = (newWord: VisionWord) => {
    if (!currentHistory) return;
    const updatedWords = [...currentHistory.words, newWord];
    const updatedHistoryItem = {
      ...currentHistory,
      words: updatedWords,
    };
    setCurrentHistory(updatedHistoryItem);

    // Update in history list
    setHistory(prevHistory => prevHistory.map(h => 
      h.id === currentHistory.id ? updatedHistoryItem : h
    ));

    setSuccessMessage(`Successfully identified new object: "${newWord.word}"!`);
  };

  const getSelectionBoxStyle = () => {
    if (!dragStart || !dragCurrent) return {};
    const left = Math.min(dragStart.x, dragCurrent.x);
    const top = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      position: 'absolute' as const,
      border: '2px dashed var(--lime)',
      background: 'rgba(216, 238, 141, 0.18)',
      boxShadow: '0 0 8px rgba(216, 238, 141, 0.5)',
      borderRadius: '4px',
      pointerEvents: 'none' as const,
      zIndex: 8,
    };
  };

  const speakWord = (word: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveSingleWord = async (wordItem: VisionWord) => {
    setError(null);
    setSuccessMessage(null);

    const payload: SaveVisionWordInput = {
      wordId: wordItem.id,
      word: wordItem.word,
      meaning: wordItem.meaning,
      meaningVi: wordItem.meaningVi || "",
      pronunciation: wordItem.pronunciation || "",
      partOfSpeech: wordItem.partOfSpeech || "noun",
      exampleSentence: wordItem.exampleSentence || "",
    };

    try {
      const res = await visionApi.saveWords([payload]);
      if (res.success) {
        setSuccessMessage(`Successfully saved "${wordItem.word}" to Flashcards!`);
        
        // Update local state of currentHistory words
        if (currentHistory) {
          const updatedWords = currentHistory.words.map((w) =>
            w.id === wordItem.id ? { ...w, saved: true } : w
          );
          
          const updatedHistoryItem = {
            ...currentHistory,
            words: updatedWords,
          };
          setCurrentHistory(updatedHistoryItem);

          // Update in history list
          setHistory(prevHistory => prevHistory.map(h => 
            h.id === currentHistory.id ? updatedHistoryItem : h
          ));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save word");
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this vision scan history?")) return;
    
    try {
      await visionApi.deleteHistory(id);
      const updatedHistory = history.filter((h) => h.id !== id);
      setHistory(updatedHistory);
      
      if (currentHistory?.id === id) {
        setCurrentHistory(updatedHistory.length > 0 ? updatedHistory[0] : null);
      }
    } catch (err) {
      alert("Failed to delete history record");
    }
  };

  const handleSelectHistoryItem = (item: VisionHistory) => {
    setCurrentHistory(item);
    setError(null);
    setSuccessMessage(null);
    setClickLoadingMarker(null);
  };

  if (!sessionReady || !user) {
    return <main className="vision-loading">Accessing Vision AI Workspace...</main>;
  }

  return (
    <main className="eq-vision-page">
      {/* Dynamic CSS Rules for scoping */}
      <style dangerouslySetInnerHTML={{ __html: `
        .eq-vision-page {
          width: min(1200px, calc(100% - 48px));
          margin: 40px auto;
          font-family: var(--font-geist-sans), Arial, sans-serif;
          color: var(--ink);
        }

        .eq-vision-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 24px;
          margin-bottom: 40px;
          border-bottom: 1px solid var(--line);
          padding-bottom: 24px;
        }

        .eq-vision-header-copy h1 {
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 850;
          letter-spacing: -0.04em;
          margin: 6px 0 12px;
        }

        .eq-vision-header-copy p {
          color: var(--muted);
          max-width: 680px;
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
        }

        .eq-vision-dashboard-link {
          font-size: 14px;
          font-weight: 650;
          color: var(--green);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--line);
          background: var(--paper);
          transition: all 0.2s ease;
        }

        .eq-vision-dashboard-link:hover {
          background: var(--line);
          transform: translateY(-1px);
        }

        .eq-vision-workspace-grid {
          display: grid;
          grid-template-columns: 1.15fr 1.85fr;
          gap: 32px;
          margin-bottom: 48px;
        }

        @media (max-width: 950px) {
          .eq-vision-workspace-grid {
            grid-template-columns: 1fr;
          }
        }

        /* Left Side: Upload & Image */
        .eq-vision-image-card-pane {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .eq-vision-image-preview-container {
          position: relative;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 16px;
          aspect-ratio: 4/3;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(20, 37, 29, 0.02);
        }

        .eq-vision-image-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .eq-vision-dropzone-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
          width: 100%;
          height: 100%;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .eq-vision-dropzone-overlay.drag-active {
          background: rgba(216, 238, 141, 0.2);
          border: 2px dashed var(--green);
        }

        .eq-vision-dropzone-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        .eq-vision-dropzone-text {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .eq-vision-dropzone-sub {
          font-size: 13px;
          color: var(--muted);
        }

        /* Markers on image */
        .eq-vision-marker {
          position: absolute;
          width: 32px;
          height: 32px;
          background: var(--green);
          color: var(--lime);
          border: 2px solid var(--lime);
          border-radius: 50%;
          font-size: 14px;
          font-weight: 850;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.4), 0 0 5px var(--lime);
          cursor: pointer;
          transition: all 0.2s ease;
          animation: eq-vision-marker-pulse 2s infinite ease-in-out;
          z-index: 5;
        }

        .eq-vision-marker:hover {
          transform: translate(-50%, -50%) scale(1.15);
          background: var(--lime);
          color: var(--ink);
          border-color: var(--green);
          box-shadow: 0 0 15px var(--lime);
        }

        @keyframes eq-vision-marker-pulse {
          0% { box-shadow: 0 0 0 0 rgba(216, 238, 141, 0.7), 0 0 5px var(--lime); }
          70% { box-shadow: 0 0 0 10px rgba(216, 238, 141, 0), 0 0 5px var(--lime); }
          100% { box-shadow: 0 0 0 0 rgba(216, 238, 141, 0), 0 0 5px var(--lime); }
        }

        /* Ripple Loading Click marker */
        .eq-vision-marker-loading {
          position: absolute;
          width: 32px;
          height: 32px;
          background: var(--lime);
          color: var(--green-dark);
          border-radius: 50%;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px var(--lime);
          z-index: 6;
        }

        .eq-vision-marker-loading-ripple {
          position: absolute;
          inset: -6px;
          border: 2px solid var(--lime);
          border-radius: 50%;
          animation: eq-vision-marker-ripple-anim 1s infinite ease-out;
        }

        @keyframes eq-vision-marker-ripple-anim {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        /* Scanning laser animation */
        .eq-vision-scanning-overlay {
          position: absolute;
          inset: 0;
          background: rgba(20, 37, 29, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          z-index: 10;
        }

        .eq-vision-scanning-laser {
          position: absolute;
          width: 100%;
          height: 3px;
          background: linear-gradient(to bottom, rgba(216, 238, 141, 0), var(--lime), rgba(216, 238, 141, 0));
          box-shadow: 0 0 15px var(--lime), 0 0 8px var(--lime);
          top: 0;
          animation: eq-vision-scanning-move 2.5s infinite linear;
        }

        @keyframes eq-vision-scanning-move {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }

        .eq-vision-scanning-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255,255,255,0.1);
          border-top-color: var(--lime);
          border-radius: 50%;
          animation: eq-vision-spin 1s infinite linear;
          margin-bottom: 16px;
        }

        @keyframes eq-vision-spin {
          100% { transform: rotate(360deg); }
        }

        /* Right Side: Suggestions */
        .eq-vision-editor-pane {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 4px 20px rgba(20, 37, 29, 0.02);
        }

        .eq-vision-pane-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--line);
          padding-bottom: 16px;
        }

        .eq-vision-pane-title {
          font-size: 18px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
        }

        .eq-vision-word-cards-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-height: 600px;
          overflow-y: auto;
          padding-right: 6px;
        }

        /* Read-only Vocabulary Card Redesign */
        .eq-vision-word-card {
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          background: #fff;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(20, 37, 29, 0.01);
        }

        .eq-vision-word-card.saved {
          border-color: rgba(20, 37, 29, 0.08);
          background: rgba(20, 37, 29, 0.005);
        }

        .eq-vision-card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed var(--line);
          padding-bottom: 8px;
        }

        .eq-vision-card-badge-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .eq-vision-card-number {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--ink);
          color: var(--lime);
          font-size: 12px;
          font-weight: 850;
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        .eq-vision-card-word-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--green);
        }

        .eq-vision-card-pos-badge {
          background: rgba(216, 238, 141, 0.5);
          color: var(--green-dark);
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: lowercase;
        }

        .eq-vision-card-ipa {
          font-size: 13.5px;
          font-style: italic;
          color: var(--muted);
        }

        .eq-vision-card-meaning-label {
          font-size: 11px;
          font-weight: 750;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 2px;
        }

        .eq-vision-card-meaning-eng {
          font-size: 14.5px;
          color: var(--ink);
          line-height: 1.5;
          margin: 0 0 8px 0;
        }

        .eq-vision-card-meaning-vi-box {
          background: rgba(20, 37, 29, 0.025);
          border-left: 3px solid var(--green);
          padding: 8px 12px;
          font-size: 14px;
          font-weight: 700;
          color: var(--green-dark);
          border-radius: 0 8px 8px 0;
          margin-bottom: 8px;
        }

        .eq-vision-card-example {
          font-size: 13.5px;
          color: var(--muted);
          line-height: 1.5;
          border-top: 1px dashed var(--line);
          padding-top: 10px;
          margin-top: 4px;
        }

        .eq-vision-card-example-quote {
          font-style: italic;
          color: var(--ink);
        }

        /* Direct Action Buttons */
        .eq-vision-card-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          border-top: 1px solid var(--line);
          padding-top: 12px;
        }

        .eq-vision-card-btn {
          border: 1px solid var(--line);
          background: #fff;
          color: var(--ink);
          border-radius: 8px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
          outline: none;
        }

        .eq-vision-card-btn:hover {
          background: var(--lime);
          border-color: var(--green);
          transform: translateY(-1px);
        }

        .eq-vision-card-btn.save-btn {
          background: var(--green);
          color: #fff;
          border-color: var(--green);
        }

        .eq-vision-card-btn.save-btn:hover {
          background: var(--green-dark);
          border-color: var(--green-dark);
        }

        .eq-vision-card-btn.saved-status {
          background: rgba(47, 109, 79, 0.08);
          color: var(--green);
          border-color: transparent;
          cursor: default;
          transform: none;
        }

        .eq-vision-card-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .eq-vision-trash-btn {
          border: 1px solid var(--line);
          background: #fff;
          border-radius: 8px;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--muted);
          transition: all 0.2s ease;
        }

        .eq-vision-trash-btn:hover {
          color: #c93b3b;
          border-color: #c93b3b;
          background: #fff6f6;
        }

        /* Success and Error Banners */
        .eq-vision-banner {
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.5;
        }

        .eq-vision-banner-error {
          background: #fff2f2;
          color: #c93b3b;
          border: 1px solid rgba(201, 59, 59, 0.15);
        }

        .eq-vision-banner-success {
          background: #f2faf5;
          color: var(--green);
          border: 1px solid rgba(47, 109, 79, 0.15);
        }

        /* History Gallery */
        .eq-vision-history-section {
          border-top: 1px solid var(--line);
          padding-top: 40px;
          margin-top: 16px;
        }

        .eq-vision-history-section h2 {
          font-size: 22px;
          font-weight: 800;
          margin: 0 0 20px;
          letter-spacing: -0.03em;
        }

        .eq-vision-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 20px;
        }

        .eq-vision-gallery-card {
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          box-shadow: 0 4px 15px rgba(20, 37, 29, 0.01);
        }

        .eq-vision-gallery-card:hover {
          transform: translateY(-3px);
          border-color: var(--green);
          box-shadow: 0 8px 24px rgba(20, 37, 29, 0.05);
        }

        .eq-vision-gallery-card.active {
          border-color: var(--green);
          box-shadow: 0 0 0 2px var(--green);
        }

        .eq-vision-gallery-img-container {
          aspect-ratio: 4/3;
          overflow: hidden;
          background: var(--cream);
          position: relative;
        }

        .eq-vision-gallery-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .eq-vision-gallery-delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid var(--line);
          border-radius: 6px;
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: var(--muted);
          font-size: 11px;
          z-index: 5;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .eq-vision-gallery-card:hover .eq-vision-gallery-delete-btn {
          opacity: 1;
        }

        .eq-vision-gallery-delete-btn:hover {
          color: #c93b3b;
          background: #fff;
          border-color: #c93b3b;
        }

        .eq-vision-gallery-info {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .eq-vision-gallery-date {
          font-size: 11px;
          color: var(--muted);
          font-weight: 550;
        }

        .eq-vision-gallery-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
        }

        .eq-vision-gallery-meta-saved {
          color: var(--green);
        }

        .eq-vision-gallery-empty {
          text-align: center;
          padding: 48px;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 12px;
          color: var(--muted);
        }
      `}} />

      {/* Header section */}
      <header className="eq-vision-header">
        <div className="eq-vision-header-copy">
          <h1>Vision AI Learning</h1>
        </div>
        <Link className="eq-vision-dashboard-link" href="/dashboard">
          &larr; Dashboard
        </Link>
      </header>

      {/* Error Banner alert */}
      {error && (
        <div className="eq-vision-banner eq-vision-banner-error" style={{ marginBottom: "24px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="eq-vision-workspace-grid">
        
        {/* Left Side: Upload Zone / Current Image Display */}
        <div className="eq-vision-image-card-pane">
          <div className="eq-vision-image-preview-container">
            {/* Uploading scanner state */}
            {analyzing && (
              <div className="eq-vision-scanning-overlay">
                <div className="eq-vision-scanning-laser"></div>
                <div className="eq-vision-scanning-spinner"></div>
                <p style={{ fontWeight: 700, fontSize: "16px", margin: 0 }}>AI Analyzing Image...</p>
                <p style={{ fontSize: "12px", opacity: 0.8, margin: "4px 0 0" }}>Identifying objects and translating definitions</p>
              </div>
            )}

            {currentHistory ? (
              <div
                className="eq-vision-image-interactive-wrapper"
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  userSelect: "none",
                  cursor: analyzing || clickLoadingMarker ? "not-allowed" : "crosshair",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
              >
                <img
                  className="eq-vision-image-preview"
                  src={currentHistory.imageUrl}
                  alt="Uploaded Workspace Source"
                  draggable={false}
                  style={{ pointerEvents: "none", width: "100%", height: "100%", objectFit: "cover" }}
                />
                
                {/* Object Localisation Markers */}
                {!analyzing && currentHistory.words && currentHistory.words.map((wordItem, index) => {
                  if (wordItem.x === null || wordItem.y === null) return null;
                  return (
                    <div
                      key={`marker-${wordItem.id}`}
                      className="eq-vision-marker"
                      style={{
                        left: `${wordItem.x}%`,
                        top: `${wordItem.y}%`,
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "none",
                      }}
                      title={`${index + 1}. ${wordItem.word}`}
                    >
                      {index + 1}
                    </div>
                  );
                })}

                {/* Click Point Loading Marker */}
                {clickLoadingMarker && (
                  <div
                    className="eq-vision-marker-loading"
                    style={{
                      left: `${clickLoadingMarker.x}%`,
                      top: `${clickLoadingMarker.y}%`,
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <div className="eq-vision-marker-loading-ripple"></div>
                    🔍
                  </div>
                )}

                {/* Selection drawing box */}
                {isDrawing && dragStart && dragCurrent && (
                  <div
                    className="eq-vision-selection-box"
                    style={getSelectionBoxStyle()}
                  />
                )}
              </div>
            ) : (
              <div
                className={`eq-vision-dropzone-overlay ${dragActive ? "drag-active" : ""}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="eq-vision-dropzone-icon">📷</span>
                <span className="eq-vision-dropzone-text">Click or drag image here</span>
                <span className="eq-vision-dropzone-sub">Supports JPG, PNG, WEBP (Max 20MB)</span>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
          />

          {currentHistory && (
            <button
              className="button"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "var(--paper)",
                border: "1px solid var(--line)",
                color: "var(--ink)",
                cursor: "pointer",
                borderRadius: "12px",
                width: "100%",
                fontWeight: 700,
                fontSize: "14px"
              }}
            >
              📷 Upload Another Image
            </button>
          )}
        </div>

        {/* Right Side: Suggestions List Editor */}
        <div className="eq-vision-editor-pane">
          <div className="eq-vision-pane-header">
            <h3 className="eq-vision-pane-title">
              {currentHistory ? `Detected Keywords (${currentHistory.words.length})` : "Keyword Suggestions"}
            </h3>
          </div>

          {!currentHistory ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--muted)" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 4px" }}>No analyzed image loaded</p>
              <p style={{ fontSize: "13px", margin: 0 }}>Upload an image on the left or choose a card from your history gallery below.</p>
            </div>
          ) : currentHistory.words.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--muted)" }}>
              <p style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>No objects detected</p>
              <p style={{ fontSize: "13px", margin: "4px 0 0" }}>Try clicking on the image above to identify specific objects.</p>
            </div>
          ) : (
            <div className="eq-vision-word-cards-list">
              {currentHistory.words.map((wordItem, index) => {
                const isSaved = wordItem.saved;

                return (
                  <div
                    key={wordItem.id}
                    className={`eq-vision-word-card ${isSaved ? "saved" : ""}`}
                  >
                    {/* Card Header */}
                    <div className="eq-vision-card-header-row">
                      <div className="eq-vision-card-badge-container">
                        <span className="eq-vision-card-number">#{index + 1}</span>
                        <span className="eq-vision-card-word-title">{wordItem.word}</span>
                        {wordItem.partOfSpeech && (
                          <span className="eq-vision-card-pos-badge">{wordItem.partOfSpeech}</span>
                        )}
                        {wordItem.pronunciation && (
                          <span className="eq-vision-card-ipa">{wordItem.pronunciation}</span>
                        )}
                      </div>
                      
                      {/* Delete suggestion card */}
                      <div className="eq-vision-card-actions-wrapper">
                        <button
                          className="eq-vision-trash-btn"
                          type="button"
                          title="Discard suggestion"
                          onClick={() => {
                            setCurrentHistory({
                              ...currentHistory,
                              words: currentHistory.words.filter(w => w.id !== wordItem.id)
                            });
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Word Meanings */}
                    <div className="eq-vision-card-meaning-label">Meaning</div>
                    <p className="eq-vision-card-meaning-eng">{wordItem.meaning}</p>
                    
                    {wordItem.meaningVi && (
                      <div className="eq-vision-card-meaning-vi-box">
                        {wordItem.meaningVi}
                      </div>
                    )}

                    {/* Example sentence */}
                    {wordItem.exampleSentence && (
                      <div className="eq-vision-card-example">
                        <div className="eq-vision-card-meaning-label">Example</div>
                        <div className="eq-vision-card-example-quote">
                          "{wordItem.exampleSentence}"
                        </div>
                      </div>
                    )}

                    {/* Direct read & save actions */}
                    <div className="eq-vision-card-actions">
                      <button
                        className="eq-vision-card-btn"
                        type="button"
                        onClick={() => speakWord(wordItem.word)}
                      >
                        🔊 Pronounce
                      </button>

                      {isSaved ? (
                        <span className="eq-vision-card-btn saved-status">
                          ✓ Saved to Flashcard
                        </span>
                      ) : (
                        <button
                          className="eq-vision-card-btn save-btn"
                          type="button"
                          onClick={() => handleSaveSingleWord(wordItem)}
                        >
                          🔖 Save to Flashcard
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Upload & Analysis History Gallery */}
      <section className="eq-vision-history-section">
        <h2>Your Scans History</h2>
        {loading ? (
          <div style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "14px" }}>Loading past scans...</div>
        ) : history.length === 0 ? (
          <div className="eq-vision-gallery-empty">
            <p style={{ margin: 0, fontWeight: 700 }}>Your history list is empty</p>
            <p style={{ margin: "4px 0 0", fontSize: "13px" }}>Upload an image above to record your first visual learning quest!</p>
          </div>
        ) : (
          <div className="eq-vision-gallery-grid">
            {history.map((histItem) => {
              const totalWords = histItem.words?.length || 0;
              const savedWords = histItem.words?.filter((w) => w.saved).length || 0;
              const formattedDate = new Date(histItem.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric"
              });

              return (
                <div
                  key={histItem.id}
                  className={`eq-vision-gallery-card ${currentHistory?.id === histItem.id ? "active" : ""}`}
                  onClick={() => handleSelectHistoryItem(histItem)}
                >
                  {/* Delete button card */}
                  <button
                    className="eq-vision-gallery-delete-btn"
                    type="button"
                    title="Delete record"
                    onClick={(e) => handleDeleteHistoryItem(histItem.id, e)}
                  >
                    ✕
                  </button>

                  <div className="eq-vision-gallery-img-container">
                    <img
                      className="eq-vision-gallery-img"
                      src={histItem.imageUrl}
                      alt="History Scan Thumbnail"
                    />
                  </div>

                  <div className="eq-vision-gallery-info">
                    <span className="eq-vision-gallery-date">{formattedDate}</span>
                    <div className="eq-vision-gallery-meta">
                      <span>🏷️ {totalWords} words</span>
                      {savedWords > 0 && (
                        <span className="eq-vision-gallery-meta-saved">✓ {savedWords} saved</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
