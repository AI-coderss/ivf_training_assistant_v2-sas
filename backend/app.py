import os
import tempfile
from uuid import uuid4
from datetime import datetime, timedelta
import json
import re
import base64
import random
from threading import Lock

from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, stream_with_context, g, make_response
from flask_cors import CORS
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

import qdrant_client
from openai import OpenAI
from prompts.prompt import engineeredprompt
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

from routes.realtime import bp_realtime
from routes.ocr_routes import ocr_bp

# Load env vars
load_dotenv()

# --- Auth configuration ---
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", "change-me"))
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "1440"))
USERS_DB_PATH = os.path.join(os.path.dirname(__file__), "users_db.json")
users_lock = Lock()

# --- CORS configuration ---
# NOTE: If you use credentials (cookies), you cannot use "*" for Allow-Origin.
ALLOWED_ORIGINS = {
    "https://ivf-virtual-training-assistant-dsah.onrender.com",
    "http://localhost:3000",
}

ALLOWED_METHODS = "GET, POST, OPTIONS"
ALLOWED_HEADERS = "Content-Type, Authorization, Accept, X-Requested-With, X-Session-Id"
EXPOSE_HEADERS = "Content-Type, Authorization"

app = Flask(__name__)
app.url_map.strict_slashes = False  # prevents 308 redirects that often drop CORS headers on some setups

# Let flask-cors attach headers where possible (still we'll enforce via after_request too)
CORS(
    app,
    supports_credentials=True,
    origins=list(ALLOWED_ORIGINS),
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Requested-With", "X-Session-Id"],
    expose_headers=["Content-Type", "Authorization"],
    max_age=86400,
)

# --- Hard guarantee: apply CORS headers to ALL responses (including errors / redirects) ---
@app.after_request
def add_cors_headers(resp):
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
        resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
        resp.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
        resp.headers["Access-Control-Expose-Headers"] = EXPOSE_HEADERS
    return resp

# --- Hard guarantee: clean preflight for ANY path ---
@app.before_request
def handle_preflight_globally():
    if request.method == "OPTIONS":
        resp = make_response("", 204)
        # after_request will attach the CORS headers, but we also set explicitly:
        origin = request.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
            resp.headers["Access-Control-Allow-Credentials"] = "true"
            resp.headers["Access-Control-Allow-Methods"] = ALLOWED_METHODS
            resp.headers["Access-Control-Allow-Headers"] = ALLOWED_HEADERS
            resp.headers["Access-Control-Expose-Headers"] = EXPOSE_HEADERS
            resp.headers["Access-Control-Max-Age"] = "86400"
        return resp
    return None

# --- Simple file-backed user store + JWT helpers ---
def _ensure_user_db():
    """Create the user db file if it does not exist."""
    with users_lock:
        if not os.path.exists(USERS_DB_PATH):
            with open(USERS_DB_PATH, "w", encoding="utf-8") as f:
                json.dump([], f)

