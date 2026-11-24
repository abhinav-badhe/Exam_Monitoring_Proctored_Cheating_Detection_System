# ProctorAI System Architecture

## 1. System Overview
**ProctorAI** is a modular, multi-tier automated and human-assisted online examination proctoring platform. The architecture cleanly separates heavy asynchronous AI perception and anomaly scoring workloads from core transactional and examination operations.

```
+-------------------------------------------------------------------------------+
|                           Candidate & Examiner Clients                        |
|                       (React 19 + TypeScript + Vite + Tailwind)               |
+----------------------+---------------------------------+----------------------+
                       | HTTP / REST                     | WebSockets (Socket.IO)
                       v                                 v
+-------------------------------------------------------------------------------+
|                           Node.js Express Backend                             |
|              - JWT Auth & RBAC (Admin, Examiner, Candidate)                   |
|              - Exam Creation, Question Builder, Timers & Grading              |
|              - Socket.IO Rooms (exam:<id>, attempt:<id>)                      |
|              - Proctoring Telemetry Buffer & Evidence Storage                 |
|              - Prisma ORM 6.x Data Layer                                      |
+----------------------+---------------------------------+----------------------+
                       |                                 |
                       | SQL                             | HTTP Multipart / JSON
                       v                                 v
+------------------------------------+   +-------------------------------------+
|        PostgreSQL Database         |   |      Python FastAPI AI Service      |
|  - Users, Exams, Questions         |   |  - MediaPipe Face Mesh & Head Pose  |
|  - Exam Attempts & MCQs            |   |  - Ultralytics YOLOv8n Phone Detect |
|  - Proctor Events & Evidence Files |   |  - EasyOCR External Tool Indicators |
|  - Anomaly Scores & Review Records |   |  - Scikit-Learn Isolation Forest    |
+------------------------------------+   +-------------------------------------+
```

---

## 2. Core Architectural Pillars

### 2.1 Multi-Tier Separation of Concerns
1. **Frontend Presentation Tier (`frontend/`)**: Single-page application built on React, Vite, and Tailwind CSS. Provides separate tailored interfaces for Candidates (Fullscreen test environment, synchronized countdown, floating camera telemetry, screen capture prompt, direct examiner warning modals) and Examiners (Exam authoring, Live Proctoring Dashboard, Real-time Alert Stream, and Anomaly Audit Viewer).
2. **Transactional API & Telemetry Orchestration Tier (`backend/`)**: Built on Node.js, Express, TypeScript, and Prisma ORM. Handles user authentication, exam CRUD, question options, candidate attempt lifecycle, autosave answers, automatic grading, evidence persistence in local/cloud storage, and Socket.IO real-time alert dispatch.
3. **Computer Vision & Behavioural Anomaly Microservice (`ai-service/`)**: A decoupled Python FastAPI service running MediaPipe, OpenCV, PyTorch, Ultralytics YOLOv8n, EasyOCR, and Scikit-learn. Offloads compute-heavy perceptual inference from the Node.js event loop.

---

## 3. Proctoring Telemetry & Perception Pipeline

### 3.1 Client-Side Browser Activity Telemetry
- **Window & Tab Tracking**: Intercepts `visibilitychange` (`TAB_HIDDEN`/`TAB_VISIBLE`) and `window.onblur`/`window.onfocus` (`WINDOW_BLUR`/`WINDOW_FOCUS`).
- **Fullscreen Enforcement**: Listens to `fullscreenchange` and logs `FULLSCREEN_EXIT`.
- **Clipboard & DevTools Prevention**: Intercepts `copy`, `paste`, context menu events, and developer inspection shortcuts (`F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+U`).
- **Interaction Summarizer**: Throttles mouse movement pixels, scroll events, and keyboard cadence counts (`keyPressCount`), periodically flushing benign summaries without collecting raw keystrokes or sensitive input.

### 3.2 Webcam Perception Engine
- **Face Presence & Multi-Face Detection**: Uses MediaPipe Face Detection with an OpenCV Haar Cascade fallback to detect absence (`NO_FACE_DETECTED`) or multiple individuals (`MULTIPLE_FACES_DETECTED`).
- **Head Pose Estimation**: Analyzes nose tip, chin, eye corners, and mouth corners using `cv2.solvePnP` to track yaw, pitch, and roll, identifying sustained gaze aversion (`LOOKING_AWAY`).
- **Mobile Device Detection**: Employs Ultralytics YOLOv8n object detection specifically filtering for class `cell phone` (`PHONE_DETECTED`).

### 3.3 Screen Sharing & OCR AI Indicator Detection
- **Display Capture API**: Prompts candidate for explicit consent using `navigator.mediaDevices.getDisplayMedia`. Detects premature track termination (`SCREEN_SHARE_STOPPED`).
- **Optical Character Recognition**: EasyOCR pipeline extracts visible screen text strings and matches against curated dictionaries of unauthorized homework platforms (`Chegg`, `Course Hero`, `Quizlet`, `Brainly`) and external generative AI assistants (`ChatGPT`, `Claude`, `Gemini`, `Copilot`, `Perplexity`, `DeepSeek`).

---

## 4. Behavioural Anomaly Detection & Scoring

### 4.1 Feature Extraction
Aggregates candidate telemetry across 11 numerical features:
1. `tab_hidden_count`
2. `window_blur_count`
3. `copy_paste_count`
4. `fullscreen_exit_count`
5. `devtools_attempt_count`
6. `face_missing_count`
7. `multi_face_count`
8. `looking_away_count`
9. `phone_detected_count`
10. `external_indicator_count`
11. `interaction_ticks`

### 4.2 Multi-Signal Rule Engine
Deterministic multi-signal correlation rules:
- `BLUR_PASTE_SEQUENCE`: Candidate pastes content within 20 seconds of returning from window/tab switch.
- `MULTI_FACE_AND_PHONE`: Simultaneous presence of multiple individuals and visible mobile device.
- `DEVTOOLS_INSPECTION_ATTEMPT`: Developer tools inspection shortcut triggered.
- `EXTERNAL_AI_ASSISTANT_INDICATOR`: Screen OCR detects external AI tool on display.
- `FREQUENT_FOCUS_LOSS`: Frequent navigation away from exam interface ($\ge 4$ switches).
- `PROLONGED_FACE_ABSENCE`: Candidate face absent across multiple intervals ($\ge 3$ times).

### 4.3 Unsupervised Isolation Forest & Blended Scoring
- An unsupervised Scikit-learn `IsolationForest` model evaluates the feature vector against normal candidate baseline distributions.
- Scores are combined: **65% Deterministic Rules + 35% Isolation Forest ML Score**.
- Mapped to risk tiers:
  - `0.0 – 24.9`: **LOW**
  - `25.0 – 49.9`: **MEDIUM**
  - `50.0 – 74.9`: **HIGH**
  - `75.0 – 100.0`: **CRITICAL**

---

## 5. Human-in-the-Loop Governance & Ethics

> [!IMPORTANT]
> ProctorAI strictly enforces the principle that web-based proctoring telemetry constitutes **explainable indicators** to assist human review, **never autonomous proof of cheating**.

1. **Informed Consent**: Explicit user authorization is required for webcam and screen share streams.
2. **Examiner Review Records**: All final disciplinary decisions (`CLEARED`, `FLAGGED_FOR_INQUIRY`, `DISQUALIFIED`) require human examiner sign-off and mandatory justification notes stored in the `review_records` table.
3. **Privacy Compliance**: No raw keystrokes, passwords, or personal external tab URLs are inspected or stored.
