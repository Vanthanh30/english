"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { readingApi, type ReadingItem, type ReadingStatus, type SourceType } from "@/services/reading.service";

export default function ReadingLibrary() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);

  const [items, setItems] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<SourceType | "ALL">("ALL");

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "file">("url");
  const [importUrl, setImportUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionReady && !user) {
      router.replace("/login");
    }
  }, [router, sessionReady, user]);

  const loadLibrary = async () => {
    if (!sessionReady || !user) return;
    setLoading(true);
    try {
      const statusParam = statusFilter === "ALL" ? undefined : statusFilter;
      const typeParam = typeFilter === "ALL" ? undefined : typeFilter;
      const res = await readingApi.list({
        status: statusParam,
        sourceType: typeParam,
        search: search.trim() || undefined,
      });
      setItems(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reading library");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLibrary();
  }, [sessionReady, user, statusFilter, typeFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sessionReady && user) {
        loadLibrary();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleUrlImport = async (e: FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const newItem = await readingApi.importUrl(importUrl);
      setShowImportModal(false);
      setImportUrl("");
      router.push(`/reading/${newItem.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "URL import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const newItem = await readingApi.uploadFile(selectedFile);
      setShowImportModal(false);
      setSelectedFile(null);
      router.push(`/reading/${newItem.id}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "File upload failed");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteItem = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await readingApi.delete(id);
      loadLibrary();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const getSourceBadge = (type: SourceType) => {
    switch (type) {
      case "URL":
        return <span className="badge badge-url">🔗 Web Link</span>;
      case "PDF":
        return <span className="badge badge-pdf">📄 PDF Document</span>;
      case "DOCX":
        return <span className="badge badge-docx">📝 Word Doc</span>;
      case "TXT":
        return <span className="badge badge-txt">🔤 Plain Text</span>;
    }
  };

  const getStatusBadge = (status: ReadingStatus) => {
    switch (status) {
      case "NOT_STARTED":
        return <span className="status-dot status-not-started">New</span>;
      case "READING":
        return <span className="status-dot status-reading">Reading</span>;
      case "COMPLETED":
        return <span className="status-dot status-completed">Completed</span>;
    }
  };

  const getEstimateTime = (wordCount: number) => {
    const min = Math.ceil(wordCount / 200);
    return `${min} min read`;
  };

  if (!sessionReady || !user) {
    return <main className="reading-loading">Accessing reading library...</main>;
  }

  return (
    <main className="reading-library-page">
      <header className="reading-header">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">EQ</span>
          <span>English Quest</span>
        </Link>
        <div className="reading-header-copy">
          <p className="eyebrow">Sprint 7 · Advanced Learning</p>
          <h1>English Reading Workspace</h1>
          <p>Import news, blogs, PDFs, or Word documents. Study vocabulary in context, look up definition instantly and save to flashcards.</p>
        </div>
        <div className="reading-header-actions">
          <Link className="reading-dashboard-link" href="/dashboard">
            Back to dashboard
          </Link>
          <button className="reading-import-btn" onClick={() => setShowImportModal(true)}>
            + Import Material
          </button>
        </div>
      </header>

      <section className="library-controls">
        <div className="library-search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search documents by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="library-filters">
          <div className="filter-group">
            <span className="filter-label">Status</span>
            <div className="filter-buttons">
              <button className={statusFilter === "ALL" ? "active" : ""} onClick={() => setStatusFilter("ALL")}>All</button>
              <button className={statusFilter === "NOT_STARTED" ? "active" : ""} onClick={() => setStatusFilter("NOT_STARTED")}>Not Started</button>
              <button className={statusFilter === "READING" ? "active" : ""} onClick={() => setStatusFilter("READING")}>Reading</button>
              <button className={statusFilter === "COMPLETED" ? "active" : ""} onClick={() => setStatusFilter("COMPLETED")}>Completed</button>
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Source</span>
            <div className="filter-buttons">
              <button className={typeFilter === "ALL" ? "active" : ""} onClick={() => setTypeFilter("ALL")}>All</button>
              <button className={typeFilter === "URL" ? "active" : ""} onClick={() => setTypeFilter("URL")}>Web Link</button>
              <button className={typeFilter === "PDF" ? "active" : ""} onClick={() => setTypeFilter("PDF")}>PDF</button>
              <button className={typeFilter === "DOCX" ? "active" : ""} onClick={() => setTypeFilter("DOCX")}>Word</button>
              <button className={typeFilter === "TXT" ? "active" : ""} onClick={() => setTypeFilter("TXT")}>Text</button>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="library-error-message">{error}</div>}

      <section className="library-items-grid">
        {loading ? (
          <div className="library-grid-status">Loading documents...</div>
        ) : items.length === 0 ? (
          <div className="library-empty-state">
            <div className="empty-icon">📚</div>
            <h2>No reading materials found</h2>
            <p>Paste an article link or upload documents (PDF, DOCX, TXT) to build your immersive reading workspace.</p>
            <button className="reading-import-btn" onClick={() => setShowImportModal(true)}>Import First Document</button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="library-card" onClick={() => router.push(`/reading/${item.id}`)}>
              <div className="card-top">
                {getSourceBadge(item.sourceType)}
                {getStatusBadge(item.status)}
              </div>
              <h3 className="card-title" title={item.title}>
                {item.title}
              </h3>
              <div className="card-meta">
                <span>📊 {item.wordCount} words</span>
                <span>⏱️ {getEstimateTime(item.wordCount)}</span>
              </div>
              {item.bookmarkPosition > 0 && item.status === "READING" && (
                <div className="card-progress">
                  <div className="progress-track">
                    <div className="progress-bar" style={{ width: `${item.bookmarkPosition * 100}%` }}></div>
                  </div>
                  <span className="progress-text">{Math.round(item.bookmarkPosition * 100)}% read</span>
                </div>
              )}
              <div className="card-actions">
                <button
                  className="delete-item-btn"
                  onClick={(e) => handleDeleteItem(item.id, item.title, e)}
                  title="Delete document"
                >
                  🗑️ Delete
                </button>
                <span className="card-action-btn">
                  {item.status === "COMPLETED" ? "Review" : item.bookmarkPosition > 0 ? "Continue" : "Read Now"} →
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-backdrop" onClick={() => !importing && setShowImportModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => !importing && setShowImportModal(false)} disabled={importing}>
              ✕
            </button>
            <h2>Import Reading Material</h2>
            <p className="modal-subtitle">Add text content to start analyzing vocabulary.</p>

            <div className="modal-tabs">
              <button className={importTab === "url" ? "active" : ""} onClick={() => setImportTab("url")} disabled={importing}>
                🔗 Web URL
              </button>
              <button className={importTab === "file" ? "active" : ""} onClick={() => setImportTab("file")} disabled={importing}>
                📁 Upload Document
              </button>
            </div>

            {importError && <div className="modal-error-message">{importError}</div>}

            {importTab === "url" ? (
              <form onSubmit={handleUrlImport} className="modal-form">
                <label className="form-label">
                  Article or Blog Link
                  <input
                    type="url"
                    placeholder="https://news.bbc.co.uk/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    required
                    disabled={importing}
                  />
                </label>
                <div className="form-tip-box">
                  <p className="form-tip">We extract content from news outlets, blogs, Medium, and other public Web URLs. Paywalled URLs are not supported.</p>
                </div>
                <button type="submit" className="modal-submit-btn" disabled={importing || !importUrl}>
                  {importing ? "Extracting Article..." : "Import Web Article"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleFileUpload} className="modal-form">
                <div className="form-label">Select Document File</div>
                
                {selectedFile ? (
                  <div className="file-preview-card">
                    <span className="file-preview-icon">
                      {selectedFile.name.endsWith(".pdf") ? "📄" : selectedFile.name.endsWith(".docx") ? "📝" : "🔤"}
                    </span>
                    <div className="file-preview-details">
                      <div className="file-preview-name">{selectedFile.name}</div>
                      <div className="file-preview-size">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                    <button
                      type="button"
                      className="file-preview-remove"
                      onClick={() => setSelectedFile(null)}
                      disabled={importing}
                      title="Remove file"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="file-upload-dragzone">
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      style={{ display: "none" }}
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      disabled={importing}
                    />
                    <span className="dragzone-icon">📁</span>
                    <span className="dragzone-text">
                      <strong>Click to upload</strong> or drag and drop
                    </span>
                    <span className="dragzone-sub">PDF, DOCX, or TXT up to 20MB</span>
                  </label>
                )}

                <div className="form-tip-box">
                  <p className="form-tip">Supported formats: PDF (.pdf), Word Document (.docx), and Plain Text (.txt) up to 20MB.</p>
                </div>
                <button type="submit" className="modal-submit-btn" disabled={importing || !selectedFile}>
                  {importing ? "Uploading & Parsing..." : "Upload Document"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
