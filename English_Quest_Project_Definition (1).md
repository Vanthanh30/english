# English Quest - Project Definition

## Role

You are a Senior Fullstack Developer, Solution Architect, BA, and UI/UX Designer responsible for building an English learning platform.

---

# Project Context

## Product Name

English Quest

## Goal

Build a gamified English learning platform with:

- Admin Portal
- Client Portal
- Vocabulary Learning
- Notes
- Flashcards
- AI Chatbot
- AI Image Recognition
- Vocabulary Games
- Study Scheduling
- Email Reminder System

---

# Sprint 0 - Project Setup

## Role

System Architect

## Input

- Business requirements
- UI wireframes
- Technology stack

## Output

- Monorepo structure
- Database connection
- CI/CD pipeline
- Authentication foundation

## Context

Create project foundation before implementing business features.

## Workflow

1. Create repository
2. Setup Frontend
3. Setup Backend
4. Setup PostgreSQL
5. Setup Prisma
6. Setup Environment Variables
7. Setup Docker
8. Setup CI/CD

## Rules

- TypeScript only
- Clean Architecture
- Repository Pattern
- Environment variables required

## Style

- Modular
- Scalable
- Maintainable

---

# Sprint 1 - Authentication & Authorization

## Role

Authentication Engineer

## Input

- User registration data
- OAuth credentials

## Output

- Registered user
- JWT token
- Refresh token

## Context

Users must authenticate before accessing learning features.

## Workflow

1. Register
2. Verify email
3. Login
4. Generate JWT
5. Refresh token
6. Logout

## Rules

- Password hashed using bcrypt
- JWT expiration required
- Role based access control

## Style

- Secure
- Stateless

---

# Sprint 2 - Admin Content Management

## Role

Content Administrator

## Input

- Topic data
- Vocabulary data
- Lesson data

## Output

- Topics
- Vocabulary
- Lessons

## Context

Admin creates learning content.

## Workflow

1. Create Topic
2. Create Vocabulary
3. Create Lesson
4. Publish Lesson

## Rules

- Only Admin can access
- Validation required

## Style

- CRUD focused
- Dashboard driven

---

# Sprint 3 - Vocabulary Learning

## Role

Student

## Input

- Topic selection
- Lesson selection

## Output

- Learned vocabulary
- Progress tracking

## Context

Core English learning module.

## Workflow

1. Browse Topic
2. Open Lesson
3. Learn Vocabulary
4. Listen Audio
5. Mark Complete

## Rules

- Progress stored per user
- Vocabulary belongs to topic

## Style

- Interactive
- Mobile friendly

---

# Sprint 4 - Note Taking

## Role

Student

## Input

- Note title
- Note content

## Output

- Personal note

## Context

Users create study notes.

## Workflow

1. Create Note
2. Edit Note
3. Delete Note
4. Search Note

## Rules

- Notes belong to owner

## Style

- Rich text editor

---

# Sprint 5 - Flashcard System

## Role

Student

## Input

- Vocabulary selection

## Output

- Flashcards
- Review schedule

## Context

Spaced repetition learning.

## Workflow

1. Save Word
2. Generate Flashcard
3. Review Flashcard
4. Grade Difficulty

## Rules

- Easy = 5 days
- Medium = 2 days
- Hard = 1 day

## Style

- Fast learning experience

---

# Sprint 6 - Vocabulary Matching Game

## Role

Student

## Input

- Topic
- Difficulty

## Output

- Score
- Ranking

## Context

Gamification module.

## Workflow

1. Start Game
2. Match Vocabulary
3. Timer Count Down
4. Submit Result

## Rules

- Time limited
- Score calculated

## Style

- Fun
- Competitive

---

# Sprint 7 - English Reading Workspace

## Role

Student / English Reader

## Input

- Article URL (news, blog, Medium, BBC, CNN, etc.)
- Story / Novel URL
- PDF file
- DOCX file
- TXT file

