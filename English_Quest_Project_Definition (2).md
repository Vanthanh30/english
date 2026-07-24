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

# Sprint 9 - AI Image Writing Practice
 
## Role
 
AI Writing Coach / Vision Evaluator
 
## Input
 
- Uploaded image (JPG, PNG, WEBP)
- User's written English description of the image
## Output
 
- AI writing evaluation report
- Suggested improved paragraph
- New vocabulary list extracted from image context
- Grammar patterns used in the suggestion
## Context
 
Users upload a real-world image and write an English description based on what they see. After submitting their writing, an AI model scans both the image and the user's text to evaluate accuracy, language quality, and vocabulary usage. The AI provides a corrected/improved version of the paragraph, highlights grammar structures used, and suggests new vocabulary related to the image content. This feature bridges visual learning (Sprint 9) with active writing practice to reinforce English production skills.
 
## Analysis
 
### Problem Solved
 
- Learners often struggle to produce English output, not just consume it
- There is no structured writing practice tied to visual context in traditional apps
- Users receive no feedback on writing errors unless they have a human tutor
- Vocabulary from image recognition (Sprint 9) is passive — this sprint makes it active
### Key Differentiators
 
- AI evaluates writing based on actual image content, not just text grammar
- Provides a model paragraph as a reference for improvement
- Extracts contextually relevant vocabulary from the image scene
- Explains grammar patterns present in the improved paragraph
- Encourages rewriting after feedback for active learning loop
## Workflow
 
1. User navigates to **Image Writing Practice** section
2. User uploads an image (JPG / PNG / WEBP, max 5MB)
3. System previews the image on screen
4. User writes an English description of the image in a text area
5. User clicks **Submit for Review**
6. System sends both the image and the user's text to the AI model (Gemini Vision / GPT-4o)
7. AI analyzes:
   - Does the description match what is actually in the image?
   - Are there grammar errors?
   - Is the vocabulary appropriate and varied?
8. AI returns a structured evaluation response
9. System displays the evaluation report to the user:
   - **Overall Score** (0–100)
   - **Accuracy Feedback** (does the writing match the image?)
   - **Grammar Feedback** (errors and corrections)
   - **Improved Paragraph** (AI-suggested rewrite)
   - **New Vocabulary** (words relevant to the image scene, with meaning)
   - **Grammar Patterns** (structures used in the improved paragraph with explanations)
10. User reviews feedback and can optionally **Rewrite & Resubmit**
11. User can **Save Vocabulary** from the list to the Flashcard System (Sprint 5)
12. Submission history is stored for later review
## Features
 
### 9.5.1 Image Upload
 
| Property | Value |
|---|---|
| Supported Formats | JPG, JPEG, PNG, WEBP |
| Max File Size | 5MB |
| Preview | Displayed immediately after upload |
| Storage | Cloudinary (temporary or persistent per user setting) |
 
- Drag-and-drop or click-to-upload interface
- Image is displayed at a fixed size so user can study it while writing
- Clear/reset button to remove uploaded image and reset the form
### 9.5.2 Writing Input Area
 
- Multi-line text area below the image
- Minimum 20 characters required before submission
- Word count displayed in real-time
- Placeholder text: *"Describe what you see in the image in English..."*
- Submit button disabled until both image and text are present
### 9.5.3 AI Evaluation Report
 
The evaluation report is structured into the following sections:
 
| Section | Description |
|---|---|
| 🎯 Overall Score | Numerical score 0–100 based on accuracy, grammar, and vocabulary |
| 🖼️ Accuracy Feedback | Whether the written description matches the actual image content |
| ✏️ Grammar Feedback | List of grammar errors found with corrections |
| 💡 Improved Paragraph | AI-generated rewrite of the user's description |
| 📚 New Vocabulary | 5–10 relevant words/phrases from the image, each with Vietnamese meaning and example sentence |
| 🔤 Grammar Patterns | 2–4 grammar structures used in the improved paragraph, with brief explanation |
 
- Report displayed in a clean card layout below the image and writing area
- Each section collapsible for focused review
- Copy button on the Improved Paragraph section
### 9.5.4 Vocabulary Integration
 
- Each word in the **New Vocabulary** list has a **"Save to Flashcard"** button
- Duplicate detection: if word already exists in user's flashcard, show "Already saved"
- Saved flashcards follow Sprint 5 rules (default difficulty: Medium)
### 9.5.5 Rewrite & Resubmit
 
- After viewing feedback, user can edit their original text in-place
- **Resubmit** triggers a new AI evaluation
- Both original and resubmitted versions are stored in history
- Score comparison shown: *"Your score improved from 62 → 81"*
### 9.5.6 Submission History
 
