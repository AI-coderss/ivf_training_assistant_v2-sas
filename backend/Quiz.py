
import os
import re
import sys
import time
import json
import uuid
import glob
import random
import hashlib
import datetime as dt
from typing import List, Optional, Dict, Any, Tuple

from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit

# MongoDB (IDs are strings for simplicity)
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection

# Qdrant + OpenAI
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from qdrant_client.conversions.common_types import Record

try:
    from openai import OpenAI
except Exception:
    import openai as openai_legacy
    OpenAI = None


# ====================== ENV ======================
load_dotenv()

OPENAI_API_KEY         = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL           = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBED_MODEL            = os.getenv("EMBED_MODEL", "text-embedding-3-small")

# Your naming
QUADRANT_HOST          = os.getenv("QUADRANT_HOST", "http://localhost:6333")
QUADRANT_API_KEY       = os.getenv("QUADRANT_API_KEY", None)
COLLECTION_NAME        = os.getenv("COLLECTION_NAME", "quiz_corpus")

# Back-compat (if old names are present)
if not QUADRANT_HOST and os.getenv("QDRANT_URL"):
    QUADRANT_HOST = os.getenv("QDRANT_URL")
if not QUADRANT_API_KEY and os.getenv("QDRANT_API_KEY"):
    QUADRANT_API_KEY = os.getenv("QDRANT_API_KEY")
if not COLLECTION_NAME and os.getenv("QDRANT_COLLECTION"):
    COLLECTION_NAME = os.getenv("QDRANT_COLLECTION")

# MongoDB
MONGODB_URI            = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB             = os.getenv("MONGODB_DB", "quizzes")

SECRET_KEY             = os.getenv("SECRET_KEY", "dev-secret")
ALLOWED_ORIGINS        = os.getenv("ALLOWED_ORIGINS", "*")

SUBMIT_COOLDOWN_SEC    = int(os.getenv("SUBMIT_COOLDOWN_SEC", "1"))
QUESTION_COOLDOWN_DAYS = int(os.getenv("QUESTION_COOLDOWN_DAYS", "14"))

LOG_DIR                = os.getenv("LOG_DIR", "./logs")
os.makedirs(LOG_DIR, exist_ok=True)


# ====================== APP ======================
app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY
CORS(app, supports_credentials=True, resources={r"/*": {"origins": ALLOWED_ORIGINS}})
socketio = SocketIO(app, cors_allowed_origins=ALLOWED_ORIGINS, async_mode="threading")


# ====================== Mongo ======================
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[MONGODB_DB]

Users:    Collection = db["users"]
Sessions: Collection = db["sessions"]
Attempts: Collection = db["attempts"]
Badges:   Collection = db["badges"]

# Indexes (idempotent)
Users.create_index([("_id", ASCENDING)], unique=True)
Users.create_index([("name", ASCENDING), ("cohort", ASCENDING)], unique=True)
Users.create_index([("xp", DESCENDING)])
Attempts.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
Attempts.create_index([("user_id", ASCENDING), ("question_hash", ASCENDING), ("created_at", DESCENDING)])
Sessions.create_index([("session_uuid", ASCENDING)], unique=True)


# ====================== UTILS ======================
def now_utc() -> dt.datetime:
    return dt.datetime.utcnow()

def now_iso() -> str:
    return now_utc().replace(tzinfo=dt.timezone.utc).isoformat()

def jsonl_write(filename: str, obj: Dict[str, Any]):
    path = os.path.join(LOG_DIR, filename)
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")

def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def parse_period_bounds(period: str) -> Tuple[dt.datetime, dt.datetime]:
    now = now_utc()
    if period == "daily":
        start = now - dt.timedelta(days=1)
    elif period == "weekly":
        start = now - dt.timedelta(days=7)
    else:
        start = now - dt.timedelta(days=365*50)
    return start, now


# ====================== Adaptive logic ======================
def choose_difficulty_for_skill(skill: float) -> str:
    if skill < 1200: return "Starter"
    if skill < 1500: return "Medium"
    return "Difficult"

def elo_update(skill: float, correct: bool, k: float = 24.0) -> Tuple[float, float]:
    opponent = 1150 if skill < 1200 else (1350 if skill < 1500 else 1600)
    expected = 1.0 / (1.0 + 10.0 ** ((opponent - skill)/400.0))
    score = 1.0 if correct else 0.0
    delta = k * (score - expected)
    return skill + delta, delta

