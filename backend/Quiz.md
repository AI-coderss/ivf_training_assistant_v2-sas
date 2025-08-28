
# Adaptive Quizzes Backend (MongoDB + Qdrant + OpenAI)

A single-file Flask backend that powers an adaptive, RAG-grounded quiz platform with streaming AI feedback, gamification, and live chat.

---

## What’s Included

* **Sessions**
  `POST /api/session/start`, `GET /api/session/next_question`, `POST /api/session/submit_attempt`, `POST /api/session/finalize`
* **Adaptive engine**
  Difficulty from skill (Starter/Medium/Difficult), Elo-like updates, topic rotation to weak areas
* **De-dup / Cooldown**
  SHA-1 question hash, **14-day** cooldown per user (configurable)
* **RAG**
  Qdrant retrieval + OpenAI question composer, **citations** in payload
* **Gamification**
  Streaks, XP, badge hooks
* **Leaderboard**
  `GET /api/leaderboard` (ranks by total XP)
* **AI Feedback (streaming)**
  `POST /quiz-feedback-stream` returns **chunked plain text** (works with `response.body.getReader()`)
* **Live Chat**
  Socket.IO (`join`, `leave`, `message`)
* **Seeder**
  `python server.py --seed ./docs` to embed a corpus to Qdrant
* **MongoDB only**
  (no SQLite), IDs stored as strings to avoid ObjectId hassles

---

## Requirements

Create `requirements.txt` with:

```txt
flask==3.0.3
flask-cors==4.0.0
flask-socketio==5.3.6
python-socketio==5.11.2
python-engineio==4.9.1

pymongo==4.8.0

qdrant-client==1.9.1

openai==1.43.0
tiktoken==0.7.0

python-dotenv==1.0.1
```

---

## Environment

Create `.env` (based on this example):

```env
# --- OpenAI ---
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# --- Qdrant (your naming) ---
QUADRANT_HOST=http://localhost:6333
QUADRANT_API_KEY=
COLLECTION_NAME=quiz_corpus

# --- MongoDB ---
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=quizzes

# --- Flask / CORS ---
SECRET_KEY=change-me
ALLOWED_ORIGINS=*

# --- Engine knobs ---
SUBMIT_COOLDOWN_SEC=1
QUESTION_COOLDOWN_DAYS=14

# --- Logs ---
LOG_DIR=./logs
```

**Notes**

* `QUADRANT_HOST` can be a URL (e.g., `http://host:6333`) or a raw host (e.g., `qdrant.mydomain.com`).
* Use `QUADRANT_API_KEY` if your Qdrant requires auth.
* `COLLECTION_NAME` is the Qdrant collection used for RAG.

---

## Quick Start

```bash
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # or create your .env and fill real values
```

**Launch Qdrant (Docker):**

```bash
docker run -p 6333:6333 -v qdrant_storage:/qdrant/storage qdrant/qdrant
```

(Or point `QUADRANT_HOST` to your managed instance.)

**Seed vectors (optional but recommended):**

```bash
python server.py --seed ./docs
```

This will:

1. Read `.txt/.md/.json/.csv/.html/.yaml/.yml` files,
2. Chunk them,
3. Create OpenAI embeddings,
4. Upsert to Qdrant under `COLLECTION_NAME`.

**Run server:**

```bash
python server.py
# http://localhost:8000
```

---

## Endpoints (Frontend Wiring)

### 1) Start Session

**POST** `/api/session/start`
**Body**

```json
{ "name": "Alice", "cohort": "default" }
```

**Response**

```json
{
  "ok": true,
  "session": {
    "session_id": "uuid",
    "skill": 1200.0,
    "xp": 0,
    "streak": 0
  }
}
```

### 2) Next Question

**GET** `/api/session/next_question?session_id=...`
**Response**

```json
{
  "ok": true,
  "question": {
    "id": "uuid",
    "type": "MCQ|TF|CASE",
    "text": "…",
    "options": ["A", "B", "C", "D"],
    "topic": "Pharmacology",
    "difficulty": "Medium",
    "citations": [{ "id": "source.txt", "url": "" }]
  }
}
```