- List of all past image writing sessions
- Each entry shows: thumbnail, submission date, overall score, word count
- User can click to review any past session and its evaluation
- Filterable by score range or date
## AI Prompt Design
 
The system sends the following prompt structure to the AI model:
 
```
You are an English writing coach. The user has uploaded an image and written an English description of it.
 
Your task:
1. Evaluate if the description accurately matches the image content.
2. Identify and correct grammar errors.
3. Rewrite the description as an improved, natural English paragraph.
4. Extract 5–10 relevant vocabulary words from the image scene, with Vietnamese translations and example sentences.
5. Highlight 2–4 grammar patterns used in your improved paragraph with brief explanations.
 
Return your response as a structured JSON with the following fields:
- overallScore (number 0–100)
- accuracyFeedback (string)
- grammarFeedback (array of { error, correction, explanation })
- improvedParagraph (string)
- newVocabulary (array of { word, partOfSpeech, vietnameseMeaning, exampleSentence })
- grammarPatterns (array of { pattern, explanation, example })
 
User's writing:
"{userText}"
```
 
## Data Model
 
```
ImageWritingSession
  - id
  - userId
  - imageUrl (Cloudinary URL)
  - userText (original submission)
  - revisedText (nullable, resubmission text)
  - overallScore (number)
  - accuracyFeedback (string)
  - grammarFeedback (JSON)
  - improvedParagraph (string)
  - newVocabulary (JSON)
  - grammarPatterns (JSON)
  - revisedScore (nullable number)
  - createdAt
  - updatedAt
```
 
## API Endpoints
 
| Method | Endpoint | Description |
|---|---|---|
| POST | /image-writing/submit | Submit image + text for AI evaluation |
| POST | /image-writing/:id/resubmit | Resubmit revised writing for re-evaluation |
| GET | /image-writing | Get user's submission history |
| GET | /image-writing/:id | Get a specific session with full evaluation |
| DELETE | /image-writing/:id | Delete a session |
 
## Rules
 
- Both image and text must be present before submission
- Minimum text length: 20 characters
- Supported image formats: JPG, JPEG, PNG, WEBP
- Max image size: 5MB
- AI model used: Gemini Vision or GPT-4o (vision-capable model required)
- Store image on Cloudinary; pass URL to AI model for evaluation
- Response must be valid JSON — implement retry logic if AI returns malformed response
- All sessions are private to the user
- Vocabulary saved from this feature follows the same deduplication rules as Sprint 5 and Sprint 9
## Tech Notes
 
- AI Vision Model: `gemini-1.5-pro` (via Google Generative AI SDK) or `gpt-4o` (via OpenAI SDK)
- Image upload: Cloudinary SDK — upload image first, pass `secure_url` in AI prompt
- Response parsing: parse AI JSON response; wrap in try/catch and return user-friendly error on parse failure
- Frontend: display evaluation report sections progressively as AI streams the response (streaming mode recommended)
- Resubmit comparison: store `overallScore` and `revisedScore` separately to show improvement delta
## Style
 
- Encouraging and Educational Tone
- Visual-First Layout (image prominent, writing below)
- Structured Feedback Cards
- Progress-Oriented (score delta on resubmit)
- Mobile Responsive
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

# Sprint 12 - Listening Dictation Practice (Nghe Chép Chính Tả)

## Role

Admin: Listening Content Manager
Student: Listening Learner

## Input

- Admin: audio file (MP3/WAV) or audio link, topic title, level, category, transcript text, listening configuration (max playback count, mistake threshold for hints, hint types)
- Student: topic selection, study mode selection (Fill-in-the-blanks / Full Sentence Dictation), typed answers

## Output

- Admin: managed listening topic repository (create, update, delete, list)
- Student: graded dictation attempt, saved learning progress, vocabulary hints, mistake highlights

## Context

