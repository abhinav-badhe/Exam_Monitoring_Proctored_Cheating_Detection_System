# ProctorAI: Intelligent Multi-Modal Online Examination Proctoring System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-teal.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-indigo.svg)](https://www.prisma.io/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-orange.svg)](https://github.com/ultralytics/ultralytics)

> **ProctorAI** is a production-grade, multi-tier automated online examination and proctoring platform that monitors browser activity, webcam streams, and shared screens, detects behavioral anomalies using hybrid rule engines and unsupervised Isolation Forest ML, and streams real-time alerts to a human examiner live dashboard.

---

## ⚡ How to Run This Project

Follow these steps to run the complete ProctorAI multi-tier system locally on your machine:

### 1. Prerequisites
- **Node.js**: `v20+` or `v24+` installed
- **Python**: `3.11` or `3.12` installed
- **PostgreSQL**: Running on port `5432` (or Docker)
- **Git**: Installed

---

### 2. Database & Backend Setup

Open a terminal in the project root:

```bash
cd backend
npm install

# Ensure PostgreSQL has database 'proctor_ai' created (e.g. CREATE DATABASE proctor_ai;)
# Configure backend/.env with your DATABASE_URL if needed:
# DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/proctor_ai?schema=public"

# Synchronize database schema and seed default exams & accounts
npx prisma db push
npm run db:seed

# Start the Node.js Express & Socket.IO server
npm run dev
```
> 📡 **Backend Server:** Running on `http://localhost:5000` (Health check: `http://localhost:5000/api/health`)

---

### 3. Python AI Computer Vision Microservice Setup

Open a **second terminal** in the project root:

```bash
cd ai-service

# Create and activate Python virtual environment
# Windows (PowerShell):
python -m venv venv
.\venv\Scripts\activate

# Linux / macOS:
# python3 -m venv venv
# source venv/bin/activate

# Install AI dependencies (MediaPipe, OpenCV, EasyOCR, Scikit-Learn, FastAPI)
pip install -r requirements.txt

# Start the AI perception microservice
python -m uvicorn app.main:app --app-dir . --host 127.0.0.1 --port 8000
```
> 🧠 **AI Perception Service:** Running on `http://127.0.0.1:8000` (Health check: `http://127.0.0.1:8000/health`)

---

### 4. Frontend Client Setup

Open a **third terminal** in the project root:

```bash
cd frontend
npm install

# Start Vite React client
npm run dev
```
> 💻 **Frontend Web App:** Open in browser at **`http://localhost:5173`**

---

### 🐳 Alternative: One-Command Docker Setup
If you have Docker & Docker Compose installed, spin up the entire multi-container stack with one command:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`
- AI Microservice: `http://localhost:8000`

---

### 🔑 Demo Login Accounts

Pre-configured credentials for quick evaluation:

| Role | Email | Password | Access & Capabilities |
| :--- | :--- | :--- | :--- |
| **Examiner** | `examiner@proctorai.local` | `ExaminerPass@123` | Create exams, view live monitoring grid, send warnings, freeze sessions, sign verdicts |
| **Candidate** | `candidate@proctorai.local` | `CandidatePass@123` | Extension pre-check, take proctored exam, view score breakdown & download PDF certificate |
| **Admin** | `admin@proctorai.local` | `AdminPass@123` | System oversight, user management, execute GDPR/FERPA retention compliance purge |

*(Quick-login 1-click buttons are also provided directly on the Login page at `/login`)*

---

## 🌟 Key Capabilities

