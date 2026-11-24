# ProctorAI -- Project Blueprint and Development Handoff

**Project type:** Academic major project\
**Platform:** Web-based\
**Project title:** ProctorAI -- Intelligent Online Examination
Monitoring and Anomaly Detection System\
**Primary objective:** Build a full-stack online examination platform
that monitors browser interactions and, with candidate permission,
webcam and shared-screen evidence; detects unusual activity; and
presents explainable alerts to examiners for human review.

------------------------------------------------------------------------

## 1. Project vision and scope

ProctorAI is an online examination platform with integrated proctoring
and anomaly analysis. It should provide:

-   Candidate registration, login, examination listing, examination
    attempts and submission.
-   Examiner/admin authentication and role-based access.
-   Examination creation, question management and results.
-   Browser activity monitoring: tab/page visibility changes, window
    focus loss, fullscreen exits, copy/paste attempts, keyboard
    interaction metadata, mouse behaviour and scrolling.
-   Webcam-based computer vision: face presence, multiple-face
    indications, head pose/gaze indicators and visible mobile-phone
    detection.
-   Optional screen sharing, screen evidence processing and OCR.
-   External AI-tool usage indicators based on observable browser events
    and visible shared-screen evidence.
-   Behavioural anomaly detection and event correlation.
-   Real-time examiner dashboard, event timelines, evidence references
    and review records.

### Important technical limitations

This is a **web-based** application. A normal browser website cannot
reliably inspect all other browser tabs, identify the exact website
opened in another tab, inspect background applications/processes,
inspect browser extensions, or detect AI use on another device. It can
observe its own page becoming hidden or losing focus. Screen sharing is
permission-based and only shows the display surface selected by the
candidate. OCR may identify visible text or websites in shared-screen
evidence, but cannot guarantee detection of all external AI use.

Do not claim that the system can detect every instance of ChatGPT,
Gemini, Claude or other external tool usage. Label these as
**indicators** or **evidence**, not definitive proof.

Unusual mouse movement, fast typing, gaze direction, looking away,
copy/paste, or tab switching are not proof of cheating by themselves.
Generate explainable alerts for human review; do not automatically
disqualify candidates based only on a model score.

Privacy and fairness requirements: - Obtain informed consent before
webcam or screen capture. - Clearly show when camera/screen monitoring
is active. - Minimise collected data and restrict access. - Encrypt
sensitive data in transit and at rest where feasible. - Define
retention/deletion periods. - Provide accessibility accommodations. -
Keep human review and an audit trail for decisions. - Avoid collecting
raw keystrokes or typed passwords; collect only necessary interaction
metadata.

------------------------------------------------------------------------

## 2. Recommended architecture

### High-level components

1.  **Candidate portal -- React + TypeScript**
    -   Login/register
    -   Available exams
    -   Exam instructions and consent
    -   Timed exam and question navigation
    -   Answer saving and submission
    -   Monitoring status indicator
2.  **Examiner/admin portal -- React + TypeScript**
    -   Dashboard
    -   Exam creation and management
    -   Question bank
    -   Candidate attempts and results
    -   Live monitoring dashboard
    -   Event timeline and evidence review
    -   Reports and review decisions
3.  **Main backend -- Node.js + Express + TypeScript**
    -   Authentication and role-based authorization
    -   Examination and question APIs
    -   Attempt and answer APIs
    -   Event ingestion
    -   Evidence metadata
    -   Socket.IO real-time updates
    -   Calls to the Python AI service
4.  **Database -- PostgreSQL + Prisma ORM**
    -   Users, exams, questions, options, attempts, answers
    -   Proctor events, evidence metadata, anomaly scores and review
        records
5.  **AI service -- Python + FastAPI**
    -   OpenCV and MediaPipe for webcam processing
    -   YOLO for object/mobile-phone detection
    -   OCR (e.g. Tesseract) for permitted shared-screen processing
    -   Scikit-learn / XGBoost for anomaly analysis
    -   Behavioural feature extraction and event correlation