## Output

- Immersive Reading Workspace
- Interactive Vocabulary Highlights
- Dictionary Popup (meaning, pronunciation, usage)
- Flashcards from Reading
- Reading Notes (vocabulary, grammar, summary, personal)
- Reading Progress & Bookmark

## Context

Users can import English articles, blogs, news, novels, or stories by pasting a URL or uploading a file (PDF, DOCX, TXT). The system extracts and renders the content in a clean, distraction-free reading workspace. During reading, users can highlight unknown or important vocabulary, double-click any word to instantly view its dictionary popup (meaning, Vietnamese translation, IPA, part of speech, example sentence), save words directly to the Flashcard System, and take structured notes tied to the reading session. The system auto-saves reading position so users can resume where they left off at any time.

## Analysis

### Problem Solved

- Traditional reading tools force users to switch between browser tabs to look up words
- Vocabulary encountered during reading is rarely retained without active review
- Users lose their reading position when switching devices or closing the browser
- There is no structured way to take notes during English reading sessions

### Key Differentiators

- Inline dictionary popup — no tab switching required
- One-click save to Flashcard for spaced repetition
- Color-coded vocabulary highlight system to track learning status
- Session-persistent bookmarking with cross-device sync
- Note-taking organized by note type within the reading context

## Workflow

1. Paste URL or Select File to Upload
2. System Validates URL / Parses File Format
3. Extract & Clean Content (strip ads, navigation, scripts)
4. Render Content in Reading Workspace
5. User Reads — scroll triggers progress tracking
6. User selects/highlights a word → choose highlight color
7. User double-clicks a word → Dictionary Popup appears
8. Popup shows: meaning, Vietnamese translation, IPA, part of speech, example sentence, common usage
9. User clicks "Save to Flashcard" inside popup
10. System checks for duplicate flashcard before saving
11. User opens Note Panel → creates note (Vocabulary / Grammar / Summary / Personal)
12. System auto-saves reading position (bookmark) every 30 seconds
13. User closes and returns later → system resumes from last bookmark
14. User marks reading as Completed

## Features

### 7.1 Import Reading Material

| Source | Supported Formats | Notes |
|---|---|---|
| URL Import | Any public HTTP/HTTPS URL | Validate URL, extract main article body using Readability.js or similar parser |
| PDF Upload | `.pdf` | Extract text layer; fallback OCR for scanned PDFs |
| DOCX Upload | `.docx` | Extract paragraphs, preserve headings |
| TXT Upload | `.txt` | Plain text render |

- Max file size: 20MB
- Supported URL sources: news articles, blog posts, Medium, Wikipedia, stories
- Reject URLs requiring login or paywalled content (return user-friendly error)
- Strip irrelevant content: ads, navigation menus, comment sections, scripts

### 7.2 Reading Workspace UI

- **Clean reading mode**: centered content, no sidebar distractions
- **Dark mode / Light mode toggle**
- **Font size adjustment**: Small / Medium / Large / X-Large
- **Line spacing control**: Compact / Normal / Relaxed
- **Reading progress bar**: horizontal bar at top showing % of article read
- **Estimated reading time**: shown at article header (calculated from word count at ~200 WPM)
- **Scroll position auto-save**: bookmark saved every 30 seconds while reading

### 7.3 Vocabulary Highlight System

Users can select any word or phrase and apply a color-coded highlight:

| Color | Meaning | Use Case |
|---|---|---|
| 🟡 Yellow | Unknown Word | Words the user does not know yet |
| 🟢 Green | Learned Word | Words already added to flashcard or known |
| 🔴 Red | Important Word | Key vocabulary worth special attention |

- Highlights persist across sessions (stored in DB linked to reading item + user)
- User can remove a highlight by right-clicking the highlighted word
- Highlight counts displayed in reading stats panel

### 7.4 Dictionary Popup (Double Click)