def award_xp_and_badges(user_doc: dict, correct: bool, hint_used: bool) -> Tuple[int, list]:
    gained = 15 if correct else 2
    if hint_used and correct:
        gained = max(5, gained - 8)
    badges = []
    new_streak = (user_doc.get("streak", 0) + 1) if correct else 0
    if correct and new_streak in (3, 5, 10, 20):
        badges.append(f"streak_{new_streak}")
    return gained, badges

def duplicate_recent_question(user_id: str, qhash: str, cooldown_days: int) -> bool:
    since = now_utc() - dt.timedelta(days=cooldown_days)
    found = Attempts.find_one({
        "user_id": user_id,
        "question_hash": qhash,
        "created_at": {"$gte": since}
    })
    return found is not None

def choose_next_topic(user_id: str) -> str:
    default_topics = ["Anatomy", "Physiology", "Pharmacology", "Pathology", "Imaging"]
    cur = Attempts.find({"user_id": user_id}).sort("created_at", DESCENDING).limit(60)
    items = list(cur)
    if not items:
        return random.choice(default_topics)

    stats = {}
    for a in items:
        t = a.get("topic") or "General"
        s = stats.setdefault(t, {"c":0, "n":0})
        s["n"] += 1
        if a.get("correct"): s["c"] += 1

    scores = []
    for t, v in stats.items():
        acc = (v["c"]/v["n"]) if v["n"] else 0.0
        scores.append((t, acc))
    scores.sort(key=lambda x: x[1])  # weaker first

    weights = [max(0.05, 1.0 - acc) for (_, acc) in scores]
    r = random.random() * sum(weights)
    cum = 0.0
    for (t, _), w in zip(scores, weights):
        cum += w
        if r <= cum: return t
    return random.choice(default_topics)


# ====================== RAG (Qdrant + OpenAI) ======================
def get_openai():
    if OpenAI:
        return OpenAI(api_key=OPENAI_API_KEY)
    openai_legacy.api_key = OPENAI_API_KEY
    return openai_legacy

def embed_texts(texts: List[str]) -> List[List[float]]:
    client = get_openai()
    if OpenAI:
        em = client.embeddings.create(model=EMBED_MODEL, input=texts)
        return [d.embedding for d in em.data]
    else:
        em = client.Embedding.create(model=EMBED_MODEL, input=texts)
        return [d["embedding"] for d in em["data"]]

def _qdrant_client() -> QdrantClient:
    # You prefer host naming. If QUADRANT_HOST looks like a URL, pass as url.
    if QUADRANT_HOST.startswith("http"):
        return QdrantClient(url=QUADRANT_HOST, api_key=QUADRANT_API_KEY)
    return QdrantClient(host=QUADRANT_HOST, api_key=QUADRANT_API_KEY)

def ensure_collection(dim: int = 1536):
    cli = _qdrant_client()
    names = [c.name for c in cli.get_collections().collections]
    if COLLECTION_NAME not in names:
        cli.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )

def qdrant_search(query: str, k: int = 6, topic: Optional[str] = None) -> List[Record]:
    cli = _qdrant_client()
    vec = embed_texts([query])[0]
    qfilter = None
    if topic:
        qfilter = Filter(must=[FieldCondition(key="topic", match=MatchValue(value=topic))])
    return cli.search(collection_name=COLLECTION_NAME, query_vector=vec, limit=k, query_filter=qfilter)

def generate_grounded_question(topic: str, difficulty: str) -> Dict[str, Any]:
    # 1) retrieve
    hits = qdrant_search(f"{topic} core facts MCQ {difficulty}", k=5, topic=topic)
    contexts, citations = [], []
    for h in hits:
        payload = h.payload or {}
        text = payload.get("text") or payload.get("chunk") or ""
        src  = payload.get("source") or payload.get("id") or "doc"
        contexts.append(text.strip())
        citations.append({"id": src, "url": payload.get("url","")})

    # 2) ask OpenAI to produce 1 question JSON
    sys_msg = (
        "You create exam questions grounded strictly in the provided context. "
        "Return exactly one JSON object with keys: "
        "{type: 'MCQ|TF|CASE', text: str, options: [str], answer_index: int|null, answer_text: str}. "
        "Keep it concise and solvable only from the context."
    )
    user_msg = f"Topic: {topic}\nDifficulty: {difficulty}\nContext:\n" + "\n---\n".join(contexts[:5])

    client = get_openai()
    if OpenAI:
        chat = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys_msg},{"role":"user","content":user_msg}],
            temperature=0.4,
        )
        text = chat.choices[0].message.content.strip()
    else:
        chat = client.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys_msg},{"role":"user","content":user_msg}],
            temperature=0.4,
        )
        text = chat["choices"][0]["message"]["content"].strip()

    m = re.search(r"\{[\s\S]*\}", text)
    if m:
        obj = json.loads(m.group(0))
    else:
        obj = {
            "type":"MCQ","text":"From the context, which is correct?",
            "options":["A","B","C","D"],"answer_index":0,"answer_text":"A is supported by context."
        }

    qid = str(uuid.uuid4())
    return {
        "id": qid,
        "type": obj.get("type","MCQ"),
        "text": obj.get("text",""),
        "options": obj.get("options") or [],
        "answer_index": obj.get("answer_index", 0),
        "answer_text": obj.get("answer_text", ""),
        "topic": topic,
        "difficulty": difficulty,
        "citations": citations[:5],
    }