6.  **Real-time communication -- Socket.IO**
    -   Send candidate activity and examiner alerts
    -   Keep event ingestion and alert delivery authenticated and scoped
        to the correct exam/session

### Architecture flow

``` text
Candidate Browser
  ├── React examination UI
  ├── Browser event collector
  ├── Optional webcam capture (permission-based)
  └── Optional screen sharing (permission-based)
             |
             v
      Node.js / Express API
       ├── Authentication / RBAC
       ├── Exam and answer services
       ├── Event ingestion
       ├── Socket.IO
       └── AI service client
             |
       ┌─────┴───────────┐
       v                 v
 PostgreSQL         Python FastAPI
 (Prisma)            AI service
       |                 |
       |          ┌──────┼─────────┐
       |          v      v         v
       |        CV      OCR     Anomaly ML
       |          └──────┼─────────┘
       |                 |
       └──────────┬──────┘
                  v
         Examiner Dashboard
     Live alerts / timeline / evidence
        / scores / human review
```

### Technology stack

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                React + Vite +          Candidate and examiner
                          TypeScript              interfaces

  Styling                 Tailwind CSS            Responsive UI

  Routing                 React Router            Page navigation

  API client              Axios                   HTTP requests

  Forms                   React Hook Form + Zod   Form handling and
                                                  validation

  Icons                   Lucide React            UI icons

  Charts                  Recharts                Analytics

  Backend                 Node.js + Express +     Main API
                          TypeScript              

  Database                PostgreSQL              Persistent data

  ORM                     Prisma                  Database access and
                                                  migrations

  Authentication          bcryptjs + JWT          Password hashing and
                                                  authentication

  Real-time               Socket.IO               Live alerts and events

  AI service              Python + FastAPI        AI processing

  Computer vision         OpenCV + MediaPipe      Face/head analysis

  Object detection        YOLO                    Mobile-phone/object
                                                  detection

  OCR                     Tesseract               Screen text recognition

  ML                      Scikit-learn + XGBoost  Anomaly detection

  Deployment              Docker                  Packaging and local
                                                  deployment
  -----------------------------------------------------------------------

For an academic prototype, do not introduce Kafka, Kubernetes, Redis or
distributed infrastructure unless a demonstrated requirement emerges.

------------------------------------------------------------------------

## 3. Functional modules

  -----------------------------------------------------------------------
  Module                  Features                Planned phase
  ----------------------- ----------------------- -----------------------
  Authentication          Registration, login,    1
                          JWT, roles              

  Exam management         Create, edit, publish   1
                          and archive exams       

  Question management     MCQ and descriptive     1
                          questions               

  Candidate examination   Timer, navigation,      1
                          answers, submission     

  Browser monitoring      Tab visibility, focus,  2
                          fullscreen, copy/paste  

  Mouse/keyboard          Movement summaries,     2
  analytics               interaction timing,     
                          scroll patterns         

  Webcam monitoring       Face presence, multiple 3
                          faces, head pose/gaze   
                          indicators              

  Mobile phone detection  YOLO object detection   3
                          on permitted camera     
                          frames                  

  Screen monitoring       User-authorised screen  4
                          share and OCR           

  External AI indicators  Correlate focus loss    4
                          and visible             
                          shared-screen evidence  

  Anomaly detection       Rules, event            5
                          correlation, Isolation  
                          Forest                  

  Examiner dashboard      Live alerts, timeline,  6
                          evidence and review     

  Reporting               Results and proctoring  6
                          reports                 
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Database design

Use UUID primary keys, foreign keys, indexes for common queries, and UTC
timestamps.

### Entity relationships

``` mermaid
erDiagram
    USERS ||--o{ EXAMS : creates
    USERS ||--o{ EXAM_ATTEMPTS : takes
    EXAMS ||--o{ QUESTIONS : contains
    EXAMS ||--o{ EXAM_ATTEMPTS : has
    QUESTIONS ||--o{ OPTIONS : has
    EXAM_ATTEMPTS ||--o{ ANSWERS : contains
    QUESTIONS ||--o{ ANSWERS : answered_in
    EXAM_ATTEMPTS ||--o{ PROCTOR_EVENTS : generates
    EXAM_ATTEMPTS ||--o{ ANOMALY_SCORES : receives
    PROCTOR_EVENTS ||--o{ EVIDENCE : supports
    EXAM_ATTEMPTS ||--o{ REVIEW_RECORDS : reviewed_in
    USERS ||--o{ REVIEW_RECORDS : reviews
```

