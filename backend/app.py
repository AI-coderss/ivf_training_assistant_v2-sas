import os
import tempfile
from uuid import uuid4
from datetime import datetime
import json
import re
import base64
import random
import websockets
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import asyncio
from threading import Thread
import queue
import threading
import websocket
from flask_sock import Sock
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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ASR_MODEL="gpt-4o-mini-transcribe"
OPENAI_REALTIME_URL="wss://api.openai.com/v1/realtime?intent=transcription"
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://ivf-virtual-training-assistant-dsah.onrender.com",
            "http://localhost:3000"
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

app.register_blueprint(bp_realtime, url_prefix="/api")
chat_sessions = {}
collection_name = os.getenv("QDRANT_COLLECTION_NAME")
sock = Sock(app)

@app.get("/healthz")
def healthz():
    return jsonify({
        "ok": bool(OPENAI_API_KEY),
        "model": ASR_MODEL,
        "endpoint": OPENAI_REALTIME_URL
    }), (200 if OPENAI_API_KEY else 500)

# Initialize OpenAI client
client = OpenAI()
app.register_blueprint(ocr_bp)
# === VECTOR STORE ===
def get_vector_store():
    qdrant = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY"),
        timeout=60.0
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(client=qdrant, collection_name=collection_name, embeddings=embeddings)

vector_store = get_vector_store()

# === RAG Chain ===
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
@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    user_input = data.get("message")
    if not user_input:
        return jsonify({"error": "No input message"}), 400

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    def generate():
        answer = ""

        # === Pure RAG only ===
        try:
            for chunk in conversation_rag_chain.stream(
                {"chat_history": chat_sessions[session_id], "input": user_input}
            ):
                token = chunk.get("answer", "")
                answer += token
                yield token
        except Exception as e:
            yield f"\n[Vector error: {str(e)}]"

        # Save session
        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(
        stream_with_context(generate()),
        content_type="text/plain",
        headers={"Access-Control-Allow-Origin": "https://ivf-virtual-training-assistant-dsah.onrender.com"}
    )

# === /generate ===
@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
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
@app.route("/tts", methods=["POST"])
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
@app.route("/reset", methods=["POST"])
def reset():
    session_id = request.json.get("session_id")
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return jsonify({"message": "Session reset"}), 200

