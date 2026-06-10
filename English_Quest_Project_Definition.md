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

# Sprint 7 - AI Chatbot

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

# Sprint 8 - AI Image Recognition

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

# Sprint 9 - Study Schedule & Notifications

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

# Sprint 10 - Dashboard & Analytics

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

# Sprint 11 - Testing & Deployment

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