### Tables

  -----------------------------------------------------------------------
  Table                               Purpose
  ----------------------------------- -----------------------------------
  `users`                             Candidates, examiners and
                                      administrators

  `exams`                             Exam metadata and schedule

  `questions`                         MCQ and descriptive questions

  `options`                           MCQ options and correct answer
                                      (never expose correctness before
                                      submission)

  `exam_attempts`                     Candidate exam sessions

  `answers`                           Candidate responses

  `proctor_events`                    Browser, webcam and other
                                      monitoring events

  `evidence`                          Secure evidence file
                                      metadata/references

  `anomaly_scores`                    Model score, risk level and
                                      explanation

  `review_records`                    Examiner review decision and notes
  -----------------------------------------------------------------------

### Suggested fields

**users** - id - full_name - email (unique) - password_hash - role -
created_at - updated_at

**exams** - id - title - description - duration_minutes - start_time -
end_time - status - total_marks - created_by - created_at - updated_at

**questions** - id - exam_id - question_text - question_type - marks -
order_number

**options** - id - question_id - option_text - is_correct

**exam_attempts** - id - exam_id - candidate_id - started_at -
submitted_at - status - total_score

**answers** - id - attempt_id - question_id - answer_text -
selected_option_id - marks_awarded

**proctor_events** - id - attempt_id - event_type - severity - metadata
(JSON) - created_at

**evidence** - id - attempt_id - event_id - file_path - file_type -
created_at

**anomaly_scores** - id - attempt_id - score - risk_level - explanation
(JSON) - model_version - created_at

**review_records** - id - attempt_id - reviewer_id - decision - notes -
created_at

### Prisma schema

Use Prisma 6 for the initial project setup to match this schema
configuration. In `backend/prisma/schema.prisma`:

``` prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  EXAMINER
  CANDIDATE
}

enum ExamStatus {
  DRAFT
  PUBLISHED
  COMPLETED
  ARCHIVED
}

enum QuestionType {
  MCQ
  DESCRIPTIVE
}

enum AttemptStatus {
  IN_PROGRESS
  SUBMITTED
  AUTO_SUBMITTED
  EVALUATED
}

enum EventSeverity {
  INFO
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model User {
  id           String         @id @default(uuid())
  fullName     String
  email        String         @unique
  passwordHash String
  role         UserRole       @default(CANDIDATE)
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  examsCreated Exam[]         @relation("ExamCreator")
  attempts     ExamAttempt[]
  reviews      ReviewRecord[]
}

model Exam {
  id              String       @id @default(uuid())
  title           String
  description     String?
  durationMinutes Int
  startTime       DateTime?
  endTime         DateTime?
  status          ExamStatus   @default(DRAFT)
  totalMarks      Float        @default(0)
  createdBy       String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  creator         User         @relation("ExamCreator", fields: [createdBy], references: [id])
  questions       Question[]
  attempts        ExamAttempt[]
}

model Question {
  id           String       @id @default(uuid())
  examId       String
  questionText String
  questionType QuestionType
  marks        Float        @default(1)
  orderNumber  Int
  createdAt    DateTime     @default(now())

  exam         Exam         @relation(fields: [examId], references: [id], onDelete: Cascade)
  options      Option[]
  answers      Answer[]
}

model Option {
  id         String   @id @default(uuid())
  questionId String
  optionText String
  isCorrect  Boolean  @default(false)

  question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  answers    Answer[]
}

model ExamAttempt {
  id          String        @id @default(uuid())
  examId      String
  candidateId String
  startedAt   DateTime      @default(now())
  submittedAt DateTime?
  status      AttemptStatus @default(IN_PROGRESS)
  totalScore  Float?

  exam        Exam          @relation(fields: [examId], references: [id])
  candidate   User          @relation(fields: [candidateId], references: [id])
  answers     Answer[]
  events      ProctorEvent[]
  scores      AnomalyScore[]
  evidence    Evidence[]
  reviews     ReviewRecord[]

  @@unique([examId, candidateId])
  @@index([candidateId, status])
}

model Answer {
  id               String      @id @default(uuid())
  attemptId        String
  questionId       String
  answerText       String?
  selectedOptionId String?
  marksAwarded    Float?

  attempt          ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question         Question    @relation(fields: [questionId], references: [id])
  selectedOption   Option?     @relation(fields: [selectedOptionId], references: [id])

  @@unique([attemptId, questionId])
}

model ProctorEvent {
  id        String        @id @default(uuid())
  attemptId String
  eventType String
  severity  EventSeverity @default(INFO)
  metadata  Json?
  createdAt DateTime      @default(now())

  attempt   ExamAttempt   @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  evidence  Evidence[]

  @@index([attemptId, createdAt])
  @@index([eventType])
}

model Evidence {
  id        String       @id @default(uuid())
  attemptId String
  eventId   String?
  filePath  String?
  fileType  String?
  createdAt DateTime     @default(now())

  attempt   ExamAttempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  event     ProctorEvent? @relation(fields: [eventId], references: [id])
}

model AnomalyScore {
  id           String      @id @default(uuid())
  attemptId    String
  score        Float
  riskLevel    RiskLevel
  explanation  Json?
  modelVersion String?
  createdAt    DateTime    @default(now())

  attempt      ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

  @@index([attemptId, createdAt])
}

model ReviewRecord {
  id         String      @id @default(uuid())
  attemptId  String
  reviewerId String
  decision   String
  notes      String?
  createdAt  DateTime    @default(now())

  attempt    ExamAttempt @relation(fields: [attemptId], references: [id])
  reviewer   User        @relation(fields: [reviewerId], references: [id])
}
```