# === /start-quiz ===
@app.route("/start-quiz", methods=["POST"])
def start_quiz():
    data = request.json
    session_id = data.get("session_id", str(uuid4()))
    topic = data.get("topic", "IVF")
    difficulty = data.get("difficulty", "mixed")

    rag_prompt = (
        f"You are an IVF virtual training assistant. Generate exactly 20 multiple-choice questions on '{topic}'. "
        f"Each question must reflect '{difficulty}' difficulty level. Return them strictly as a JSON array. "
        "Each object must follow this format:\n"
        '{ "id": "q1", "text": "...", "options": ["A", "B", "C", "D"], "correct": "B", "difficulty": "easy" }\n'
        "Respond ONLY with valid JSON — no markdown, commentary, or explanations."
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
@app.route("/quiz-feedback-stream", methods=["POST"])
def quiz_feedback_stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    prompt = data.get("prompt") or data.get("message", "").strip()
    context_items = data.get("context", [])

    context_string = "\n".join([
        f"Q: {item['text']}\nUser Answer: {item['userAnswer']}\nCorrect Answer: {item['correct']}"
        for item in context_items
    ]) if context_items else ""

    full_prompt = (
        f"You are a helpful IVF tutor. The following questions were answered incorrectly by the trainee:\n\n"
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

@app.route("/submit-quiz", methods=["POST"])
def submit_quiz():
    data = request.get_json()
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

@app.route("/quiz-performance", methods=["GET"])
def quiz_performance():
    return jsonify({
        "attempt": [e["attempt"] for e in performance_log],
        "score": [e["score"] for e in performance_log],
        "correct_answers": [e["correct"] for e in performance_log],
        "duration_minutes": [e["duration"] for e in performance_log],
        "timestamp": [e["timestamp"] for e in performance_log]
    })

# === /suggestions ===
@app.route("/suggestions", methods=["GET"])
def suggestions():
    # --- SOLUTION ---
    # 1. Create a list of different prompts
    prompt_templates = [
        "Please suggest 25 common and helpful questions a patient might ask about IVF, IVF protocols, and ESHREE guidelines. Format them as a numbered list.",
        "Generate a list of 25 essential questions for someone considering IVF treatment, covering protocols and ESHREE guidelines. Present as a numbered list.",
        "What are 25 frequently asked questions regarding IVF procedures and ESHREE guidelines? Return them in a numbered list format.",
        "Suggest 25 diverse questions about the IVF journey, from initial consultation to post-transfer, referencing ESHREE guidelines. Provide a numbered list.",
        "As an AI assistant, list 25 insightful questions about the financial, emotional, and medical aspects of IVF and its protocols. Return as a numbered list."
    ]

    # 2. Select a random prompt from the list
    random_prompt = random.choice(prompt_templates)
    # --- END SOLUTION ---

    response = conversation_rag_chain.invoke({
        "chat_history": [],
        "input": random_prompt # Use the randomized prompt here
    })
    
    raw = response.get("answer", "")
    lines = raw.split("\n")
    questions = [re.sub(r"^[\s•\-\d\.\)]+", "", line).strip() for line in lines if line.strip()]
    
    return jsonify({"suggested_questions": questions[:25]})

# === /mindmap ===
@app.route("/mindmap", methods=["POST"])
def mindmap():
    session_id = request.json.get("session_id", str(uuid4()))
    topic = request.json.get("topic", "IVF")

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
@app.route("/diagram", methods=["POST"])
def diagram():
    """
    Generates valid Mermaid code using OpenAI,
    extracts only the mermaid block,
    removes numbers inside square brackets.
    """
    session_id = request.json.get("session_id", str(uuid4()))
    topic = request.json.get("topic", "IVF Process Diagram")

    # Strict prompt for Mermaid syntax only
    prompt = (
        f"You are a diagram assistant for IVF related topics and training for IVF fellowships using diagrams and flowcharts to explain concepts. "
        f"For the topic '{topic}', produce a clear Mermaid diagram in this format:\n"
        "```mermaid\n"
        "graph TD\n"
        "Step1 --> Step2 --> Step3\n"
        "```\n"
        "Return ONLY the Mermaid block, wrapped in triple backticks. No explanations."
        "Ensure that your mermaid syntax is clean"
    )

    # Call OpenAI chat completion
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    raw_answer = response.choices[0].message.content

    # Extract Mermaid code
    match = re.search(r"```mermaid([\s\S]+?)```", raw_answer, re.IGNORECASE)
    mermaid_code = match.group(1).strip() if match else "graph TD\nA[Error] --> B[No diagram]"

    # Remove numbers inside [ ... ] brackets (e.g., [Step 1] -> [Step ])
    cleaned_mermaid = re.sub(r'\[([^\[\]]*?)\d+([^\[\]]*?)\]', r'[\1\2]', mermaid_code)

    return jsonify({
        "type": "mermaid",
        "syntax": cleaned_mermaid,
        "topic": topic
    })

@app.route("/websearch_trend", methods=["POST"])
def websearch_trend():
    try:
        data = request.get_json()
        user_input = data.get("query", "")

        if not user_input:
            return jsonify({"error": "No query provided"}), 400

        # Use OpenAI Responses API with web search tool
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

        # Convert the result to usable JSON
        raw_output = stream.output_text.strip()
        try:
            # Attempt to parse directly
            json_match = re.search(r"{.*}", raw_output, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                return jsonify(parsed), 200
            else:
                return jsonify({"error": "No JSON found in response", "raw": raw_output}), 400
        except json.JSONDecodeError:
            return jsonify({"error": "Malformed JSON in response", "raw": raw_output}), 400

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500
# === /generate-followups ===
@app.route("/generate-followups", methods=["POST"])
def generate_followups():
    data = request.get_json()
    last_answer = data.get("last_answer", "")
    if not last_answer:
        return jsonify({"followups": []})

    followup_prompt = (
        f"Based on the following assistant response, generate 3 short and helpful follow-up questions "
        f"that the user might want to ask next, analyze the last answer :\n\n{last_answer}\n\n and provide a set of follow-up questions that are relevant to the topic discussed. "
        f"Format the response as a JSON array of strings."
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

    except Exception as e:
        print(f"Error generating followups: {e}")
        return jsonify({"followups": []})
# OpenAI Realtime bridge (threaded)
# -----------------------------
class OpenAIRealtimeBridge:
    """
    Threaded bridge to OpenAI Realtime WS.
    - Sends initial transcription_session.update
    - Pumps messages from a Queue (client -> OpenAI)
    - Forwards OpenAI events to the browser via client_ws.send()
    """
    def __init__(self, client_ws, model=ASR_MODEL):
        self.client_ws = client_ws
        self.model = model
        self.ws = None  # websocket.WebSocketApp instance
        self.sender_thread = None
        self.ws_thread = None

        self.to_openai = queue.Queue(maxsize=512)
        self.stop_event = threading.Event()
        self.opened_event = threading.Event()
        self.last_error = None

    # ---- websocket-client callbacks ----
    def _on_open(self, ws):
        # Send session.update per OpenAI docs
        try:
            payload = {
                "type": "transcription_session.update",
                "input_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": self.model,   # "gpt-4o-mini-transcribe" or "gpt-4o-transcribe"
                    "prompt": "",
                    "language": ""         # "" = auto-detect; set "en" if desired
                },
                "turn_detection": {
                    "type": "server_vad",
                    "threshold": 0.5,
                    "prefix_padding_ms": 300,
                    "silence_duration_ms": 500
                },
                "input_audio_noise_reduction": {"type": "near_field"},
                "include": ["item.input_audio_transcription.logprobs"]
            }
            ws.send(json.dumps(payload))
        except Exception as e:
            self.last_error = f"Failed to send session.update: {e}"
        finally:
            self.opened_event.set()

        # Start a thread to drain to_openai queue and send to OpenAI
        def _pump_to_openai():
            while not self.stop_event.is_set():
                try:
                    msg = self.to_openai.get(timeout=0.25)
                except queue.Empty:
                    continue
                try:
                    ws.send(msg)
                except Exception as e:
                    self.last_error = f"Send to OpenAI failed: {e}"
                    break

        self.sender_thread = threading.Thread(target=_pump_to_openai, daemon=True)
        self.sender_thread.start()

    def _on_message(self, ws, message):
        # Forward OpenAI JSON text frames to the browser
        try:
            self.client_ws.send(message)
        except Exception as e:
            self.last_error = f"Forward to client failed: {e}"
            self.stop()

    def _on_error(self, ws, error):
        self.last_error = f"OpenAI WS error: {error}"
        try:
            self.client_ws.send(json.dumps({"type": "error", "error": str(error)}))
        except Exception:
            pass

    def _on_close(self, ws, status_code, msg):
        # Inform browser
        try:
            self.client_ws.send(json.dumps({
                "type": "info",
                "message": "OpenAI connection closed",
                "code": status_code,
                "detail": msg
            }))
        except Exception:
            pass
        self.stop_event.set()

    # ---- lifecycle ----
    def start(self):
        headers = [
            f"Authorization: Bearer {OPENAI_API_KEY}",
            "OpenAI-Beta: realtime=v1"
        ]
        self.ws = websocket.WebSocketApp(
            OPENAI_REALTIME_URL,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
            header=headers,
        )
        # Run forever in its own thread
        self.ws_thread = threading.Thread(target=self.ws.run_forever, kwargs={"ping_interval": 20}, daemon=True)
        self.ws_thread.start()

        # Wait (briefly) until open/init attempts
        self.opened_event.wait(timeout=5.0)

    def stop(self):
        self.stop_event.set()
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass

        if self.sender_thread and self.sender_thread.is_alive():
            try:
                self.sender_thread.join(timeout=1.0)
            except Exception:
                pass
        if self.ws_thread and self.ws_thread.is_alive():
            try:
                self.ws_thread.join(timeout=1.0)
            except Exception:
                pass

    # ---- public api ----
    def send_to_openai(self, json_str):
        # Non-blocking put; drop if queue full
        try:
            self.to_openai.put_nowait(json_str)
        except queue.Full:
            self.last_error = "to_openai queue is full; dropping chunk."

# -----------------------------
# WS Route
# -----------------------------
@sock.route("/ws/transcribe")
def ws_transcribe(client_ws):
    """
    Browser connects to: wss://<host>/ws/transcribe
    - We open a server-side WS to OpenAI Realtime (intent=transcription)
    - Send session.update
    - Bridge:
        client -> OpenAI  : JSON frames (append/commit/clear/session.update)
        OpenAI  -> client : all JSON events (speech_started/stopped, final text, etc.)
    """
    if not OPENAI_API_KEY:
        client_ws.send(json.dumps({"type": "error", "error": "OPENAI_API_KEY not set"}))
        client_ws.close()
        return

    bridge = OpenAIRealtimeBridge(client_ws)
    try:
        bridge.start()
        # If OpenAI failed immediately, surface error
        if bridge.last_error:
            client_ws.send(json.dumps({"type": "error", "error": bridge.last_error}))

        # Browser receive loop (blocking; keeps WS open)
        while True:
            data = client_ws.receive()
            if data is None:
                break  # client closed
            # Expect JSON strings from client
            if isinstance(data, (bytes, bytearray)):
                # Ignore binary; protocol uses JSON text frames
                continue
            # Light validation: ensure it's JSON
            try:
                _ = json.loads(data)
            except Exception:
                # Skip malformed frames
                continue

            # Forward to OpenAI
            bridge.send_to_openai(data)

    except Exception as e:
        try:
            client_ws.send(json.dumps({"type": "error", "error": str(e)}))
        except Exception:
            pass
    finally:
        bridge.stop()
        try:
            client_ws.close()
        except Exception:
            pass

# -----------------------------
# Local dev

# === Run ===
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)