Admin manages a repository of listening topics for dictation practice, similar to the Admin Portal shown in the reference screenshots (Manage Audio Topics list, Create New Topic modal). Each topic has an audio source (uploaded file or pasted link), a transcript broken into sentences, and a listening configuration that controls how many times a student may replay the audio and when hints are unlocked. Students can only browse and study published topics — they cannot create, edit, or delete topics. While studying, students pick one of two practice modes (inspired by dailydictation.com's "Listen and Type" exercises): **Fill-in-the-blanks**, where part of each sentence is masked and the student types only the missing words, or **Full Sentence Dictation**, where the student listens and types the entire sentence from scratch. The system tracks playback count and mistakes per sentence, automatically surfaces the configured hint type once the mistake threshold is reached, and persists the student's progress so they can resume an unfinished topic later.

## Analysis

### Problem Solved

- Learners need structured "listen and type" dictation practice to train listening + spelling + grammar together, not just passive listening
- Without a playback limit, students tend to replay audio endlessly instead of training active recall
- Without progressive hints, struggling students get stuck and abandon the exercise
- Progress is lost if a student closes the browser mid-topic

### Key Differentiators

- Admin fully controls listening difficulty via playback limit and mistake threshold, per topic
- Two distinct practice modes (fill-in-the-blanks vs full dictation) support different skill levels
- Vocabulary hints are available at any time, while other hint types (translation, incorrect-word highlight) unlock only after repeated mistakes
- Per-sentence progress and mistake tracking, with auto-resume of an in-progress topic

## Workflow

### Admin Workflow

1. Admin opens **Manage Audio Topics** page (list of topics with level, category, date created, actions)
2. Admin clicks **New Topic**
3. Admin enters Topic Title, selects Level (Beginner / Intermediate / Advanced)
4. Admin provides Audio Source — either **Upload Audio File** (MP3/WAV, max 50MB) or **Paste Audio Link**
5. Admin enters Topic Description (summary/notes)
6. Admin enters or pastes the full Transcript, which the system splits into sentences (editable line by line)
7. Admin sets **Listening Configuration**: Max Playback Count, Mistake Threshold for Hints, and selects one or more Hint Types (Vietnamese Translation, Fill-in-the-blanks, Highlight Incorrect Words)
8. Admin selects Category (e.g. Environmental Science, Biology, Anthropology)
9. Admin clicks **Create Topic** → system validates and saves
10. Admin can **Edit** or **Delete** any existing topic from the list
11. Admin can view Total Topics, Active Exams, Avg. Engagement, and Storage Used from the dashboard cards

### Student Workflow

1. Student browses the list of published listening topics, filtered by level/category
2. Student opens a topic and chooses a study mode: **Fill-in-the-blanks** or **Full Sentence Dictation**
3. System loads the first sentence and plays the audio (playback count starts at 0)
4. Student types their answer for the current sentence (masked words only, or full sentence, depending on mode)
5. Student submits the sentence → system compares the answer against the transcript
6. If correct, system marks the sentence complete and advances to the next sentence
7. If incorrect, system increments the mistake counter for that sentence and highlights differences
8. If mistakes reach the configured threshold, system automatically reveals the configured hint (e.g. Vietnamese translation, or highlights the incorrect words)
9. Student can tap a word at any time to see its vocabulary hint (meaning/translation) regardless of mistake count
10. Student can replay the audio up to Max Playback Count times per sentence; the replay button disables once the limit is reached
11. System auto-saves progress (current sentence index, answers, mistake count, playback count) after every submit or replay
12. Student can leave and return later — system resumes exactly where they left off
13. When all sentences are completed, system shows a summary (accuracy %, total mistakes, time spent) and marks the topic as Completed

## Features

### 12.1 Admin — Manage Listening Topics (CRUD)

| Action | Description |
|---|---|
| Create | Opens "Create New Topic" modal; requires title, level, audio source, listening configuration |
| Read | Paginated topic list with search by name, filter by level and category |
| Update | Edit any field of an existing topic, including replacing the audio source |
| Delete | Soft-delete a topic (with confirmation), removing it from the student-facing list |

- Dashboard summary cards: Total Topics, Active Exams, Avg. Engagement, Storage Used
- Table columns: Topic Title (with audio filename), Level badge (Beginner/Intermediate/Advanced), Category, Date Created, Actions (edit/delete)
- Quick search by topic name, plus Level and Category dropdown filters

### 12.2 Audio Source — Upload or Link

- **Upload Audio File**: drag-and-drop or click-to-select, supports MP3 and WAV, max 50MB, uploaded to Cloudinary
- **Paste Audio Link**: accepts a direct audio URL or supported streaming link; system validates the link is reachable and playable before saving
- Only one audio source is active per topic at a time (upload and link are mutually exclusive tabs)

### 12.3 Listening Configuration

| Setting | Description | Example |
|---|---|---|
| Max Playback Count | Maximum times a student may replay the audio per sentence | 3 |
| Mistake Threshold for Hints | Number of wrong attempts before a hint auto-unlocks | 2 |
| Hint Types | One or more hint types available for this topic | Vietnamese Translation, Fill-in-the-blanks, Highlight Incorrect Words |

- Hint Types is a multi-select; Admin can enable more than one hint type per topic
- These values are enforced client-side (UI disables replay/reveals hint) and re-validated server-side on each progress update

### 12.4 Client — Fill-in-the-Blanks Mode

- System masks selected words/phrases in each sentence (based on the transcript)
- Student types only the missing words into the blanks
- Vocabulary hint icon available next to masked words at any time

### 12.5 Client — Full Sentence Dictation Mode

- Student listens and types the entire sentence with no pre-filled text
- Answer is compared to the transcript with normalized punctuation/case and minor-typo tolerance
- Mistake highlighting shows word-level diff after each submit

### 12.6 Vocabulary Hint System

- Every topic ships with a vocabulary hint list (word + meaning) generated from the transcript
- Students can view a word's hint at any time, independent of the mistake threshold
- Threshold-gated hints (translation of full sentence, highlight incorrect words) unlock only after the student reaches the configured Mistake Threshold on that sentence

### 12.7 Progress Saving & Resume

- Progress is saved per (student, topic, mode) combination
- Stored state: current sentence index, submitted answers, mistake count per sentence, playback count per sentence, hints used, overall status (In Progress / Completed)
- Student's topic list shows a progress indicator (%) and a "Continue" button for unfinished topics

## Data Model

```
ListeningTopic
  - id
  - title
  - level (enum: BEGINNER | INTERMEDIATE | ADVANCED)
  - category
  - description
  - audioSourceType (enum: UPLOAD | LINK)
  - audioUrl
  - maxPlaybackCount (default: 3)
  - mistakeThreshold (default: 2)
  - hintTypes (array: VIETNAMESE_TRANSLATION | FILL_IN_BLANKS | HIGHLIGHT_INCORRECT_WORDS)
  - status (enum: DRAFT | PUBLISHED | ARCHIVED)
  - createdBy (adminId)
  - createdAt
  - updatedAt

ListeningSentence
  - id
  - topicId
  - order
  - text
  - maskedText (nullable, used for Fill-in-the-blanks mode)
  - audioStartTime (nullable)
  - audioEndTime (nullable)

VocabularyHint
  - id
  - topicId
  - word
  - meaning
  - vietnameseTranslation

ListeningProgress
  - id
  - userId
  - topicId
  - mode (enum: FILL_IN_BLANKS | FULL_DICTATION)
  - currentSentenceIndex
  - answers (JSON, keyed by sentenceId)
  - mistakeCountPerSentence (JSON)
  - playbackCountPerSentence (JSON)
  - hintsUsed (JSON)
  - status (enum: IN_PROGRESS | COMPLETED)
  - accuracy (nullable number)
  - startedAt
  - completedAt
  - updatedAt
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | /admin/listening-topics | Create a new listening topic |
| GET | /admin/listening-topics | List all topics (admin view, all statuses) |
| GET | /admin/listening-topics/:id | Get topic details including transcript and config |
| PUT | /admin/listening-topics/:id | Update topic fields, audio source, or configuration |
| DELETE | /admin/listening-topics/:id | Soft-delete a topic |
| POST | /admin/listening-topics/:id/audio | Upload audio file or set audio link |
| POST | /admin/listening-topics/:id/transcript | Save/replace transcript sentences and vocabulary hints |
| GET | /listening-topics | List published topics (student view), filter by level/category |
| GET | /listening-topics/:id | Get topic content for study (sentences, masks, hint availability) — excludes raw answer key beyond what mode requires |
| POST | /listening-topics/:id/progress | Start or fetch existing progress session for a mode |
| PATCH | /listening-progress/:id | Submit an answer, increment mistake/playback count, save state |
| POST | /listening-progress/:id/complete | Mark topic as completed, compute final accuracy |
| GET | /listening-progress | List current user's in-progress and completed topics |

## Rules

- Only Admin can create, update, or delete listening topics
- Students have read-only access to topics and can only create/update their own progress
- Audio upload: MP3 or WAV only, max 50MB
- Audio link must be validated as a reachable, playable audio URL before saving
- Playback count per sentence is capped at Max Playback Count; server rejects replay requests beyond the limit
- Threshold-gated hints unlock automatically once mistakeCount for a sentence reaches Mistake Threshold; vocabulary hints are always available
- Progress is unique per (userId, topicId, mode) — switching mode starts a separate progress record
- Progress auto-saves after every submit and every playback action

## Tech Notes

- Audio storage: Cloudinary (uploaded files); pasted links stored as-is with a reachability check on save
- Answer comparison: normalize case/punctuation/whitespace before diffing; word-level diff used for mistake highlighting
- Transcript-to-sentence splitting can be automated on paste (split by sentence-ending punctuation) with manual admin edit afterward
- Consider debouncing progress auto-save (e.g. on blur / on submit) rather than on every keystroke to reduce write load

## Style

- Admin: dashboard-driven, CRUD focused, matching existing Admin Portal layout (list + modal form)
- Student: distraction-free study screen, one sentence at a time, clear playback and hint controls
- Mobile Responsive

---

# Sprint 13 - Testing & Deployment

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