def _load_users():
    with users_lock:
        _ensure_user_db()
        with open(USERS_DB_PATH, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []

def _save_users(users):
    with users_lock:
        with open(USERS_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2)

def _find_user_by_email(email):
    email_norm = (email or "").strip().lower()
    for user in _load_users():
        if user.get("email") == email_norm:
            return user
    return None

def _create_access_token(user):
    now = datetime.utcnow()
    payload = {
        "sub": user["email"],
        "name": user.get("name"),
        "roles": user.get("roles", ["user"]),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def _get_bearer_token():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()

def _auth_error(message="Unauthorized", status=401):
    return jsonify({"success": False, "message": message}), status

PUBLIC_PATHS = {"/auth/login", "/auth/register", "/healthz"}

@app.before_request
def enforce_authentication():
    """
    Require Bearer tokens for all routes except explicit public endpoints.
    Keeps g.current_user populated for downstream handlers.
    """
    # OPTIONS is handled above
    path = (request.path or "").rstrip("/") or "/"
    if path in PUBLIC_PATHS or path.startswith("/static") or path.startswith("/favicon") or path.startswith("/socket.io"):
        return None

    token = _get_bearer_token()
    if not token:
        return _auth_error("Missing bearer token")

    try:
        payload = _decode_token(token)
        user_record = _find_user_by_email(payload.get("sub"))
        if not user_record:
            return _auth_error("User not found", status=401)
        g.current_user = {
            "email": user_record["email"],
            "name": user_record.get("name"),
            "roles": user_record.get("roles", ["user"]),
        }
    except jwt.ExpiredSignatureError:
        return _auth_error("Token expired", status=401)
    except jwt.InvalidTokenError:
        return _auth_error("Invalid token", status=401)
    return None

# --- Auth routes ---
@app.route("/auth/register", methods=["POST", "OPTIONS"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return _auth_error("Name, email, and password are required.", status=400)
    if len(password) < 6:
        return _auth_error("Password must be at least 6 characters.", status=400)
    if _find_user_by_email(email):
        return _auth_error("User already exists.", status=409)

    new_user = {
        "id": str(uuid4()),
        "name": name,
        "email": email,
        "password_hash": generate_password_hash(password),
        "roles": ["user"],
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    users = _load_users()
    users.append(new_user)
    _save_users(users)

    token = _create_access_token(new_user)
    return jsonify({
        "success": True,
        "message": "Account created",
        "access_token": token,
        "user": {"name": name, "email": email},
        "roles": new_user["roles"],
        "expires_in": JWT_EXPIRES_MINUTES * 60,
    }), 201

@app.route("/auth/login", methods=["POST", "OPTIONS"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = _find_user_by_email(email)
    if not user or not check_password_hash(user.get("password_hash", ""), password):
        return _auth_error("Invalid email or password", status=401)

    token = _create_access_token(user)
    return jsonify({
        "success": True,
        "message": "Logged in",
        "access_token": token,
        "user": {"name": user.get("name"), "email": user.get("email")},
        "roles": user.get("roles", ["user"]),
        "expires_in": JWT_EXPIRES_MINUTES * 60,
    })

@app.route("/auth/me", methods=["GET", "OPTIONS"])
def me():
    user = getattr(g, "current_user", None)
    if not user:
        return _auth_error("Unauthorized", status=401)
    return jsonify({
        "success": True,
        "user": {"name": user.get("name"), "email": user.get("email")},
        "roles": user.get("roles", []),
    })

# --- Blueprints ---
app.register_blueprint(bp_realtime, url_prefix="/api")
app.register_blueprint(ocr_bp)

# --- RAG setup ---
chat_sessions = {}
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

client = OpenAI()

def get_vector_store():
    qdrant = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=60.0
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(client=qdrant, collection_name=collection_name, embeddings=embeddings)

vector_store = get_vector_store()

def get_context_retriever_chain():
    llm = ChatOpenAI(model="gpt-4o")
    retriever = vector_store.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder("chat_history"),
        ("user", "{input}"),
        ("user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"),
    ])
    return create_history_aware_retriever(llm, retriever, prompt)

def get_conversational_rag_chain():
    retriever_chain = get_context_retriever_chain()
    llm = ChatOpenAI(model="gpt-4o")
    prompt = ChatPromptTemplate.from_messages([
        ("system", engineeredprompt),
        MessagesPlaceholder("chat_history"),
        ("user", "{input}"),
    ])
    return create_retrieval_chain(retriever_chain, create_stuff_documents_chain(llm, prompt))

conversation_rag_chain = get_conversational_rag_chain()

# === /stream ===
@app.route("/stream", methods=["POST", "OPTIONS"])
def stream():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", str(uuid4()))
    user_input = data.get("message")
    if not user_input:
        return jsonify({"error": "No input message"}), 400

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    def generate():
        answer = ""
        try:
            for chunk in conversation_rag_chain.stream(
                {"chat_history": chat_sessions[session_id], "input": user_input}
            ):
                token = chunk.get("answer", "")
                answer += token
                yield token
        except Exception as e:
            yield f"\n[Vector error: {str(e)}]"

        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(stream_with_context(generate()), content_type="text/plain")

# === /generate ===
@app.route("/generate", methods=["POST", "OPTIONS"])
def generate():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", str(uuid4()))
    user_input = data.get("message", "")
    if not user_input:
        return jsonify({"error": "No input message"}), 400

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    response = conversation_rag_chain.invoke(
        {"chat_history": chat_sessions[session_id], "input": user_input}
    )
    answer = response["answer"]

    chat_sessions[session_id].append({"role": "user", "content": user_input})
    chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return jsonify({"response": answer, "session_id": session_id})

# === /tts ===
@app.route("/tts", methods=["POST", "OPTIONS"])
def tts():
    text = (request.json or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "No text supplied"}), 400

    response = client.audio.speech.create(
        model="tts-1",
        voice="fable",
        input=text
    )
    audio_file = "temp_audio.mp3"
    response.stream_to_file(audio_file)
    with open(audio_file, "rb") as f:
        audio_bytes = f.read()
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    return jsonify({"audio_base64": audio_base64})

# === /reset ===
@app.route("/reset", methods=["POST", "OPTIONS"])
def reset():
    session_id = (request.json or {}).get("session_id")
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return jsonify({"message": "Session reset"}), 200

# === /start-quiz ===
@app.route("/start-quiz", methods=["POST", "OPTIONS"])
def start_quiz():
    data = request.json or {}
    session_id = data.get("session_id", str(uuid4()))
    topic = data.get("topic", "IVF")
    difficulty = data.get("difficulty", "mixed")

    rag_prompt = (
        f"You are an IVF virtual training assistant. Generate exactly 20 multiple-choice questions on '{topic}'. "
        f"Each question must reflect '{difficulty}' difficulty level. Return them strictly as a JSON array. "
        "Each object must follow this format:\n"
        '{ "id": "q1", "text": "...", "options": ["A", "B", "C", "D"], "correct": "B", "difficulty": "easy" }\n'
        "Respond ONLY with valid JSON, no markdown, commentary, or explanations."
    )

    response = conversation_rag_chain.invoke(
        {"chat_history": chat_sessions.get(session_id, []), "input": rag_prompt}
    )
    raw_answer = response["answer"]
    raw_cleaned = re.sub(r"```json|```", "", raw_answer).strip()
    questions = json.loads(raw_cleaned)

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    chat_sessions[session_id].append({"role": "user", "content": rag_prompt})
    chat_sessions[session_id].append({"role": "assistant", "content": raw_answer})

    return jsonify({"questions": questions, "session_id": session_id})

# === /quiz-feedback-stream ===
@app.route("/quiz-feedback-stream", methods=["POST", "OPTIONS"])
def quiz_feedback_stream():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id", str(uuid4()))
    prompt = (data.get("prompt") or data.get("message", "")).strip()
    context_items = data.get("context", [])

    context_string = "\n".join([
        f"Q: {item['text']}\nUser Answer: {item['userAnswer']}\nCorrect Answer: {item['correct']}"
        for item in context_items
    ]) if context_items else ""

    full_prompt = (
        "You are a helpful IVF tutor. The following questions were answered incorrectly by the trainee:\n\n"
        f"{context_string}\n\nNow answer this question:\n{prompt}"
    )

    def generate():
        for chunk in conversation_rag_chain.stream(
            {"chat_history": chat_sessions.get(session_id, []), "input": full_prompt}
        ):
            yield chunk.get("answer", "")

    return Response(stream_with_context(generate()), content_type="text/plain")

# === /submit-quiz ===
performance_log = []

@app.route("/submit-quiz", methods=["POST", "OPTIONS"])
def submit_quiz():
    data = request.get_json(silent=True) or {}
    attempt_number = len(performance_log) + 1
    entry = {
        "attempt": attempt_number,
        "score": data.get("score", 0),
        "correct": data.get("correct", 0),
        "duration": data.get("duration_minutes", 0),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    performance_log.append(entry)
    return jsonify({"status": "success", "attempt": attempt_number}), 200

@app.route("/quiz-performance", methods=["GET", "OPTIONS"])
def quiz_performance():
    return jsonify({
        "attempt": [e["attempt"] for e in performance_log],
        "score": [e["score"] for e in performance_log],
        "correct_answers": [e["correct"] for e in performance_log],
        "duration_minutes": [e["duration"] for e in performance_log],
        "timestamp": [e["timestamp"] for e in performance_log]
    })

# === /suggestions ===
@app.route("/suggestions", methods=["GET", "OPTIONS"])
def suggestions():
    prompt_templates = [
        "Please suggest 25 common and helpful questions a patient might ask about IVF, IVF protocols, and ESHREE guidelines. Format them as a numbered list.",
        "Generate a list of 25 essential questions for someone considering IVF treatment, covering protocols and ESHREE guidelines. Present as a numbered list.",
        "What are 25 frequently asked questions regarding IVF procedures and ESHREE guidelines? Return them in a numbered list format.",
        "Suggest 25 diverse questions about the IVF journey, from initial consultation to post-transfer, referencing ESHREE guidelines. Provide a numbered list.",
        "As an AI assistant, list 25 insightful questions about the financial, emotional, and medical aspects of IVF and its protocols. Return as a numbered list."
    ]

    random_prompt = random.choice(prompt_templates)

    response = conversation_rag_chain.invoke({
        "chat_history": [],
        "input": random_prompt
    })

    raw = response.get("answer", "")
    lines = raw.split("\n")
    questions = [re.sub(r"^[\sƒ?½\-\d\.\)]+", "", line).strip() for line in lines if line.strip()]

    return jsonify({"suggested_questions": questions[:25]})

# === /mindmap ===
@app.route("/mindmap", methods=["POST", "OPTIONS"])
def mindmap():
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id", str(uuid4()))
    topic = payload.get("topic", "IVF")

    rag_prompt = (
        f"You are an IVF training mind map assistant. Generate a JSON mind map for topic '{topic}'. "
        f"Use a valid JSON tree structure, no markdown or comments."
    )

    response = conversation_rag_chain.invoke(
        {"chat_history": chat_sessions.get(session_id, []), "input": rag_prompt}
    )
    raw_cleaned = re.sub(r"```json|```", "", response["answer"]).strip()
    nodes = json.loads(raw_cleaned)

    return jsonify({"nodes": nodes, "session_id": session_id})

# === /diagram ===
@app.route("/diagram", methods=["POST", "OPTIONS"])
def diagram():
    payload = request.get_json(silent=True) or {}
    session_id = payload.get("session_id", str(uuid4()))
    topic = payload.get("topic", "IVF Process Diagram")

    prompt = (
        "You are a diagram assistant for IVF related topics and training for IVF fellowships using diagrams and flowcharts to explain concepts. "
        f"For the topic '{topic}', produce a clear Mermaid diagram in this format:\n"
        "```mermaid\n"
        "graph TD\n"
        "Step1 --> Step2 --> Step3\n"
        "```\n"
        "Return ONLY the Mermaid block, wrapped in triple backticks. No explanations."
        "Ensure that your mermaid syntax is clean"
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    raw_answer = response.choices[0].message.content

    match = re.search(r"```mermaid([\s\S]+?)```", raw_answer, re.IGNORECASE)
    mermaid_code = match.group(1).strip() if match else "graph TD\nA[Error] --> B[No diagram]"

    cleaned_mermaid = re.sub(r'\[([^\[\]]*?)\d+([^\[\]]*?)\]', r'[\1\2]', mermaid_code)

    return jsonify({
        "type": "mermaid",
        "syntax": cleaned_mermaid,
        "topic": topic
    })

@app.route("/websearch_trend", methods=["POST", "OPTIONS"])
def websearch_trend():
    try:
        data = request.get_json(silent=True) or {}
        user_input = data.get("query", "")
        if not user_input:
            return jsonify({"error": "No query provided"}), 400

        stream = client.responses.create(
            model="gpt-4o",
            tools=[{"type": "web_search_preview"}],
            input=(
                f"For this query: '{user_input}', "
                f"search the web and return two fields:\n"
                f"1. A short explanation of the trend (under 400 characters).\n"
                f"2. A valid Highcharts JSON config using column or line chart.\n\n"
                f"Respond as a JSON object with two fields: 'explanation' and 'chartConfig'."
            )
        )

        raw_output = stream.output_text.strip()
        json_match = re.search(r"{.*}", raw_output, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            return jsonify(parsed), 200
        return jsonify({"error": "No JSON found in response", "raw": raw_output}), 400

    except json.JSONDecodeError:
        return jsonify({"error": "Malformed JSON in response"}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

# === /generate-followups ===
@app.route("/generate-followups", methods=["POST", "OPTIONS"])
def generate_followups():
    data = request.get_json(silent=True) or {}
    last_answer = data.get("last_answer", "")
    if not last_answer:
        return jsonify({"followups": []})

    followup_prompt = (
        "Based on the following assistant response, generate 3 short and helpful follow-up questions "
        "that the user might want to ask next.\n\n"
        f"{last_answer}\n\n"
        "Format the response as a JSON array of strings."
    )

    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": followup_prompt}
            ],
            temperature=0.7
        )

        text = completion.choices[0].message.content.strip()
        match = re.search(r'\[(.*?)\]', text, re.DOTALL)
        questions = json.loads(f"[{match.group(1)}]") if match else []
        return jsonify({"followups": questions})

    except Exception:
        return jsonify({"followups": []})

@app.get("/healthz")
def healthz():
    return jsonify({"ok": True, "model": "whisper-1"}), 200

SUPPORTED_FORMATS = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']

def speech_to_text(path: str) -> dict:
    with open(path, "rb") as f:
        res = client.audio.transcriptions.create(
            model="whisper-1",
            file=f,
            response_format="text"
        )
    text = getattr(res, "text", None)
    if isinstance(res, str) and not text:
        text = res
    return {"text": (text or "").strip()}

@app.route("/transcribe", methods=["POST", "OPTIONS"])
def transcribe():
    if "audio_data" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio_data"]
    file_extension = (audio_file.filename.rsplit(".", 1)[-1] if "." in audio_file.filename else "").lower()

    if file_extension not in SUPPORTED_FORMATS:
        return jsonify({
            "error": f"Unsupported file format: {file_extension}. Supported formats: {SUPPORTED_FORMATS}"
        }), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as tmp:
        audio_file.save(tmp.name)
        temp_path = tmp.name

    try:
        transcript_result = speech_to_text(temp_path)
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass

    return jsonify({"transcript": transcript_result.get("text", "")})

# --- Run local ---
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)


