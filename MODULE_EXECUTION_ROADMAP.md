# ProctorAI — Synchronous Module Execution Roadmap & Progress Tracker

> **Project:** ProctorAI — Intelligent Online Examination Monitoring & Anomaly Detection System  
> **Approach:** Synchronous, Module-by-Module Implementation  
> **Status Legend:**  
> - ⏳ **PENDING** — Waiting for predecessor modules to complete  
> - 🟡 **IN PROGRESS** — Currently active module  
> - ✅ **COMPLETED** — Verified, tested, and signed off  
> - ⛔ **BLOCKED** — Needs external resolution before proceeding  

---

## 📌 Synchronous Working Protocol

To guarantee high code quality, stability, and zero regressions:
1. **Strict Linearity**: We do not jump ahead to subsequent modules (e.g., CV or ML) until the previous module is completely functional and verified.
2. **Definition of Done (DoD) per Module**:
   - Backend APIs tested and verified.
   - Frontend UI responsive, connected, and error-free.
   - Database schemas and relationships intact.
   - Acceptance checklist 100% checked.
3. **Audit Trail**: After each module/sub-module, update this tracker file with date, status, files created, and test outcomes.

---

## 💻 Environment & Tools Status

| Tool / Service | Status | Version / Details | Notes |
| :--- | :---: | :--- | :--- |
| **Node.js** | ✅ Ready | `v24.16.0` | Global runtime available |
| **npm** | ✅ Ready | `11.13.0` | Use `npm.cmd` on Windows PowerShell |
| **Git** | ✅ Ready | `2.53.0.windows.2` | Version control available |
| **Python** | ✅ Ready | `3.12.10` | Python runtime for AI service |
| **PostgreSQL** | ✅ Ready | PostgreSQL 18 Service (`Running`) | Binaries at `C:\Program Files\PostgreSQL\18\bin` |

---

## 🗺️ Master Synchronous Implementation Plan

```mermaid
flowchart TD
    M0["Module 0: Monorepo & Setup"] --> M1["Module 1: Core Exam Platform (Auth, Exams, Attempts)"]
    M1 --> M2["Module 2: Client Browser Event Monitoring"]
    M2 --> M3["Module 3: Webcam & Computer Vision AI"]
    M3 --> M4["Module 4: Screen Sharing, OCR & AI Indicators"]
    M4 --> M5["Module 5: Behavioural Anomaly Detection"]
    M5 --> M6["Module 6: Real-time Examiner Dashboard & Review"]
    M6 --> M7["Module 7: End-to-End Integration & Evaluation"]
    M7 --> M8["Module 8: Docker Packaging & Final Documentation"]
```

---

## 📦 Module 0: Monorepo Foundation & Scaffolding
- [x] **0.1 Initialize Project Monorepo Structure**
  - [x] Create folder structure (`frontend/`, `backend/`, `ai-service/`, `docs/`, `storage/`)
  - [x] Add root `.gitignore`
  - [x] Add `.env.example` templates
- [x] **0.2 Verification**: Clean directory structure matching blueprint specification.

---

## 📦 Module 1: Core Examination Platform (Phase 1)
*Goal: Working end-to-end examination platform (Auth, Role-Based Access, Exam Management, Timed Question Interface, Answer Submission, and Result Calculation).*
*Status: ✅ COMPLETED & VERIFIED (2026-11-24)*

### 1.1 Backend Scaffolding & Database Schema
- [x] Initialize `backend/` with Node.js, Express, TypeScript, and Prisma 6
- [x] Create `proctor_ai` PostgreSQL database
- [x] Implement Prisma Schema (`User`, `Exam`, `Question`, `Option`, `ExamAttempt`, `Answer`, `ProctorEvent`, `Evidence`, `AnomalyScore`, `ReviewRecord`)
- [x] Run initial Prisma migration (`initial_schema`) & generate client
- [x] Setup Express server with CORS, dotenv, JSON parsing, and `/api/health`

### 1.2 Authentication & Role-Based Authorization
- [x] Implement password hashing with `bcryptjs`
- [x] Implement JWT token issuance and verification
- [x] Create auth routes & controllers:
  - `POST /api/auth/register` (Candidate registration)
  - `POST /api/auth/login` (Authentication)
  - `GET /api/auth/me` (Token validation / Current user profile)
- [x] Implement RBAC middleware (`authenticate`, `authorize(["ADMIN", "EXAMINER", "CANDIDATE"])`)
- [x] Seed script for default Admin, Examiner, Candidate, and Sample Exam (`npm run db:seed`)

