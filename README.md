# ProctorAI: Intelligent Multi-Modal Online Examination Proctoring System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.12-teal.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-indigo.svg)](https://www.prisma.io/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-orange.svg)](https://github.com/ultralytics/ultralytics)

> **ProctorAI** is a production-grade, multi-tier automated online examination and proctoring platform that monitors browser activity, webcam streams, and shared screens, detects behavioral anomalies using hybrid rule engines and unsupervised Isolation Forest ML, and streams real-time alerts to a human examiner live dashboard.

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

## 🚀 Quick Start Guide

### Prerequisites
- Node.js `v20+` or `v24+`
- Python `3.11` or `3.12`
- PostgreSQL `16+` (or Docker)

### 1. Database Setup
Ensure PostgreSQL is running locally and create the database:
```sql
CREATE DATABASE proctor_ai;
```

### 2. Backend Setup
```bash
cd backend
npm install
# Set your DATABASE_URL in backend/.env
npx prisma migrate dev --name initial_schema
npm run db:seed
npm run dev
```
Backend will start on `http://localhost:5000`.

### 3. Python AI Microservice Setup
```bash
cd ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
AI Microservice will start on `http://localhost:8000`.

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend will be accessible at `http://localhost:5173`.

---

## 🐳 Docker Deployment

To spin up the entire multi-tier system with PostgreSQL, backend, AI microservice, and frontend:
```bash
docker-compose up --build
```
- Frontend: `http://localhost:80`
- Backend API: `http://localhost:5000`
- Python AI Service: `http://localhost:8000`

---

## 🔑 Demo Seed Accounts

The database seed provides pre-configured credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Examiner** | `examiner@proctorai.local` | `ExaminerPass@123` |
| **Candidate** | `candidate@proctorai.local` | `CandidatePass@123` |
| **Admin** | `admin@proctorai.local` | `AdminPass@123` |

Quick-login demo buttons are also provided directly on the Login page (`/login`).

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