Before running migrations, validate the schema with `npx prisma format`
and `npx prisma validate`. Add appropriate database constraints and
validation in application services. The server must never send
`Option.isCorrect` to a candidate before submission. Descriptive answers
require manual evaluation in the academic prototype.

------------------------------------------------------------------------

## 5. Monorepo folder structure

``` text
proctor-ai/
│
├── frontend/
│   ├── public/
│   └── src/
│       ├── assets/
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── exam/
│       │   └── dashboard/
│       ├── pages/
│       │   ├── auth/
│       │   ├── candidate/
│       │   ├── examiner/
│       │   └── admin/
│       ├── hooks/
│       ├── services/
│       ├── context/
│       ├── types/
│       ├── utils/
│       ├── App.tsx
│       └── main.tsx
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── sockets/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   └── package.json
│
├── ai-service/
│   ├── app/
│   │   ├── api/
│   │   ├── detection/
│   │   ├── behaviour/
│   │   ├── anomaly/
│   │   ├── ocr/
│   │   ├── models/
│   │   ├── schemas/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
│
├── docs/
│   ├── architecture.md
│   ├── api-documentation.md
│   └── database-design.md
│
├── storage/
│   └── .gitkeep
│
├── .gitignore
├── README.md
└── docker-compose.yml
```

Do not create large numbers of empty files. Add modules as each phase is
implemented.

------------------------------------------------------------------------

## 6. Development roadmap

Suggested academic prototype schedule: approximately eight weeks,
depending on available development time.

  -----------------------------------------------------------------------
  Week                    Phase                   Deliverables
  ----------------------- ----------------------- -----------------------
  1                       Phase 1 -- Core         Authentication, roles,
                          examination platform    exams, questions,
                                                  attempts, answers and
                                                  submission

  2                       Phase 2 -- Browser      Tab visibility, focus,
                          monitoring              mouse, keyboard
                                                  metadata, scroll and
                                                  event logging

  3                       Phase 3 -- Webcam AI    Face presence,
                                                  multiple-face
                                                  indication, head pose
                                                  and mobile phone
                                                  detection

  4                       Phase 4 -- Screen       User-authorised screen
                          monitoring              sharing, OCR and
                                                  external AI usage
                                                  indicators

  5                       Phase 5 -- Anomaly      Feature extraction,
                          detection               rule engine, Isolation
                                                  Forest and explainable
                                                  risk scoring

  6                       Phase 6 -- Live         Socket.IO alerts, event
                          dashboard               timelines, evidence
                                                  review and examiner
                                                  controls

  7                       Integration and testing End-to-end testing,
                                                  false-positive
                                                  evaluation, security
                                                  and performance

  8                       Deployment and          Docker, deployment,
                          documentation           report, diagrams and
                                                  demonstration
  -----------------------------------------------------------------------