def generate_hint(question: Dict[str, Any]) -> str:
    client = get_openai()
    sys = "Give a short, non-spoiling hint (1–2 concise lines)."
    prompt = json.dumps({"question": question.get("text",""), "options": question.get("options", [])})
    if OpenAI:
        chat = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys},{"role":"user","content":prompt}],
            temperature=0.3
        )
        return chat.choices[0].message.content.strip()
    else:
        chat = client.ChatCompletion.create(
            model=OPENAI_MODEL,
            messages=[{"role":"system","content":sys},{"role":"user","content":prompt}],
            temperature=0.3
        )
        return chat["choices"][0]["message"]["content"].strip()


# ====================== API ======================
@app.route("/api/ping")
def ping():
    return jsonify({"ok": True, "time": now_iso()})

@app.route("/api/session/start", methods=["POST"])
def start_session():
    data = request.get_json(force=True) or {}
    name = data.get("name", "Guest")
    cohort = data.get("cohort", "default")

    user = Users.find_one({"name": name, "cohort": cohort})
    if not user:
        user = {
            "_id": str(uuid.uuid4()),            # store user IDs as strings
            "name": name, "cohort": cohort,
            "skill": 1200.0, "xp": 0, "streak": 0,
            "created_at": now_utc()
        }
        Users.insert_one(user)

    sess_id = str(uuid.uuid4())
    sess_doc = {
        "session_uuid": sess_id,
        "user_id": user["_id"],                 # string
        "started_at": now_utc(),
        "ended_at": None,
        "skill_start": float(user["skill"]),
        "skill": float(user["skill"]),
        "xp_earned": 0,
        "streak_start": user.get("streak", 0),
        "last_submit_ts": None,
        "last_question_json": None,
        "hint_used": False
    }
    Sessions.insert_one(sess_doc)

    jsonl_write("events.jsonl", {"ts": now_iso(), "type": "session_start", "user_id": user["_id"], "session_id": sess_id})
    return jsonify({"ok": True, "session": {"session_id": sess_id, "skill": sess_doc["skill"], "xp": sess_doc["xp_earned"], "streak": user.get("streak", 0)}})

@app.route("/api/session/next_question", methods=["GET"])
def next_question():
    sid = request.args.get("session_id")
    if not sid: return jsonify({"ok":False,"error":"session_id required"}), 400
    sess = Sessions.find_one({"session_uuid": sid})
    if not sess: return jsonify({"ok":False,"error":"session not found"}), 404

    # choose topic + difficulty
    topic = choose_next_topic(sess["user_id"])
    difficulty = choose_difficulty_for_skill(sess["skill"])

    # generate unique question (de-dup by 14 days)
    tries = 0
    question = None
    while tries < 5:
        q = generate_grounded_question(topic=topic, difficulty=difficulty)
        q_hash = sha1(f"{q.get('text')}|{q.get('type')}|{topic}|{difficulty}|" + "|".join(q.get("options", [])))
        if not duplicate_recent_question(sess["user_id"], q_hash, QUESTION_COOLDOWN_DAYS):
            question = q
            question["hash"] = q_hash
            break
        tries += 1
    if not question:
        return jsonify({"ok": False, "error": "could not generate unique question"}), 500

    Sessions.update_one({"session_uuid": sid}, {"$set": {"last_question_json": json.dumps(question)}})

    safe_q = {k: question[k] for k in ["id","text","type","topic","difficulty","options","citations"] if k in question}
    return jsonify({"ok": True, "question": safe_q})

