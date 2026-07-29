"use client";

import Link from "next/link";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  adminApi,
  type ContentLevel,
  type Lesson,
  type LessonStatus,
  type PageResult,
  type Topic,
  type Vocabulary,
} from "@/services/admin.service";
import { useAuthStore } from "@/stores/auth.store";

type Tab = "topics" | "vocabulary" | "lessons";
type RunAction = (
  action: () => Promise<void>,
  message: string,
) => Promise<boolean>;

const levels: ContentLevel[] = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const PAGE_SIZE = 8;
const tabLabels: Record<Tab, { label: string; description: string }> = {
  topics: {
    label: "Topics",
    description: "Organize learning content into clear subject areas.",
  },
  vocabulary: {
    label: "Vocabulary",
    description: "Build the word bank learners practice in each lesson.",
  },
  lessons: {
    label: "Lessons",
    description: "Assemble vocabulary into structured learning sessions.",
  },
};

const emptyPage = <T,>(): PageResult<T> => ({
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 0,
});

export default function ContentManagementPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const sessionReady = useAuthStore((state) => state.sessionReady);
  const [tab, setTab] = useState<Tab>("topics");
  const [topicOptions, setTopicOptions] = useState<Topic[]>([]);
  const [vocabularyOptions, setVocabularyOptions] = useState<Vocabulary[]>([]);
  const [topicPage, setTopicPage] = useState(emptyPage<Topic>());
  const [vocabularyPage, setVocabularyPage] =
    useState(emptyPage<Vocabulary>());
  const [lessonPage, setLessonPage] = useState(emptyPage<Lesson>());
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [topicFilter, setTopicFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const loadReferences = useCallback(async () => {
    const [topics, vocabularies] = await Promise.all([
      adminApi.topics.list({ page: 1, limit: 100 }),
      adminApi.vocabularies.list({ page: 1, limit: 100 }),
    ]);
    setTopicOptions(topics.items);
    setVocabularyOptions(vocabularies.items);
  }, []);

  const loadActivePage = useCallback(async () => {
    setListLoading(true);
    try {
      if (tab === "topics") {
        const result = await adminApi.topics.list({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          level: (levelFilter || undefined) as ContentLevel | undefined,
          isActive:
            activeFilter === "" ? undefined : activeFilter === "active",
        });
        setTopicPage(result);
        if (result.totalPages && page > result.totalPages) {
          setPage(result.totalPages);
        }
      } else if (tab === "vocabulary") {
        const result = await adminApi.vocabularies.list({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          topicId: topicFilter || undefined,
        });
        setVocabularyPage(result);
        if (result.totalPages && page > result.totalPages) {
          setPage(result.totalPages);
        }
      } else {
        const result = await adminApi.lessons.list({
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch.trim() || undefined,
          topicId: topicFilter || undefined,
          status: (statusFilter || undefined) as LessonStatus | undefined,
        });
        setLessonPage(result);
        if (result.totalPages && page > result.totalPages) {
          setPage(result.totalPages);
        }
      }
    } finally {
      setListLoading(false);
    }
  }, [
    activeFilter,
    debouncedSearch,
    levelFilter,
    page,
    statusFilter,
    tab,
    topicFilter,
  ]);

  useEffect(() => {
    async function initialize() {
      if (!sessionReady) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      if (user.role !== "ADMIN") {
        router.replace("/dashboard");
        return;
      }

      try {
        await loadReferences();
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Unable to load content",
        );
      } finally {
        setLoading(false);
      }
    }

    void initialize();
  }, [loadReferences, router, sessionReady, user]);

  useEffect(() => {
    async function load() {
      if (!sessionReady || user?.role !== "ADMIN") return;
      try {
        await loadActivePage();
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Unable to load content",
        );
      }
    }

    void load();
  }, [loadActivePage, revision, sessionReady, user?.role]);

  const run: RunAction = async (action, message) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await action();
      await loadReferences();
      setRevision((value) => value + 1);
      setSuccess(message);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action failed");
      return false;
    } finally {
      setSaving(false);
    }
  };

  function changeTab(nextTab: Tab) {
    setTab(nextTab);
    setPage(1);
    setSearch("");
    setTopicFilter("");
    setLevelFilter("");
    setActiveFilter("");
    setStatusFilter("");
    setError(null);
    setSuccess(null);
  }

  const activePage =
    tab === "topics"
      ? topicPage
      : tab === "vocabulary"
        ? vocabularyPage
        : lessonPage;

  if (loading) {
    return (
      <main className="admin-loading">
        <span className="admin-loading-mark">EQ</span>
        <p>Preparing your content workspace...</p>
      </main>
    );
  }

  return (
    <main className="admin-app">
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
            <AdminIcon name="dashboard" />
            Dashboard
          </Link>
          <span className="active">
            <AdminIcon name="library" />
            Content library
          </span>
          <Link href="/admin/listening">
            <AdminIcon name="collection" />
            Dictation CMS
          </Link>
        </nav>

        <div className="admin-sidebar-card">
          <span className="admin-sidebar-card-icon">
            <AdminIcon name="spark" />
          </span>
          <strong>Sprint 2 workspace</strong>
          <p>Manage the content learners see across topics and lessons.</p>
        </div>

        <div className="admin-user">
          <span>{user?.displayName?.slice(0, 1).toUpperCase() || "A"}</span>
          <div>
            <strong>{user?.displayName || "Administrator"}</strong>
            <small>{user?.email}</small>
          </div>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-breadcrumb">Admin / Content library</p>
            <h1>Content library</h1>
            <p>Shape the learning journey from one organized workspace.</p>
          </div>
          <Link className="admin-back-link" href="/dashboard">
            <AdminIcon name="arrow" />
            Back to dashboard
          </Link>
        </header>

        <nav className="admin-tabs" aria-label="Content sections">
          {(["topics", "vocabulary", "lessons"] as Tab[]).map((item) => (
            <button
              className={tab === item ? "active" : ""}
              key={item}
              type="button"
              onClick={() => changeTab(item)}
            >
              <AdminIcon
                name={
                  item === "topics"
                    ? "folder"
                    : item === "vocabulary"
                      ? "book"
                      : "lesson"
                }
              />
              <span>
                <strong>{tabLabels[item].label}</strong>
                <small>{tabLabels[item].description}</small>
              </span>
            </button>
          ))}
        </nav>

        <section className="admin-summary" aria-label="Content summary">
          <article>
            <span className="admin-summary-icon green">
              <AdminIcon name="collection" />
            </span>
            <div>
              <small>Total {tabLabels[tab].label.toLowerCase()}</small>
              <strong>{listLoading ? "—" : activePage.total}</strong>
            </div>
          </article>
          <article>
            <span className="admin-summary-icon lime">
              <AdminIcon name="folder" />
            </span>
            <div>
              <small>Available topics</small>
              <strong>{topicOptions.length}</strong>
            </div>
          </article>
          <article>
            <span className="admin-summary-icon amber">
              <AdminIcon name="book" />
            </span>
            <div>
              <small>Vocabulary bank</small>
              <strong>{vocabularyOptions.length}</strong>
            </div>
          </article>
        </section>

        {error && <p className="form-message form-error">{error}</p>}
        {success && <p className="form-message form-success">{success}</p>}

        <AdminToolbar
          tab={tab}
          search={search}
          setSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          topics={topicOptions}
          topicFilter={topicFilter}
          setTopicFilter={(value) => {
            setTopicFilter(value);
            setPage(1);
          }}
          levelFilter={levelFilter}
          setLevelFilter={(value) => {
            setLevelFilter(value);
            setPage(1);
          }}
          activeFilter={activeFilter}
          setActiveFilter={(value) => {
            setActiveFilter(value);
            setPage(1);
          }}
          statusFilter={statusFilter}
          setStatusFilter={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          total={activePage.total}
          loading={listLoading}
        />

        {tab === "topics" && (
          <TopicWorkspace
            topics={topicPage.items}
            run={run}
            saving={saving}
            loading={listLoading}
          />
        )}
        {tab === "vocabulary" && (
          <VocabularyWorkspace
            topics={topicOptions}
            vocabularies={vocabularyPage.items}
            run={run}
            saving={saving}
            loading={listLoading}
          />
        )}
        {tab === "lessons" && (
          <LessonWorkspace
            topics={topicOptions}
            vocabularies={vocabularyOptions}
            lessons={lessonPage.items}
            run={run}
            saving={saving}
            loading={listLoading}
          />
        )}

        <Pagination
          page={activePage.page}
          totalPages={activePage.totalPages}
          total={activePage.total}
          limit={activePage.limit}
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}

function AdminToolbar({
  tab,
  search,
  setSearch,
  topics,
  topicFilter,
  setTopicFilter,
  levelFilter,
  setLevelFilter,
  activeFilter,
  setActiveFilter,
  statusFilter,
  setStatusFilter,
  total,
  loading,
}: Readonly<{
  tab: Tab;
  search: string;
  setSearch: (value: string) => void;
  topics: Topic[];
  topicFilter: string;
  setTopicFilter: (value: string) => void;
  levelFilter: string;
  setLevelFilter: (value: string) => void;
  activeFilter: string;
  setActiveFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  total: number;
  loading: boolean;
}>) {
  return (
    <section className="admin-toolbar">
      <div className="admin-search">
        <AdminIcon name="search" />
        <label className="sr-only" htmlFor="content-search">
          Search
        </label>
        <input
          id="content-search"
          value={search}
          placeholder={
            tab === "topics"
              ? "Search topic name or description"
              : tab === "vocabulary"
                ? "Search word or meaning"
                : "Search lesson title or description"
          }
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="admin-filters">
        {tab !== "topics" && (
          <label>
            <span>Topic</span>
            <select
              value={topicFilter}
              onChange={(event) => setTopicFilter(event.target.value)}
            >
              <option value="">All topics</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {tab === "topics" && (
          <>
            <label>
              <span>Level</span>
              <select
                value={levelFilter}
                onChange={(event) => setLevelFilter(event.target.value)}
              >
                <option value="">All levels</option>
                {levels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Visibility</span>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
              >
                <option value="">All states</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </>
        )}
        {tab === "lessons" && (
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </label>
        )}
      </div>

      <div className="admin-result-count" aria-live="polite">
        <strong>{loading ? "..." : total}</strong>
        <span>results</span>
      </div>
    </section>
  );
}

function TopicWorkspace({
  topics,
  run,
  saving,
  loading,
}: Readonly<{
  topics: Topic[];
  run: RunAction;
  saving: boolean;
  loading: boolean;
}>) {
  const [editing, setEditing] = useState<Topic | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await run(async () => {
      let imageUrl = editing?.imageUrl ?? null;
      let imagePublicId = editing?.imagePublicId ?? null;
      const file = form.get("image");
      if (file instanceof File && file.size) {
        const upload = await adminApi.uploadImage(file);
        imageUrl = upload.url;
        imagePublicId = upload.publicId;
      }
      const data = {
        name: String(form.get("name")),
        slug: editing?.slug ?? "",
        description: String(form.get("description")),
        level: String(form.get("level")) as ContentLevel,
        imageUrl,
        imagePublicId,
        order: Number(form.get("order")),
        isActive: form.get("isActive") === "on",
      };
      if (editing) await adminApi.topics.update(editing.id, data);
      else await adminApi.topics.create(data);
    }, editing ? "Topic updated successfully." : "Topic created successfully.");
    if (saved) {
      setEditing(null);
      formElement.reset();
    }
  }

  return (
    <section className="admin-grid">
      <form
        className="admin-form"
        key={editing?.id ?? "new-topic"}
        onSubmit={submit}
      >
        <FormHeading
          editing={Boolean(editing)}
          title={editing ? "Edit topic" : "Create a topic"}
          description="Define a subject area for lessons and vocabulary."
        />
        <AdminField label="Topic name" hint="Displayed in the learner catalog.">
          <input
            name="name"
            placeholder="e.g. Travel Essentials"
            defaultValue={editing?.name}
            required
          />
        </AdminField>
        <AdminField label="Description" hint="Explain what learners will study.">
          <textarea
            name="description"
            placeholder="Topic description"
            defaultValue={editing?.description}
            minLength={10}
            required
          />
        </AdminField>
        <AdminField label="Level">
          <select name="level" defaultValue={editing?.level ?? "BEGINNER"}>
            {levels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Display order" hint="Lower numbers appear first.">
          <input
            name="order"
            type="number"
            min="0"
            defaultValue={editing?.order ?? 0}
          />
        </AdminField>
        <AdminField label="Cover image" hint="JPEG, PNG or WebP, maximum 5 MB.">
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </AdminField>
        <label className="check-label">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={editing?.isActive ?? true}
          />
          Active and visible to learners
        </label>
        <SubmitButton saving={saving}>
          {editing ? "Save topic" : "Create topic"}
        </SubmitButton>
        {editing && (
          <button
            className="text-button"
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancel edit
          </button>
        )}
      </form>

      <AdminList loading={loading} emptyMessage="No topics match the filters.">
        {topics.map((topic) => (
          <article className="admin-row" key={topic.id}>
            <div className="admin-row-main">
              <div className="admin-row-title">
                <strong>{topic.name}</strong>
                <StatusBadge tone={topic.isActive ? "success" : "muted"}>
                  {topic.isActive ? "Active" : "Inactive"}
                </StatusBadge>
              </div>
              <p>
                {topic.level} · {topic._count?.vocabularies ?? 0} words ·{" "}
                {topic._count?.lessons ?? 0} lessons
              </p>
              <small>{topic.description}</small>
            </div>
            <RowActions
              saving={saving}
              onEdit={() => setEditing(topic)}
              onDelete={() =>
                run(
                  () => adminApi.topics.delete(topic.id),
                  "Topic deleted successfully.",
                )
              }
            />
          </article>
        ))}
      </AdminList>
    </section>
  );
}

function VocabularyWorkspace({
  topics,
  vocabularies,
  run,
  saving,
  loading,
}: Readonly<{
  topics: Topic[];
  vocabularies: Vocabulary[];
  run: RunAction;
  saving: boolean;
  loading: boolean;
}>) {
  const [editing, setEditing] = useState<Vocabulary | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await run(async () => {
      let imageUrl = editing?.imageUrl ?? null;
      let imagePublicId = editing?.imagePublicId ?? null;
      const file = form.get("image");
      if (file instanceof File && file.size) {
        const upload = await adminApi.uploadImage(file);
        imageUrl = upload.url;
        imagePublicId = upload.publicId;
      }
      const data = {
        topicId: String(form.get("topicId")),
        word: String(form.get("word")),
        meaning: String(form.get("meaning")),
        meaningVi: String(form.get("meaningVi")),
        pronunciation: String(form.get("pronunciation")) || null,
        partOfSpeech: String(form.get("partOfSpeech")) || null,
        exampleSentence: String(form.get("exampleSentence")) || null,
        imageUrl,
        imagePublicId,
        audioUrl: editing?.audioUrl ?? null,
      };
      if (editing) await adminApi.vocabularies.update(editing.id, data);
      else await adminApi.vocabularies.create(data);
    }, editing
      ? "Vocabulary updated successfully."
      : "Vocabulary created successfully.");
    if (saved) {
      setEditing(null);
      formElement.reset();
    }
  }

  return (
    <section className="admin-grid">
      <form
        className="admin-form"
        key={editing?.id ?? "new-vocabulary"}
        onSubmit={submit}
      >
        <FormHeading
          editing={Boolean(editing)}
          title={editing ? "Edit vocabulary" : "Add vocabulary"}
          description="Create a useful word card with context for learners."
        />
        <AdminField label="Topic" hint="Words stay within one topic.">
          <select name="topicId" defaultValue={editing?.topicId} required>
            <option value="">Select topic</option>
            {topics.map((topic) => (
              <option value={topic.id} key={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="English word">
          <input
            name="word"
            placeholder="e.g. departure"
            defaultValue={editing?.word}
            required
          />
        </AdminField>
        <AdminField label="English definition">
          <input
            name="meaning"
            placeholder="e.g. the act or time of leaving a place"
            defaultValue={editing?.meaning}
            required
          />
        </AdminField>
        <AdminField label="Vietnamese meaning">
          <input
            name="meaningVi"
            placeholder="e.g. sự khởi hành; thời điểm rời đi"
            defaultValue={editing?.meaningVi ?? ""}
            required
          />
        </AdminField>
        <AdminField label="Pronunciation" hint="IPA is recommended.">
          <input
            name="pronunciation"
            placeholder="e.g. /departure/"
            defaultValue={editing?.pronunciation ?? ""}
          />
        </AdminField>
        <AdminField label="Part of speech">
          <input
            name="partOfSpeech"
            placeholder="e.g. noun"
            defaultValue={editing?.partOfSpeech ?? ""}
          />
        </AdminField>
        <AdminField label="Example sentence">
          <textarea
            name="exampleSentence"
            placeholder="Use the word in context."
            defaultValue={editing?.exampleSentence ?? ""}
          />
        </AdminField>
        <AdminField label="Vocabulary image" hint="JPEG, PNG or WebP, max 5 MB.">
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </AdminField>
        <SubmitButton saving={saving}>
          {editing ? "Save word" : "Create word"}
        </SubmitButton>
        {editing && (
          <button
            className="text-button"
            type="button"
            onClick={() => setEditing(null)}
          >
            Cancel edit
          </button>
        )}
      </form>

      <AdminList loading={loading} emptyMessage="No vocabulary matches the filters.">
        {vocabularies.map((word) => (
          <article className="admin-row" key={word.id}>
            <div className="admin-row-main">
              <div className="admin-row-title">
                <strong>{word.word}</strong>
                {word.partOfSpeech && (
                  <StatusBadge tone="muted">{word.partOfSpeech}</StatusBadge>
                )}
              </div>
              <p>
                <strong>{word.meaningVi ?? "Chưa có nghĩa tiếng Việt"}</strong>
                {" · "}
                {word.topic?.name}
              </p>
              <small>{word.meaning}</small>
              {word.exampleSentence && <small>{word.exampleSentence}</small>}
            </div>
            <RowActions
              saving={saving}
              onEdit={() => setEditing(word)}
              onDelete={() =>
                run(
                  () => adminApi.vocabularies.delete(word.id),
                  "Vocabulary deleted successfully.",
                )
              }
            />
          </article>
        ))}
      </AdminList>
    </section>
  );
}

function LessonWorkspace({
  topics,
  vocabularies,
  lessons,
  run,
  saving,
  loading,
}: Readonly<{
  topics: Topic[];
  vocabularies: Vocabulary[];
  lessons: Lesson[];
  run: RunAction;
  saving: boolean;
  loading: boolean;
}>) {
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [topicId, setTopicId] = useState("");
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const availableWords = useMemo(
    () => vocabularies.filter((word) => word.topicId === topicId),
    [topicId, vocabularies],
  );

  async function editLesson(lesson: Lesson) {
    const detail = await adminApi.lessons.get(lesson.id);
    setEditing(detail);
    setTopicId(detail.topicId);
    setSelectedWords(detail.items?.map((item) => item.vocabulary.id) ?? []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await run(async () => {
      const data = {
        topicId,
        title: String(form.get("title")),
        description: String(form.get("description")),
        level: String(form.get("level")) as ContentLevel,
        vocabularyIds: selectedWords,
      };
      if (editing) await adminApi.lessons.update(editing.id, data);
      else await adminApi.lessons.create(data);
    }, editing
      ? "Lesson updated successfully."
      : "Lesson draft created successfully.");
    if (saved) resetLessonForm(formElement);
  }

  function resetLessonForm(form?: HTMLFormElement) {
    setEditing(null);
    setTopicId("");
    setSelectedWords([]);
    form?.reset();
  }

  return (
    <section className="admin-grid">
      <form
        className="admin-form"
        key={editing?.id ?? "new-lesson"}
        onSubmit={submit}
      >
        <FormHeading
          editing={Boolean(editing)}
          title={editing ? "Edit lesson" : "Create a lesson"}
          description="Combine related words into a focused learning session."
        />
        <AdminField label="Topic" hint="Changing topic clears selected words.">
          <select
            name="topicId"
            value={topicId}
            onChange={(event) => {
              setTopicId(event.target.value);
              setSelectedWords([]);
            }}
            required
          >
            <option value="">Select topic</option>
            {topics.map((topic) => (
              <option value={topic.id} key={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Lesson title">
          <input
            name="title"
            placeholder="e.g. At the Airport"
            defaultValue={editing?.title}
            required
          />
        </AdminField>
        <AdminField label="Description">
          <textarea
            name="description"
            placeholder="Describe the lesson outcome."
            defaultValue={editing?.description}
            minLength={10}
            required
          />
        </AdminField>
        <AdminField label="Level">
          <select name="level" defaultValue={editing?.level ?? "BEGINNER"}>
            {levels.map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </AdminField>
        <AdminField
          label="Vocabulary"
          hint={`${selectedWords.length} word(s) selected.`}
        >
          <div className="word-picker">
            {!topicId && <p>Select a topic to view vocabulary.</p>}
            {topicId && availableWords.length === 0 && (
              <p>This topic has no vocabulary yet.</p>
            )}
            {availableWords.map((word) => (
              <label key={word.id}>
                <input
                  type="checkbox"
                  checked={selectedWords.includes(word.id)}
                  onChange={() =>
                    setSelectedWords((current) =>
                      current.includes(word.id)
                        ? current.filter((id) => id !== word.id)
                        : [...current, word.id],
                    )
                  }
                />
                {word.word}
              </label>
            ))}
          </div>
        </AdminField>
        <SubmitButton saving={saving}>
          {editing ? "Save lesson" : "Create draft"}
        </SubmitButton>
        {editing && (
          <button
            className="text-button"
            type="button"
            onClick={() => resetLessonForm()}
          >
            Cancel edit
          </button>
        )}
      </form>

      <AdminList loading={loading} emptyMessage="No lessons match the filters.">
        {lessons.map((lesson) => (
          <article className="admin-row" key={lesson.id}>
            <div className="admin-row-main">
              <div className="admin-row-title">
                <strong>{lesson.title}</strong>
                <StatusBadge
                  tone={lesson.status === "PUBLISHED" ? "success" : "warning"}
                >
                  {lesson.status}
                </StatusBadge>
              </div>
              <p>
                {lesson.topic?.name} · {lesson.level} ·{" "}
                {lesson._count?.items ?? 0} words
              </p>
              <small>{lesson.description}</small>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => void editLesson(lesson)}>
                Edit
              </button>
              {lesson.status === "DRAFT" && (
                <button
                  disabled={saving}
                  type="button"
                  onClick={() =>
                    void run(
                      () =>
                        adminApi.lessons
                          .publish(lesson.id)
                          .then(() => undefined),
                      "Lesson published successfully.",
                    )
                  }
                >
                  Publish
                </button>
              )}
              <button
                disabled={saving}
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete "${lesson.title}"? This action cannot be undone.`,
                    )
                  ) {
                    void run(
                      () => adminApi.lessons.delete(lesson.id),
                      "Lesson deleted successfully.",
                    );
                  }
                }}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </AdminList>
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: Readonly<{
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}>) {
  if (!total) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const pages = paginationPages(page, totalPages);

  return (
    <nav className="admin-pagination" aria-label="Content pagination">
      <p>
        Showing {start}-{end} of {total}
      </p>
      <div>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        {pages.map((item, index) =>
          item === "..." ? (
            <span key={`ellipsis-${index}`}>...</span>
          ) : (
            <button
              className={item === page ? "active" : ""}
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

function paginationPages(page: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const values: Array<number | "..."> = [1];
  if (page > 3) values.push("...");
  for (
    let value = Math.max(2, page - 1);
    value <= Math.min(totalPages - 1, page + 1);
    value += 1
  ) {
    values.push(value);
  }
  if (page < totalPages - 2) values.push("...");
  values.push(totalPages);
  return values;
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);
  return debounced;
}

function FormHeading({
  editing,
  title,
  description,
}: Readonly<{
  editing: boolean;
  title: string;
  description: string;
}>) {
  return (
    <div className="admin-form-heading">
      <span className={editing ? "editing" : ""}>
        <AdminIcon name={editing ? "edit" : "plus"} />
      </span>
      <div>
        <small>{editing ? "Editing content" : "New content"}</small>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

type AdminIconName =
  | "arrow"
  | "book"
  | "collection"
  | "dashboard"
  | "edit"
  | "folder"
  | "lesson"
  | "library"
  | "plus"
  | "search"
  | "spark";

function AdminIcon({ name }: Readonly<{ name: AdminIconName }>) {
  const paths: Record<AdminIconName, ReactNode> = {
    arrow: <path d="m15 18-6-6 6-6M9 12h10" />,
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    collection: (
      <>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
      </>
    ),
    dashboard: (
      <>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    folder: (
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
    ),
    lesson: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    library: (
      <>
        <path d="M4 19V5M9 19V5M14 19V5" />
        <path d="m18 5 2 14" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    spark: <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function AdminField({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function AdminList({
  loading,
  emptyMessage,
  children,
}: Readonly<{ loading: boolean; emptyMessage: string; children: ReactNode }>) {
  return (
    <div className={`admin-list ${loading ? "loading" : ""}`}>
      {loading ? (
        <p className="admin-empty">Loading results...</p>
      ) : Array.isArray(children) && children.length === 0 ? (
        <p className="admin-empty">{emptyMessage}</p>
      ) : (
        children
      )}
    </div>
  );
}

function SubmitButton({
  saving,
  children,
}: Readonly<{ saving: boolean; children: ReactNode }>) {
  return (
    <button className="button" disabled={saving}>
      {saving ? "Saving..." : children}
    </button>
  );
}

function RowActions({
  saving,
  onEdit,
  onDelete,
}: Readonly<{
  saving: boolean;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
}>) {
  return (
    <div className="row-actions">
      <button type="button" onClick={onEdit}>
        Edit
      </button>
      <button
        disabled={saving}
        type="button"
        onClick={() => {
          if (
            window.confirm(
              "Delete this item? This action cannot be undone.",
            )
          ) {
            void onDelete();
          }
        }}
      >
        Delete
      </button>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: Readonly<{
  tone: "success" | "warning" | "muted";
  children: ReactNode;
}>) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}