### 1.3 Exam & Question Management API (Examiner / Admin)
- [x] Create Exam routes & controllers:
  - `POST /api/exams` (Create exam with title, duration, schedule)
  - `GET /api/exams` (List exams with role filtering)
  - `GET /api/exams/:id` (Get detailed exam info)
  - `PUT /api/exams/:id` (Update/Publish exam status)
- [x] Create Question routes & controllers:
  - `POST /api/exams/:id/questions` (Add MCQ / Descriptive questions)
  - `DELETE /api/questions/:id` (Remove questions)
  - `GET /api/exams/:id/questions` (Get questions — sanitized `isCorrect` for candidates)

### 1.4 Attempt & Answer Submission Engine (Candidate)
- [x] Create Attempt routes & controllers:
  - `POST /api/attempts` (Start exam attempt, enforce time window & single active attempt)
  - `GET /api/attempts/:id` (Fetch candidate's current attempt with sanitized questions)
  - `POST /api/attempts/:id/answers` (Autosave / update MCQ selection)
  - `POST /api/attempts/:id/submit` (Submit exam, server-side timer validation, auto-grade MCQs)
  - `GET /api/attempts/exam/:examId/results` (Examiner view of candidate attempts and scores)
  - `GET /api/attempts/:id/result` (Candidate view of their evaluated submission)

### 1.5 Frontend Foundation & Layout
- [x] Initialize `frontend/` with Vite + React + TypeScript + Tailwind CSS
- [x] Install dependencies: `lucide-react`, `react-router-dom`, `axios`, `react-hook-form`, `zod`
- [x] Build global layout components: Navigation, Header, Role Badges, Auth State Provider

### 1.6 Frontend Authentication & Protected Routes
- [x] Candidate & Examiner Login page (`/login`)
- [x] Candidate Registration page (`/register`)
- [x] Role-based route guard (`ProtectedRoute` for Admin, Examiner, Candidate)

### 1.7 Examiner Portal Interface
- [x] Examiner Dashboard (`/examiner`): Overview of created exams
- [x] Exam Creation / Edit page (`/examiner/exams/create`)
- [x] Question Builder UI (Add MCQ options, mark correct answer, set marks)
- [x] Submissions & Results Viewer (`/examiner/exams/:id/results`)

### 1.8 Candidate Examination Experience
- [x] Candidate Dashboard (`/candidate`): Available, ongoing, and past exams
- [x] Exam Instructions & System Check Page (`/candidate/exam/:id/instructions`)
- [x] Fullscreen Exam Interface (`/candidate/exam/:id`):
  - Question navigation sidebar (Answered, Unanswered, Current)
  - Countdown timer synchronized with backend
  - Option selector and autosave feedback
  - Final review and submit modal
- [x] Result / Completion screen (`/candidate/results/:id`)

### 1.9 Module 1 Verification & Sign-Off
- [x] End-to-end automated test (`backend/src/test-phase1-e2e.ts`): Admin/Examiner creates exam -> Candidate takes exam -> Answers auto-saved -> Candidate submits -> Marks calculated -> Examiner views results -> 100% passed.

---

## 📦 Module 2: Browser Activity Monitoring (Phase 2)
*Goal: Detect client-side browser anomalies: tab switches, window blur, fullscreen exits, copy/paste, and summarize interaction dynamics.*
*Status: ✅ COMPLETED & VERIFIED (2026-11-24)*

### 2.1 Client Monitoring Hook & Collectors
- [x] `useProctorMonitor` React hook for exam interface
- [x] Page visibility listener (`visibilitychange` -> `TAB_HIDDEN` / `TAB_VISIBLE`)
- [x] Window focus & blur listener (`blur` -> `WINDOW_BLUR`, `focus` -> `WINDOW_FOCUS`)
- [x] Fullscreen change & exit detector (`FULLSCREEN_EXIT` / `FULLSCREEN_ENTER`)
- [x] Clipboard interception (`copy` -> `COPY_ATTEMPT`, `paste` -> `PASTE_ATTEMPT`)
- [x] Context menu / shortcut prevention (`contextmenu`, inspect shortcuts blocked & logged: `DEVTOOLS_SHORTCUT`)

### 2.2 Mouse & Keyboard Interaction Summarizer
- [x] Throttled mouse movement summarizer (activity bursts vs prolonged inactivity)
- [x] Scroll frequency and speed tracker
- [x] Keyboard cadence metadata collector (keyPressCount, no raw keys or password logging)
- [x] Periodic `INTERACTION_SUMMARY` emission (flushed every 30 seconds)

### 2.3 Backend Event Ingestion Pipeline
- [x] `POST /api/proctor/events` endpoint:
  - Validates attempt ownership & active status
  - Throttled batch event ingestion with Zod validation
  - Stores events in PostgreSQL `proctor_events` table with ISO timestamp & metadata
- [x] `GET /api/proctor/attempts/:attemptId/events`:
  - Retrieves chronological audit trail and severity breakdown (INFO, LOW, MEDIUM, HIGH, CRITICAL)
- [x] Examiner UI Proctoring Telemetry Audit Modal in `ExamResultsPage`

### 2.4 Module 2 Verification & Sign-Off
- [x] Live automated test (`backend/src/test-phase2-e2e.ts`) verifying:
  - Multi-category browser event ingestion (Tab hidden, Blur, Copy, Paste, DevTools shortcut, Interaction summary)
  - Strict attempt authorization (foreign attempts blocked from injection)
  - Examiner severity aggregation & event audit trail
  - Permanent persistence after attempt submission
  - 100% passed.

---

## 📦 Module 3: Webcam & Computer Vision Proctoring (Phase 3)
*Goal: Permission-based candidate video analysis for presence, head pose/gaze deviations, and mobile phone detection.*
*Status: ✅ COMPLETED & VERIFIED (2026-11-24)*

### 3.1 Python AI Service Setup
- [x] Initialize `ai-service/` with FastAPI, Uvicorn, OpenCV, MediaPipe, Ultralytics YOLOv8
- [x] Configure `requirements.txt` and dedicated Python virtual environment (`ai-service/venv`)
- [x] Implement AI microservice health endpoint (`GET /health`)

### 3.2 Candidate Webcam & Consent Interface
- [x] Browser `MediaDevices.getUserMedia` integration
- [x] Floating webcam preview component (`WebcamMonitor.tsx`) with persistent "Camera Active" badge
- [x] Periodic secure frame sampling (every 3.5s canvas captures at 480x360 JPEG)
- [x] Overlay dynamic detection state indicators (Face Centered, Looking Away, Face Missing, Phone Detected)

### 3.3 Computer Vision Pipeline
- [x] **Face Presence & Multi-Face Detector** (`face_detector.py`: MediaPipe + OpenCV Cascade fallback)
- [x] **Head Pose & Looking Away Analysis** (`head_pose.py`: yaw, pitch, roll tracking with explainable thresholds)
- [x] **Mobile Phone & Device Detection** (`phone_detector.py`: Ultralytics YOLOv8n cell phone detection)

### 3.4 Integration & Event Reporting
- [x] Express backend proxy/relay (`POST /api/proctor/attempts/:attemptId/frame`) with Multer buffer handling
- [x] Auto-logging of high-confidence anomalies to `proctor_events`
- [x] Automated frame snapshot preservation in `storage/evidence/` and DB indexing in `evidence` table
- [x] Module 3 Verification & Sign-Off (`backend/src/test-phase3-e2e.ts` passed 100%).

---

## 📦 Module 4: Screen Monitoring, OCR & AI Indicators (Phase 4)
*Goal: Authorized screen sharing, screen text OCR, and external tool indicators.*

### 4.1 Screen Capture Consent & Streaming
- [ ] Browser Screen Capture API (`getDisplayMedia`) with explicit prompt
- [ ] Candidate indicator showing active screen sharing status
- [ ] Handle screen share stop events (log `SCREEN_SHARE_STOPPED` alert)

### 4.2 OCR & Visual Text Analysis
- [ ] Python AI service OCR endpoint using Tesseract / EasyOCR
- [ ] Sample permitted screen frames at configurable intervals
- [ ] Search for known AI assistant keywords (e.g. "ChatGPT", "Claude", "Gemini", "StackOverflow", "Chegg") in visible text

### 4.3 External AI Tool Correlation
- [ ] Correlate browser window blur event with visible external tool text on screen
- [ ] Label indicators strictly as **"Visible External Reference Indicator"** (never claim definitive proof)
- [ ] Module 4 Verification & Sign-Off.

---

## 📦 Module 5: Behavioural Anomaly Detection Engine (Phase 5)
*Goal: Feature aggregation, correlation rule engine, Isolation Forest scoring, and explainable risk levels.*

### 5.1 Behavioural Feature Extraction
- [ ] Aggregate candidate session metrics:
  - Count & duration of tab hidden / window blurs
  - Copy/paste count
  - Face missing duration & multi-face count
  - Phone detection occurrences
  - Scroll & mouse anomaly metrics

### 5.2 Rule-Based Correlation Engine
- [ ] Multi-signal correlation rules:
  - *Example:* Blur for > 20s followed immediately by Paste event = High Risk Flag
  - *Example:* Multi-face detected simultaneously with mobile phone = Critical Risk Flag

### 5.3 Isolation Forest & Explainability
- [ ] Python anomaly detector using Scikit-Learn `IsolationForest`
- [ ] Produce normalized Risk Score (0.0 to 100.0) and Risk Level (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- [ ] Generate JSON explanation listing contributing factors for human examiner review
- [ ] Persist scores in `anomaly_scores` table

### 5.4 Module 5 Verification & Sign-Off
- [ ] Benchmark synthetic sessions against expected risk tiers.

---

## 📦 Module 6: Real-Time Examiner Monitoring & Dashboard (Phase 6)
*Goal: Live proctoring monitor with Socket.IO alerts, candidate activity timelines, and human examiner audit/verdict actions.*

### 6.1 Real-Time Socket.IO Infrastructure
- [ ] Backend Socket.IO server with room scoping (`exam:<id>`)
- [ ] Client Socket.IO hooks with automatic reconnection and JWT authentication
- [ ] Real-time event broadcasting (Candidate blur, CV alert, phone detected)

### 6.2 Examiner Live Proctoring Dashboard (`/examiner/proctor/:examId`)
- [ ] Live candidate grid with active monitoring statuses (Webcam OK, Screen OK, Focus OK)
- [ ] Real-time alert stream with severity color coding (`INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- [ ] Quick-filter by risk level

### 6.3 Candidate Event Timeline & Evidence Review
- [ ] Chronological event timeline view per candidate attempt
- [ ] Evidence preview modal (view captured snapshot/metadata securely)
- [ ] Explainable anomaly breakdown chart

### 6.4 Human Review & Audit Record
- [ ] Examiner review decision actions (`CLEARED`, `FLAGGED_FOR_INQUIRY`, `DISQUALIFIED`)
- [ ] Mandatory examiner notes/reasoning field
- [ ] Store human decision in `review_records` table
- [ ] Comprehensive printable/exportable exam integrity report

### 6.5 Module 6 Verification & Sign-Off.

---

## 📦 Module 7: Integration, Testing & Security Hardening (Phase 7)
- [ ] Full end-to-end integration test across all 3 tiers (Frontend, Node.js Backend, Python AI Service)
- [ ] Security hardening: Rate limiting (`express-rate-limit`), Helmet security headers, sanitization
- [ ] Candidate privacy validation: verify no raw passwords or keystrokes logged, clear retention tags
- [ ] False-positive calibration with baseline student testing sessions.

---

## 📦 Module 8: Packaging, Deployment & Documentation (Phase 8)
- [ ] `docker-compose.yml` for unified local deployment (PostgreSQL + Node Backend + Python AI + Frontend)
- [ ] Documentation suite:
  - `docs/architecture.md`
  - `docs/api-documentation.md`
  - `docs/database-design.md`
- [ ] Project README & Video demonstration script.

---

## 📝 Current Progress & Next Steps

| Milestone | Target | Status | Completion Date |
| :--- | :--- | :---: | :--- |
| **Module 0** | Monorepo Scaffolding & Git Init | ✅ COMPLETED | 2026-11-24 |
| **Module 1** | Core Exam Platform (Auth, Exams, Attempts, UI) | ✅ COMPLETED | 2026-11-24 |
| **Module 2** | Client Browser Activity Monitoring | ✅ COMPLETED | 2026-11-24 |
| **Module 3** | Webcam & Computer Vision (OpenCV/YOLO) | ✅ COMPLETED | 2026-11-24 |
| **Module 4** | Screen Sharing, OCR & AI Indicators | 🟡 NEXT | Ready to start |
| **Module 5** | Behavioural Anomaly Detection Engine | ⏳ PENDING | - |
| **Module 6** | Real-Time Live Examiner Dashboard | ⏳ PENDING | - |
| **Module 7** | Full Integration & Security Hardening | ⏳ PENDING | - |
| **Module 8** | Docker Deployment & Final Docs | ⏳ PENDING | - |

> 🎯 **Current Milestones Completed:** Modules 0, 1, 2, and 3 are fully implemented, typed, and verified with automated end-to-end integration tests.
> 🎯 **Immediate Next Step:** Begin **Module 4: Screen Sharing, OCR & AI Indicators** (Screen Capture API `getDisplayMedia`, OCR text extraction with Tesseract/EasyOCR in the Python microservice, and external tool indicators).