@app.route("/api/session/submit_attempt", methods=["POST"])
def submit_attempt():
    p = request.get_json(force=True)
    sid     = p.get("session_id")
    qid     = p.get("question_id")
    ans_idx = p.get("answer_index")
    want_hint = p.get("request_hint", False)
    elapsed = p.get("elapsed_sec")

    sess = Sessions.find_one({"session_uuid": sid})
    if not sess: return jsonify({"ok":False,"error":"session not found"}), 404

    now_ts = time.time()
    if sess.get("last_submit_ts") and (now_ts - float(sess["last_submit_ts"])) < SUBMIT_COOLDOWN_SEC and not want_hint:
        return jsonify({"ok":False,"error":"slow_down"}), 429

    if not sess.get("last_question_json"):
        return jsonify({"ok":False,"error":"no_question_cached"}), 400
    q = json.loads(sess["last_question_json"])

    user = Users.find_one({"_id": sess["user_id"]})

    if want_hint:
        hint = generate_hint(q)
        Sessions.update_one({"session_uuid": sid}, {"$set": {"hint_used": True}})
        return jsonify({"ok":True,"hint":hint,"session":{"session_id":sid,"skill":sess["skill"],"xp":sess.get("xp_earned",0),"streak":user.get("streak",0)}})

    if q["type"] == "MCQ":
        correct = (ans_idx == q.get("answer_index"))
    else:
        user_text = (ans_idx or {}).get("text","").strip().lower() if isinstance(ans_idx, dict) else ""
        correct = bool(user_text) and (q.get("answer_text","").strip().lower() in user_text)

    new_skill, delta = elo_update(float(sess["skill"]), correct)
    hint_used = bool(sess.get("hint_used"))

    # update user streak/xp/skill
    new_streak = (user.get("streak",0) + 1) if correct else 0
    gained, badges = award_xp_and_badges(user, correct, hint_used)
    Users.update_one({"_id": user["_id"]}, {
        "$set": {"skill": new_skill, "streak": new_streak},
        "$inc": {"xp": gained}
    })
    Sessions.update_one({"session_uuid": sid}, {
        "$set": {"skill": new_skill, "hint_used": False, "last_submit_ts": now_ts},
        "$inc": {"xp_earned": gained}
    })
    for b in badges:
        Badges.insert_one({"user_id": user["_id"], "name": b, "awarded_at": now_utc()})

    Attempts.insert_one({
        "user_id": sess["user_id"],
        "session_uuid": sid,
        "question_id": qid,
        "question_hash": q.get("hash"),
        "topic": q.get("topic"),
        "difficulty": q.get("difficulty"),
        "correct": bool(correct),
        "elapsed_sec": elapsed,
        "raw_question": q,
        "created_at": now_utc()
    })

    cur = Attempts.find({"user_id": sess["user_id"]}).sort("created_at", DESCENDING).limit(20)
    last = list(cur)
    totals = {"correct": sum(1 for x in last if x.get("correct")), "incorrect": sum(1 for x in last if not x.get("correct"))}

    jsonl_write("events.jsonl", {
        "ts": now_iso(), "type":"submit", "user_id": sess["user_id"], "session_id": sid,
        "question_id": qid, "correct": bool(correct), "skill_delta": delta, "xp_gained": gained
    })

    sess_after = Sessions.find_one({"session_uuid": sid})
    user_after = Users.find_one({"_id": sess["user_id"]})

    return jsonify({
        "ok": True,
        "session": {"session_id": sid, "skill": sess_after["skill"], "xp": sess_after.get("xp_earned",0), "streak": user_after.get("streak",0)},
        "last_attempts": [{"topic":x.get("topic"),"correct":x.get("correct"),"difficulty":x.get("difficulty"),"ts":x["created_at"].isoformat()} for x in last],
        "totals": totals,
        "events": [],
        "next_available": True
    })

@app.route("/api/session/finalize", methods=["POST"])
def finalize_session():
    sid = (request.get_json(force=True) or {}).get("session_id")
    sess = Sessions.find_one({"session_uuid": sid})
    if not sess: return jsonify({"ok":False,"error":"session not found"}), 404
    Sessions.update_one({"session_uuid": sid}, {"$set": {"ended_at": now_utc()}})
    jsonl_write("events.jsonl", {"ts": now_iso(), "type":"session_end", "session_id": sid})
    return jsonify({"ok": True})

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    # Rank by User.xp (fast). You can switch to time-bounded XP using Attempts if needed.
    cur = Users.find({}).sort("xp", DESCENDING).limit(100)
    rows = [{"user_id": u["_id"], "name": u["name"], "xp": int(u.get("xp",0)), "streak": int(u.get("streak",0)), "skill": float(u.get("skill",1200))} for u in cur]
    me_name = request.args.get("me_name")
    me = None
    if me_name:
        for idx, r in enumerate(rows, start=1):
            if r["name"] == me_name:
                me = {"rank": idx, **r}
                break
    return jsonify({"ok": True, "rows": rows, "me": me})