### Phase 1 -- Core examination platform

Expected workflow:

1.  Administrator provisions admin/examiner accounts.
2.  Examiner logs in.
3.  Examiner creates an examination.
4.  Examiner adds MCQ and descriptive questions.
5.  Examiner publishes the examination.
6.  Candidate registers and logs in.
7.  Candidate sees available examinations.
8.  Candidate starts an examination.
9.  Candidate answers questions and saves responses.
10. Candidate submits the examination.
11. Backend calculates MCQ marks.
12. Examiner views submissions and results.

Phase 1 is complete only when the complete workflow works end-to-end.

### Phase 1 API plan

  Method   Endpoint                      Purpose
  -------- ----------------------------- ------------------------
  POST     `/api/auth/register`          Candidate registration
  POST     `/api/auth/login`             Login
  GET      `/api/auth/me`                Current user
  POST     `/api/exams`                  Create exam
  GET      `/api/exams`                  List exams
  GET      `/api/exams/:id`              Get exam
  POST     `/api/exams/:id/questions`    Add question
  POST     `/api/attempts`               Start exam
  GET      `/api/attempts/:id`           Get attempt
  POST     `/api/attempts/:id/answers`   Save answer
  POST     `/api/attempts/:id/submit`    Submit exam
  GET      `/api/exams/:id/results`      View results

All endpoints must enforce authentication, role permissions and resource
ownership. Candidates must not access another candidate's attempt or
answers.

### Phase 1 frontend routes

  Route                      Page                     Access
  -------------------------- ------------------------ -----------
  `/login`                   Login                    Public
  `/register`                Candidate registration   Public
  `/admin`                   Admin dashboard          Admin
  `/examiner`                Examiner dashboard       Examiner
  `/examiner/exams`          Exam management          Examiner
  `/examiner/exams/create`   Create exam              Examiner
  `/candidate`               Candidate dashboard      Candidate
  `/candidate/exam/:id`      Exam interface           Candidate
  `/candidate/results/:id`   Candidate result         Candidate

### Phase 1 acceptance checklist

-   [ ] PostgreSQL database created.
-   [ ] Prisma migrations completed.
-   [ ] Backend starts without errors.
-   [ ] Health API returns success.
-   [ ] Candidate registration works.
-   [ ] Candidate login works.
-   [ ] JWT authentication works.
-   [ ] Role-based restrictions work.
-   [ ] Examiner can create an exam.
-   [ ] Examiner can add questions.
-   [ ] Candidate can start an exam.
-   [ ] Candidate can save answers.
-   [ ] Candidate can submit an exam.
-   [ ] Examiner can view results.

------------------------------------------------------------------------

## 7. Phase 1 setup instructions

### Prerequisites

Install: - Node.js LTS - PostgreSQL - Git - VS Code

Check installation in Windows PowerShell:

``` powershell
node --version
npm --version
git --version
```

### Create monorepo

``` powershell
mkdir proctor-ai
cd proctor-ai

mkdir frontend
mkdir backend
mkdir ai-service
mkdir docs
mkdir storage

git init
```

### Frontend setup

``` powershell
cd frontend

npm create vite@latest . -- --template react-ts
npm install

npm install axios react-router-dom
npm install lucide-react recharts
npm install react-hook-form zod @hookform/resolvers

npm install -D tailwindcss @tailwindcss/vite
```

### Backend setup

Open another terminal:

