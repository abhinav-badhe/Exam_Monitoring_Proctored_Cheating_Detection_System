# ProctorAI API Reference Documentation

All endpoints are prefixed with `/api`. Authentication is handled via Bearer JWT tokens in the `Authorization` header: `Authorization: Bearer <TOKEN>`.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Registers a new user account.
- **Request Body:**
  ```json
  {
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password@123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "fullName": "Jane Doe", "email": "jane@example.com", "role": "CANDIDATE" },
      "token": "eyJhbGciOiJIUzI1Ni..."
    }
  }
  ```

### `POST /api/auth/login`
Authenticates an existing user.
- **Request Body:**
  ```json
  {
    "email": "examiner@proctorai.local",
    "password": "ExaminerPass@123"
  }
  ```

---

## 2. Examination Endpoints (`/api/exams`)

### `GET /api/exams`
Retrieves exams accessible to the authenticated user.
- Candidates see only `PUBLISHED` exams.
- Examiners see their created exams. Admins see all exams.

### `POST /api/exams`
*(Examiner/Admin only)* Creates a new exam in `DRAFT` status.
- **Request Body:**
  ```json
  {
    "title": "Computer Systems Architecture",
    "description": "Midterm proctored examination",
    "durationMinutes": 60
  }
  ```

### `PUT /api/exams/:id`
*(Examiner/Admin only)* Updates exam details or status (`DRAFT` / `PUBLISHED` / `CLOSED`).

### `POST /api/exams/:id/questions`
*(Examiner/Admin only)* Adds a question and options to an exam.
- **Request Body:**
  ```json
  {
    "questionText": "What does CPU stand for?",
    "marks": 5,
    "questionType": "MCQ",
    "options": [
      { "optionText": "Central Processing Unit", "isCorrect": true },
      { "optionText": "Computer Personal Unit", "isCorrect": false }
    ]
  }
  ```

---

## 3. Exam Attempt & Candidate Endpoints (`/api/attempts`)

### `POST /api/attempts`
*(Candidate only)* Starts or resumes an exam attempt.
- **Request Body:** `{ "examId": "<uuid>" }`

### `GET /api/attempts/:id`
*(Candidate only)* Retrieves current attempt questions and remaining seconds. `isCorrect` flags are stripped.

### `POST /api/attempts/:id/answers`
*(Candidate only)* Saves or updates an answer for a specific question.
- **Request Body:**
  ```json
  {
    "questionId": "<uuid>",
    "selectedOptionId": "<uuid>"
  }
  ```

### `POST /api/attempts/:id/submit`
*(Candidate only)* Finalizes and grades attempt. Automatically triggers behavioural anomaly evaluation.

### `GET /api/attempts/exam/:examId/results`
*(Examiner/Admin only)* Retrieves all candidate attempts, scores, proctor event tallies, anomaly risk scores, and human review verdicts.

### `POST /api/attempts/:id/reviews`
*(Examiner/Admin only)* Records human examiner review verdict.
- **Request Body:**
  ```json
  {
    "decision": "CLEARED" | "FLAGGED_FOR_INQUIRY" | "DISQUALIFIED",
    "notes": "Detailed examiner observations and audit justification"
  }
  ```

---

## 4. Proctoring Telemetry Endpoints (`/api/proctor`)

### `POST /api/proctor/events`
*(Candidate only)* Batched ingestion of browser monitoring events.
- **Request Body:**
  ```json
  {
    "attemptId": "<uuid>",
    "events": [
      {
        "eventType": "WINDOW_BLUR",
        "severity": "MEDIUM",
        "timestamp": "2026-11-24T10:00:00.000Z",
        "metadata": { "reason": "Window focus lost" }
      }
    ]
  }
  ```

### `POST /api/proctor/attempts/:attemptId/frame`
*(Candidate only)* Uploads webcam frame for OpenCV / YOLOv8 computer vision analysis. Saves high-confidence anomaly frames to `storage/evidence/`.

### `POST /api/proctor/attempts/:attemptId/screen-frame`
*(Candidate only)* Uploads shared screen frame for EasyOCR analysis of external AI assistants and study platforms.

### `GET /api/proctor/attempts/:attemptId/events`
*(Examiner/Admin/Candidate owner)* Returns chronological audit trail of all proctoring events with severity counts.

### `POST /api/proctor/attempts/:attemptId/evaluate-anomaly`
*(Examiner/Admin/Candidate owner)* Triggers on-demand feature extraction, rule engine execution, and Isolation Forest scoring.

---

## 5. Socket.IO Real-Time Events

### Examiner Namespace
- **Emit `join:exam` (`examId`)**: Joins exam proctoring room.
- **Listen `exam:proctor_alert`**: Receives live candidate anomalies.
- **Emit `examiner:warn_candidate` (`{ attemptId, examId, warningMessage }`)**: Dispatches direct warning.

### Candidate Namespace
- **Emit `join:attempt` (`attemptId`)**: Joins attempt room.
- **Listen `candidate:warning`**: Receives high-priority examiner warning.