# ---------- Streaming AI feedback (plain text chunks; matches your ChatBot) ----------
@app.route("/quiz-feedback-stream", methods=["POST"])
def quiz_feedback_stream():
    data = request.get_json(force=True) or {}
    user_msg = (data.get("message") or "").strip()
    session_id = data.get("session_id")

    sess = Sessions.find_one({"session_uuid": session_id}) if session_id else None
    attempts = list(Attempts.find({"user_id": sess["user_id"]}).sort("created_at", DESCENDING).limit(40)) if sess else []

    stats = {}
    for a in attempts:
        t = a.get("topic") or "General"
        s = stats.setdefault(t, {"c":0,"n":0})
        s["n"] += 1
        if a.get("correct"): s["c"] += 1
    bullets = [f"- {t}: {round((v['c']/v['n'])*100) if v['n'] else 0}% over last {v['n']} attempts" for t,v in stats.items()]
    context = "Recent accuracy by topic:\n" + ("\n".join(bullets) if bullets else "- no recent attempts")

    def stream():
        client = get_openai()
        sys = "You are a concise, encouraging medical quiz coach. Use short bullets and tight spacing."
        usr = f"{context}\n\nUser request: {user_msg or 'Give feedback on my recent quiz performance.'}"

        if OpenAI:
            resp = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role":"system","content":sys},{"role":"user","content":usr}],
                temperature=0.4, stream=True
            )
            for chunk in resp:
                delta = chunk.choices[0].delta.content if chunk.choices[0].delta else None
                if delta: yield delta
        else:
            comp = client.ChatCompletion.create(
                model=OPENAI_MODEL,
                messages=[{"role":"system","content":sys},{"role":"user","content":usr}],
                temperature=0.4
            )
            text = comp["choices"][0]["message"]["content"]
            for i in range(0, len(text), 60):
                yield text[i:i+60]
                time.sleep(0.02)

    return Response(stream(), mimetype="text/plain")


# ====================== Socket.IO ======================
@socketio.on("join")
def on_join(data):
    room = data.get("room","global")
    name = data.get("name","Guest")
    join_room(room)
    emit("message", {"from":"system","text":f"{name} joined", "ts": now_iso()}, to=room)

@socketio.on("leave")
def on_leave(data):
    room = data.get("room","global")
    name = data.get("name","Guest")
    leave_room(room)
    emit("message", {"from":"system","text":f"{name} left", "ts": now_iso()}, to=room)

@socketio.on("message")
def on_message(msg):
    room = msg.get("room","global")
    emit("message", msg, to=room)


# ====================== Seeder (optional) ======================
def read_text_files(folder: str):
    files = []
    for path in glob.glob(os.path.join(folder, "**", "*.*"), recursive=True):
        if any(path.lower().endswith(ext) for ext in (".txt",".md",".json",".csv",".html",".log",".rtf",".mdx",".yaml",".yml")):
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    files.append((path, f.read()))
            except Exception:
                pass
    return files

def chunk_text(text: str, max_chars: int = 1200, overlap: int = 150):
    text = re.sub(r"\s+", " ", text).strip()
    out, i = [], 0
    while i < len(text):
        out.append(text[i:i+max_chars])
        i += (max_chars - overlap)
    return out

def infer_topic_from_path(path: str) -> str:
    b = os.path.basename(path).lower()
    for t in ["anatomy","physiology","pharmacology","pathology","imaging","cardio","neuro","renal","obgyn","peds"]:
        if t in b: return t.capitalize()
    return "General"

def seed_qdrant(folder: str):
    print(f"[seed] scanning {folder} ...")
    files = read_text_files(folder)
    if not files:
        print("No files found. Put .txt/.md in the folder.")
        return
    cli = _qdrant_client()
    ensure_collection(dim=1536)

    batch = []
    for path, text in files:
        topic = infer_topic_from_path(path)
        for chunk in chunk_text(text):
            emb = embed_texts([chunk])[0]
            batch.append(PointStruct(
                id=int(uuid.uuid4().int % (10**12)),
                vector=emb,
                payload={"text": chunk, "source": os.path.basename(path), "topic": topic, "url": ""},
            ))
            if len(batch) >= 64:
                cli.upsert(collection_name=COLLECTION_NAME, points=batch)
                batch = []
                print(".", end="", flush=True)
    if batch:
        cli.upsert(collection_name=COLLECTION_NAME, points=batch)
    print("\n[seed] done ✔")


# ====================== Main ======================
if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--seed":
        seed_qdrant(sys.argv[2])
        sys.exit(0)

    print("Starting server at http://localhost:8000")
    socketio.run(app, host="0.0.0.0", port=8000)