*(Answer index is not exposed.)*

### 3) Submit Attempt / Hint

**POST** `/api/session/submit_attempt`
**Body (MCQ)**

```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "answer_index": 1,
  "elapsed_sec": 34,
  "request_hint": false
}
```

**Body (TF/CASE)**

```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "answer_index": { "text": "your short answer" },
  "elapsed_sec": 40
}
```

**Hint**

```json
{
  "session_id": "uuid",
  "question_id": "uuid",
  "request_hint": true
}
```

**Response (grade)**

```json
{
  "ok": true,
  "session": { "session_id": "uuid", "skill": 1220.5, "xp": 45, "streak": 3 },
  "last_attempts": [{ "topic": "Anatomy", "correct": true, "difficulty": "Starter", "ts": "…" }],
  "totals": { "correct": 12, "incorrect": 4 },
  "events": [],
  "next_available": true
}
```

### 4) Finalize Session

**POST** `/api/session/finalize`
**Body**

```json
{ "session_id": "uuid" }
```

### 5) Leaderboard

**GET** `/api/leaderboard?period=daily|weekly|all_time[&me_name=Alice]`
Ranks by `User.xp` (fast).
**Response**

```json
{ "ok": true, "rows": [{ "user_id": "…", "name": "Alice", "xp": 300, "streak": 5, "skill": 1380 }], "me": null }
```

### 6) Streaming AI Feedback

**POST** `/quiz-feedback-stream`
**Body**

```json
{ "message": "How did I do today?", "session_id": "uuid" }
```

**Response**: *Chunked plain text* stream (not SSE). Your ChatBot reads with:

```js
const reader = response.body.getReader();
```

---

## Socket.IO (Live Chat)

* Connect to `ws://localhost:8000/socket.io/`
* Emit `join` with `{ room, name }`
* Emit `message` with `{ room, from, text }`
* Emit `leave` with `{ room, name }`

---

## Configuration Notes

* **Qdrant**: `QUADRANT_HOST`, `QUADRANT_API_KEY`, `COLLECTION_NAME`
* **MongoDB**: `MONGODB_URI`, `MONGODB_DB`
* **Adaptive knobs**: `SUBMIT_COOLDOWN_SEC`, `QUESTION_COOLDOWN_DAYS`
* **CORS**: `ALLOWED_ORIGINS`

---

## Production Hints

* Set a strong `SECRET_KEY`
* Restrict `ALLOWED_ORIGINS`
* Serve behind HTTPS (Nginx)
* Rate limit public endpoints
* Scale with Gunicorn + Eventlet:

  ```bash
  pip install eventlet gunicorn
  gunicorn -k eventlet -w 1 server:app --bind 0.0.0.0:8000
  ```

---

## Appendix

### `requirements.txt`

(Identical to the top of this README.)

```txt
flask==3.0.3
flask-cors==4.0.0
flask-socketio==5.3.6
python-socketio==5.11.2
python-engineio==4.9.1

pymongo==4.8.0

qdrant-client==1.9.1

openai==1.43.0
tiktoken==0.7.0

python-dotenv==1.0.1
```

### `.env.example`

(Identical to earlier section—copy, rename to `.env`, and edit.)

```env
# --- OpenAI ---
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
EMBED_MODEL=text-embedding-3-small

# --- Qdrant (your naming) ---
QUADRANT_HOST=http://localhost:6333
QUADRANT_API_KEY=
COLLECTION_NAME=quiz_corpus

# --- MongoDB ---
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=quizzes

# --- Flask / CORS ---
SECRET_KEY=change-me
ALLOWED_ORIGINS=*

# --- Engine knobs ---
SUBMIT_COOLDOWN_SEC=1
QUESTION_COOLDOWN_DAYS=14

# --- Logs ---
LOG_DIR=./logs
```