``` powershell
cd proctor-ai/backend

npm init -y

npm install express cors dotenv bcryptjs jsonwebtoken
npm install @prisma/client@6 zod

npm install -D typescript tsx prisma@6
npm install -D @types/node @types/express
npm install -D @types/cors @types/jsonwebtoken

npx tsc --init
npx prisma init --datasource-provider postgresql
```

Use Prisma 6 for this initial setup. Keep `url = env("DATABASE_URL")` in
the Prisma datasource block.

In `backend/package.json`, configure scripts:

``` json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  }
}
```

### PostgreSQL database

Create database:

``` sql
CREATE DATABASE proctor_ai;
```

Create `backend/.env`:

``` env
PORT=5000
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/proctor_ai"
JWT_SECRET="replace_with_a_long_random_secret"
CLIENT_URL="http://localhost:5173"
```

Replace the username and password with the actual PostgreSQL
credentials. Never commit `.env` to Git.

### Initial backend files

Create:

``` text
backend/src/
├── config/
│   └── database.ts
├── controllers/
├── middleware/
├── routes/
├── services/
├── app.ts
└── server.ts
```

`src/config/database.ts`:

``` typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

`src/app.ts`:

``` typescript
import express from "express";
import cors from "cors";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173"
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "ProctorAI backend is running",
    timestamp: new Date().toISOString()
  });
});