Double-clicking any word triggers an inline popup with:

| Field | Description |
|---|---|
| Word | The clicked word (normalized: lowercase, stripped punctuation) |
| Vietnamese Translation | Primary Vietnamese meaning |
| IPA Pronunciation | International Phonetic Alphabet transcription |
| Part of Speech | noun / verb / adjective / adverb / preposition / etc. |
| Definition (EN) | English definition |
| Example Sentence | One natural example sentence in context |
| Common Usage | Collocations or common phrases |
| Audio Button | Text-to-speech pronunciation playback |
| Save to Flashcard Button | One-click save to Flashcard System (Sprint 5) |
| Add Highlight Button | Apply highlight color directly from popup |

- Popup closes on outside click or Escape key
- If word already exists in flashcard, show "Already saved" state instead
- Dictionary data sourced from Free Dictionary API or internal vocabulary database

### 7.5 Flashcard Integration

- "Save to Flashcard" button available in Dictionary Popup
- System checks for duplicate (same word, same user) before saving
- If duplicate exists: show toast "Already in your flashcards"
- If new: save word with definition, IPA, example sentence to Flashcard System
- Flashcard created with default difficulty: Medium (review in 2 days per Sprint 5 rules)

### 7.6 Reading Notes Panel

A collapsible side panel for structured note-taking during reading:

| Note Type | Purpose |
|---|---|
| 📝 Vocabulary Notes | Record words, meanings, and personal memory hooks |
| 📖 Grammar Notes | Note grammar patterns or structures observed in text |
| 📋 Summary Notes | Write summary of what was read |
| 💭 Personal Notes | Free-form thoughts, reactions, questions |

- Notes are linked to the specific reading item (article / file)
- Notes are timestamped
- Notes are searchable from the Notes Module (Sprint 4)
- User can export notes as plain text or markdown

### 7.7 Reading Bookmark & Progress Tracking

**Bookmark:**
- Auto-saved every 30 seconds while user is actively scrolling
- Restored automatically when user reopens the same reading item
- "Continue Reading" button shown on reading list view

**Progress Status:**

| Status | Trigger |
|---|---|
| Not Started | Reading item created but never opened |
| Reading | User has opened and scrolled |
| Completed | User manually marks as Completed |

**Reading Stats per Item:**
- Total words in article
- Estimated time to finish
- Time spent reading (tracked per session)
- Number of vocabulary saved to flashcard from this article
- Number of highlights applied

### 7.8 Reading Library

- User's list of all imported reading items
- Filterable by: Status (Not Started / Reading / Completed), Source (URL / PDF / DOCX / TXT), Date Added
- Search by title or content
- Delete reading item (removes highlights, notes, bookmark for that item)

## Data Model (Key Entities)