- **Core Examination System**: Full authentication with Role-Based Access Control (`ADMIN`, `EXAMINER`, `CANDIDATE`), rich MCQ question builder, synced countdown timers, question palette navigation, answer autosave, and automatic grading.
- **Client-Side Browser Monitoring**: Non-intrusive page visibility tracking (`TAB_HIDDEN`), window focus loss (`WINDOW_BLUR`), fullscreen exit prevention, clipboard interception (`COPY_ATTEMPT`/`PASTE_ATTEMPT`), and devtools shortcut interception (`F12`, `Ctrl+Shift+I`).
- **Webcam Computer Vision**: Decoupled Python FastAPI microservice utilizing MediaPipe Face Mesh for absence/multi-face detection, head pose estimation (yaw, pitch, roll tracking for looking-away), and Ultralytics YOLOv8 for real-time mobile device detection.
- **Screen Sharing & OCR Detection**: Authorized display capture (`getDisplayMedia`) with EasyOCR text extraction scanning for unauthorized homework platforms (Chegg, Course Hero) and external generative AI assistants (ChatGPT, Claude, Gemini, Copilot).
- **Behavioural Anomaly Engine**: 11-feature aggregator combining deterministic correlation rules (e.g. Blur-Paste sequences, Phone+Multi-face) with unsupervised Scikit-learn `IsolationForest` scoring (0.0 – 100.0) mapped to explainable risk tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- **Real-Time Examiner Dashboard**: Real-time Socket.IO synchronization with live candidate grid cards, live streaming alert feeds, direct examiner-to-candidate warning dispatch, and official human audit verdicts (`CLEARED`, `FLAGGED_FOR_INQUIRY`, `DISQUALIFIED`).
- **Ethical & Explainable by Design**: Adheres strictly to browser security limitations; all detections are treated as explainable indicators to empower human review rather than autonomous disqualifications.

---

## 🏛️ System Architecture

```
+-------------------------------------------------------------------------------+
|                            React + Vite Frontend                              |
|         Candidate Fullscreen Interface   |   Examiner Live Monitor & Review   |
+----------------------+---------------------------------+----------------------+
                       | HTTP / REST                     | WebSockets (Socket.IO)
                       v                                 v
+-------------------------------------------------------------------------------+
|                            Node.js Express Backend                            |
|             Authentication, Exam Management, Grading, Socket.IO Rooms,        |
|             Telemetry Ingestion, Evidence Preservation, Prisma 6 ORM          |
+----------------------+---------------------------------+----------------------+
                       |                                 |
                       | SQL                             | HTTP Multipart / JSON
                       v                                 v
+------------------------------------+   +-------------------------------------+
|        PostgreSQL Database         |   |      Python FastAPI AI Service      |
|  - Users, Exams, Questions, Options|   |  - MediaPipe Face Mesh & Head Pose  |
|  - Attempts, Answers, Evidence     |   |  - YOLOv8 Cell Phone Detector       |
|  - Proctor Events, Anomaly Scores  |   |  - EasyOCR External Tool Indicators |
|  - Human Examiner Review Records   |   |  - Scikit-Learn Isolation Forest    |
+------------------------------------+   +-------------------------------------+
```

---

## 🧪 Automated Verification Suite

Each module was built and verified synchronously with comprehensive automated test suites:

```bash
# Module 1: Core Exam Flow & Auto-Grading
cd backend && npx tsx src/test-phase1-e2e.ts

# Module 2: Browser Activity Monitoring
cd backend && npx tsx src/test-phase2-e2e.ts

# Module 3: Webcam & Computer Vision (OpenCV/MediaPipe/YOLO)
cd backend && npx tsx src/test-phase3-e2e.ts

# Module 4: Screen Sharing, OCR & AI Tool Indicators
cd backend && npx tsx src/test-phase4-e2e.ts

# Module 5: Behavioural Anomaly Detection (Rules + Isolation Forest)
cd backend && npx tsx src/test-phase5-e2e.ts

# Module 6: Real-Time Socket.IO & Examiner Review
cd backend && npx tsx src/test-phase6-e2e.ts

# Full System Unified Cross-Tier Regression Suite
cd backend && npx tsx src/test-unified-integration.ts
```

---

## 📚 Technical Documentation

- [System Architecture](file:///docs/architecture.md)
- [API Documentation](file:///docs/api-documentation.md)
- [Database Design](file:///docs/database-design.md)
- [Module Execution Roadmap](file:///MODULE_EXECUTION_ROADMAP.md)

---

## ⚖️ License
MIT License. Created for robust, explainable, and privacy-respecting educational assessment integrity.