export default app;
```

`src/server.ts`:

``` typescript
import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { prisma } from "./config/database";

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(`ProctorAI API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
```

Start backend:

``` powershell
npm run dev
```

Verify:

`http://localhost:5000/api/health`

Expected response:

``` json
{
  "success": true,
  "message": "ProctorAI backend is running"
}
```

### Prisma migration

After adding the complete schema:

``` powershell
npx prisma format
npx prisma validate
npx prisma migrate dev --name initial_schema
npx prisma generate
```

### Authentication implementation

Create:

``` text
backend/src/
├── controllers/
│   └── auth.controller.ts
├── middleware/
│   └── auth.middleware.ts
├── routes/
│   └── auth.routes.ts
└── services/
    └── auth.service.ts
```

Authentication requirements: - Hash passwords with bcrypt. - Validate
all request payloads with Zod. - Use JWT authentication and role-based
middleware. - Public registration must always create a CANDIDATE. -
Admin and examiner accounts must be provisioned through a protected
administrative process. - Do not expose raw database errors or stack
traces. - Add rate limiting and secure token handling before
deployment. - Enforce resource ownership on all attempt and answer
endpoints.

Example authentication service:

``` typescript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function registerUser(data: {
  fullName: string;
  email: string;
  password: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  });

  if (existingUser) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  return prisma.user.create({
    data: {
      fullName: data.fullName,
      email: data.email,
      passwordHash,
      role: "CANDIDATE"
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true
    }
  });
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    }
  };
}
```

Example controller:

``` typescript
import { Request, Response } from "express";
import * as authService from "../services/auth.service";

export async function register(req: Request, res: Response) {
  try {
    const user = await authService.registerUser(req.body);
    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.loginUser(
      req.body.email,
      req.body.password
    );

    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      message: error.message
    });
  }
}
```

Example routes:

``` typescript
import { Router } from "express";
import { register, login } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);

export default router;
```

Register in `app.ts`:

``` typescript
import authRoutes from "./routes/auth.routes";

app.use("/api/auth", authRoutes);
```

This is a starting implementation. Add validation, JWT secret checks,
rate limiting and secure cookie/token strategy before treating it as
production-ready.

------------------------------------------------------------------------

## 8. Phase 2 -- Browser activity monitoring design

Implement a client-side monitoring service in the examination page.
Record structured, timestamped events.

Events to observe: - Page visibility changes (`visibilitychange`). -
Window focus and blur. - Fullscreen changes. - Copy and paste
attempts. - Context-menu attempts. - Scroll timing and magnitude. -
Mouse movement summaries (avoid storing every raw coordinate
unnecessarily). - Keyboard interaction metadata (do not record passwords
or unrestricted typed content).

Example starter code:

``` javascript
const logEvent = async (eventType, details = {}) => {
  await fetch("/api/proctor/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType,
      details,
      timestamp: new Date().toISOString()
    })
  });
};

document.addEventListener("visibilitychange", () => {
  logEvent(document.hidden ? "TAB_HIDDEN" : "TAB_VISIBLE");
});

window.addEventListener("blur", () => {
  logEvent("WINDOW_BLUR");
});

window.addEventListener("focus", () => {
  logEvent("WINDOW_FOCUS");
});

document.addEventListener("copy", () => {
  logEvent("COPY_ATTEMPT");
});

document.addEventListener("paste", () => {
  logEvent("PASTE_ATTEMPT");
});
```

This is only a starter. Add authenticated event ingestion, batching,
throttling, server timestamps, duplicate handling and error handling. A
hidden page or focus loss does not identify which external application
or website was opened.

Example event record:

``` json
{
  "attemptId": "candidate-session-id",
  "eventType": "TAB_HIDDEN",
  "timestamp": "2026-11-24T10:30:00Z",
  "metadata": {
    "source": "browser_visibility_api"
  }
}
```

------------------------------------------------------------------------

## 9. Phase 3 -- Webcam and computer vision

Use explicit camera permission and a visible camera-active indicator.

Potential detections: - Face present / absent. - Multiple faces
visible. - Head pose and gaze direction indicators. - Mobile phone
visible in camera frame. - Candidate presence over time.

Suggested technologies: - Browser MediaDevices API for camera
permission. - MediaPipe Face Landmarker for facial landmarks and
head-related features. - OpenCV for image processing. - YOLO for
phone/object detection.

Do not treat gaze or looking away as proof of misconduct. Evaluate
detection accuracy and false positives using representative test data.

------------------------------------------------------------------------

## 10. Phase 4 -- Screen sharing, OCR and external AI indicators

Use the browser Screen Capture API (`getDisplayMedia`) only after the
candidate explicitly chooses to share a screen.

Potential processing: - Show clear screen-sharing status. - Process
permitted frames. - OCR visible text using Tesseract. - Detect visible
browser/domain indicators where legible. - Identify visible AI assistant
interfaces as possible indicators. - Save only necessary evidence with
timestamps and consent.

Limitations: - The candidate chooses the shared display surface. -
Screen sharing can be stopped by the candidate/browser. - Hidden
windows, other devices and unshared screens are not visible. - OCR and
visual classification can be wrong. - Do not claim guaranteed detection
of external AI tools.

------------------------------------------------------------------------

## 11. Phase 5 -- Anomaly detection

Start with a transparent rule-based engine and then evaluate Isolation
Forest. Add supervised models only after collecting sufficiently
representative, labelled data.

Potential features: - Number of tab-hidden events. - Total focus-loss
duration. - Repeated focus-loss frequency. - Copy/paste event counts. -
Scroll frequency and timing statistics. - Mouse movement summaries. -
Face-absence duration. - Multiple-face detections. - Phone detection
events. - OCR-based visible external-tool indicators.

Possible algorithms: - Rule-based detection: known event patterns. -
Isolation Forest: unusual behavioural feature combinations. - Random
Forest / XGBoost: supervised classification if labelled data is
available. - LSTM: optional sequence analysis if enough time-series data
exists.

Use a risk score as a prioritisation aid, not as a probability of
cheating. Store the score, model version, contributing signals and
explanation. Calibrate thresholds on test data and measure
false-positive and false-negative rates.

Example event correlation:

1.  Candidate page becomes hidden.
2.  Focus is lost for an extended period.
3.  Candidate returns.
4.  A paste event occurs.
5.  Shared-screen evidence, if available, visibly shows an external AI
    assistant.

This combination can be marked for high-priority human review. It still
does not automatically prove misconduct.

------------------------------------------------------------------------

## 12. Phase 6 -- Real-time examiner dashboard

Use Socket.IO for authenticated, exam-scoped real-time updates.

Dashboard features: - Active candidate sessions. - Monitoring
permission/status indicators. - Latest event and timestamp. - Candidate
activity timeline. - Event severity and explanation. - Anomaly score and
contributing signals. - Evidence preview with access controls. -
Examiner review decision and notes. - Exportable exam report.

Keep a distinction between: - **Observed event:** e.g. browser page
became hidden. - **Model inference:** e.g. behaviour is unusual compared
with a baseline. - **Examiner decision:** human assessment after
reviewing evidence.

------------------------------------------------------------------------

## 13. Testing and evaluation

Test each module independently and then end-to-end.

### Phase 1

-   Registration and login.
-   Role restrictions.
-   Exam creation and publishing.
-   Question creation.
-   Attempt start and server-side timer.
-   Answer saving and submission.
-   MCQ scoring.
-   Examiner results access.

### Monitoring

-   Tab visibility and focus events.
-   Event timestamps and ordering.
-   Scroll/mouse event throttling.
-   Camera permission denied/granted.
-   Screen sharing started/stopped.
-   OCR accuracy on permitted sample screens.
-   Phone detection under different lighting and angles.

### ML evaluation

-   Precision, recall and F1-score for labelled events.
-   False-positive rate.
-   False-negative rate.
-   Confusion matrix.
-   Per-event-type performance.
-   Human review agreement where feasible.

Use simulated and consented test sessions. Do not label every unusual
action as cheating.

------------------------------------------------------------------------

## 14. Design expectations

Build a clean, professional, responsive academic SaaS interface: -
Consistent typography and spacing. - Neutral background with restrained
blue accent. - Clear candidate/examiner/admin role separation. -
Accessible contrast and keyboard navigation. - Responsive tables, cards
and charts. - Clear monitoring/permission status. - Avoid excessive
gradients, decorative AI imagery and clutter.

Primary pages: 1. Login and registration. 2. Admin dashboard. 3.
Examiner dashboard. 4. Exam management and question editor. 5. Candidate
dashboard. 6. Candidate exam interface. 7. Live proctoring dashboard. 8.
Candidate event timeline and evidence review. 9. Results and reports.

------------------------------------------------------------------------

## 15. Instructions for the coding agent

You are the implementation agent for **ProctorAI**. Use this document as
the project specification.

### Mandatory working approach

1.  Inspect the existing repository before making changes.
2.  Do not overwrite existing working code without inspecting it.
3.  Implement the project incrementally, phase by phase.
4.  Start with Phase 1 only.
5.  Set up and verify the database, backend and frontend.
6.  Build a complete working authentication and examination workflow.
7.  Test each feature before moving to the next.
8.  Keep the code modular, typed, readable and documented.
9.  Use environment variables for secrets and configuration.
10. Include `.env.example`, `.gitignore` and setup instructions.
11. Never hardcode passwords, JWT secrets or database credentials.
12. Enforce backend role-based authorization and resource ownership.
13. Do not expose correct MCQ answers to candidates before submission.
14. Enforce examination deadlines on the server.
15. Add input validation and useful error handling.
16. Do not create fake AI detections or fabricated dashboard metrics.
17. Do not claim browser-based detection can identify every external AI
    tool.
18. Obtain consent for camera and screen sharing.
19. Keep model outputs explainable and subject to human review.
20. After each milestone, report files created/changed, commands run,
    tests passed/failed, known issues and the exact next step.

### First task for the agent

Begin by checking the local environment and repository. Determine
whether Node.js, npm, Git and PostgreSQL are installed and accessible.
Do not assume PostgreSQL is installed.

Then: 1. Create or inspect the `proctor-ai` monorepo. 2. Set up the
React + TypeScript + Vite frontend. 3. Set up the Express + TypeScript
backend. 4. Configure PostgreSQL and Prisma 6. 5. Add the database
schema and run migrations. 6. Implement health check and authentication
with secure role handling. 7. Build the Phase 1 candidate and examiner
interfaces. 8. Implement exam creation, question management, attempts,
answers, submission and MCQ scoring. 9. Test the full workflow. 10. Stop
after Phase 1 and provide a completion report before starting Phase 2.

**Do not attempt to build every AI module in one pass. A reliable,
working examination platform is the foundation for the complete
ProctorAI system.**