```
ReadingItem
  - id
  - userId
  - title
  - sourceType: URL | PDF | DOCX | TXT
  - sourceUrl (nullable)
  - content (extracted text)
  - wordCount
  - status: NOT_STARTED | READING | COMPLETED
  - bookmarkPosition (scroll percentage or paragraph index)
  - createdAt
  - updatedAt

VocabularyHighlight
  - id
  - readingItemId
  - userId
  - word
  - color: YELLOW | GREEN | RED
  - charOffset (position in content)
  - createdAt

ReadingNote
  - id
  - readingItemId
  - userId
  - noteType: VOCABULARY | GRAMMAR | SUMMARY | PERSONAL
  - content
  - createdAt
  - updatedAt
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /reading/import-url | Import article from URL |
| POST | /reading/upload | Upload PDF / DOCX / TXT |
| GET | /reading | List user's reading library |
| GET | /reading/:id | Get reading item content |
| PATCH | /reading/:id/bookmark | Update bookmark position |
| PATCH | /reading/:id/status | Update reading status |
| POST | /reading/:id/highlights | Save a vocabulary highlight |
| DELETE | /reading/:id/highlights/:highlightId | Remove a highlight |
| GET | /reading/:id/highlights | Get all highlights for a reading item |
| POST | /reading/:id/notes | Create a reading note |
| GET | /reading/:id/notes | Get all notes for a reading item |
| PATCH | /reading/:id/notes/:noteId | Edit a reading note |
| DELETE | /reading/:id/notes/:noteId | Delete a reading note |
| GET | /dictionary/lookup?word= | Dictionary popup data |

## Rules

- Only the owner can access their uploaded content and reading data
- Validate URL before importing; reject inaccessible or malformed URLs
- Support file types: PDF, DOCX, TXT only
- Max upload file size: 20MB
- Prevent duplicate flashcards when saving from Dictionary Popup
- Auto-save bookmark position every 30 seconds during active reading
- Reading notes are private to the user
- Dictionary popup must not block the reading text (render as floating overlay)
- Strip all scripts, ads, and navigation from URL-imported content
- Handle extraction failure gracefully with user-friendly error message

## Tech Notes

- URL content extraction: use `@extractus/article-extractor` or `mozilla/readability`
- PDF text extraction: `pdf-parse` (Node.js) with fallback to OCR via `tesseract.js` for scanned PDFs
- DOCX extraction: `mammoth.js`
- Dictionary API: Free Dictionary API (`https://api.dictionaryapi.dev`) or Oxford API
- Text-to-speech pronunciation: Web Speech API (browser-native) or Google TTS
- Reading progress tracking: IntersectionObserver on paragraph elements

## Style

- Immersive Reading Experience
- Vocabulary Acquisition Focused
- Distraction-Free Interface
- Mobile Responsive
- Productivity Driven

---

# Sprint 8 - AI Chatbot

## Role

AI English Tutor

## Input

- User question

## Output

- AI response

## Context

Provides learning assistance.

## Workflow

1. User asks
2. AI processes
3. AI responds
4. Save history

## Rules

- Context aware
- Safe responses

## Style

- Friendly
- Educational

---

# Sprint 9 - AI Image Recognition

## Role

Vision AI

## Input

- Uploaded image

## Output

- Detected objects
- Vocabulary suggestions

## Context

Learn vocabulary from real-world images.

## Workflow

1. Upload Image
2. Detect Objects
3. Generate Vocabulary
4. Save Vocabulary

## Rules

- Supported image formats only
- Store history

## Style

- Visual learning

---

# Sprint 10 - Study Schedule & Notifications

## Role

Study Planner

## Input

- Schedule data

## Output

- Reminder notification

## Context

Help users maintain consistency.

## Workflow

1. Create Schedule
2. Store Schedule
3. Trigger Reminder
4. Send Email

## Rules

- Reminder before study time
- Prevent duplicate emails

## Style

- Productivity focused

---

# Sprint 11 - Dashboard & Analytics

## Role

Analytics Engine

## Input

- User activity

## Output

- Statistics
- Charts

## Context

Track learning performance.

## Workflow

1. Collect Activity
2. Aggregate Data
3. Generate Dashboard

## Rules

- Real-time metrics

## Style

- Data-driven

---

# Sprint 12 - Testing & Deployment

## Role

QA Engineer & DevOps

## Input

- Completed application

## Output

- Production release

## Context

Final delivery stage.

## Workflow

1. Unit Test
2. Integration Test
3. UAT
4. Deploy
5. Monitor

## Rules

- Minimum 80% coverage
- No critical bugs

## Style

- Stable
- Production-ready

---

# Recommended Tech Stack

## Frontend

- Next.js
- TypeScript
- TailwindCSS
- Zustand
- React Query

## Backend

- NestJS
- Prisma
- PostgreSQL
- Redis
- JWT

## AI

- OpenAI
- Gemini Vision

## Storage

- Cloudinary

## Email

- Nodemailer
- SendGrid

## Deployment

- Vercel
- Railway
- Neon PostgreSQL
