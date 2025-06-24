import os
import tempfile
from uuid import uuid4
from datetime import datetime
import json
import re
import base64
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import qdrant_client
from openai import OpenAI
from prompts.prompt import engineeredprompt
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

# Load env vars
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://ivf-virtual-training-assistant-dsah.onrender.com"])

chat_sessions = {}
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

# Initialize OpenAI client
client = OpenAI()

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
    llm = ChatOpenAI()
    retriever = vector_store.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder("chat_history"),
        ("user", "{input}"),
        ("user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"),
    ])
    return create_history_aware_retriever(llm, retriever, prompt)

def get_conversational_rag_chain():
    retriever_chain = get_context_retriever_chain()
    llm = ChatOpenAI()
    prompt = ChatPromptTemplate.from_messages([
        ("system", engineeredprompt),
        MessagesPlaceholder("chat_history"),
        ("user", "{input}"),
    ])
    return create_retrieval_chain(retriever_chain, create_stuff_documents_chain(llm, prompt))

conversation_rag_chain = get_conversational_rag_chain()

# === Fallback triggers ===
fallback_triggers = [
    "i don't know", "i am not sure", "i'm not sure", "i do not know",
    "i have no information", "no relevant information", "cannot find",
    "sorry", "unavailable", "not enough information", "insufficient information",
    "i cannot answer that", "i do not have data", "i don't have data",
    "i don't have that information", "i cannot access that information",
    "this is beyond my training", "this is outside my expertise",
    "i cannot help with that", "i can't help with that",
    "i do not have browsing capabilities", "i cannot browse", "i can't browse",
    "i cannot search the web", "i can't search the web",
    "i cannot access the internet", "i can't access the internet",
    "this requires real-time information",
    "i currently do not have browsing capabilities"
]

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
        use_web = False

        # === Try RAG ===
        try:
            for chunk in conversation_rag_chain.stream(
                {"chat_history": chat_sessions[session_id], "input": user_input}
            ):
                token = chunk.get("answer", "")
                answer += token
                yield token
        except Exception as e:
            yield f"\n[Vector error: {str(e)}]"
            use_web = True

        # === Check if fallback needed ===
        if any(trigger in answer.lower() for trigger in fallback_triggers) or len(answer.strip()) < 10:
            use_web = True

        if use_web:
            yield "\n[WEB_SEARCH_INITIATED]\n"
            try:
                stream_resp = client.responses.create(
                    model="gpt-4o",
                    tools=[{"type": "web_search_preview"}],
                    input=user_input,
                    stream=True
                )
                for event in stream_resp:
                    if hasattr(event, "output_text") and event.output_text:
                        yield event.output_text
            except Exception as e:
                yield f"\n[Web search error: {str(e)}]"

        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(
        stream_with_context(generate()),
        content_type="text/plain",
        headers={"Access-Control-Allow-Origin": "https://ivf-virtual-training-assistant-dsah.onrender.com"}
    )

# === /websearch ===
@app.route("/websearch", methods=["POST"])
def websearch():
    data = request.get_json()
    user_input = data.get("message", "")
    if not user_input:
        return jsonify({"error": "No input message"}), 400

    def generate():
        try:
            stream_resp = client.responses.create(
                model="gpt-4o",
                tools=[{"type": "web_search_preview"}],
                input=user_input,
                stream=True
            )
            for event in stream_resp:
                if hasattr(event, "output_text") and event.output_text:
                    yield event.output_text
        except Exception as e:
            yield f"\n[Web search error: {str(e)}]"

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
    response = conversation_rag_chain.invoke({
        "chat_history": [],
        "input": "Suggest 25 common and helpful questions users may ask about IVF or IVF protocols and ESHREE guidelines. Return them as a numbered list."
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
    session_id = request.json.get("session_id", str(uuid4()))
    topic = request.json.get("topic", "IVF process diagram")

    rag_prompt = (
        f"You are a diagram assistant. For topic '{topic}', generate a JSON flow chart compatible with React Flow. "
        "Return strictly valid JSON — no markdown, no comments."
    )

    response = conversation_rag_chain.invoke(
        {"chat_history": chat_sessions.get(session_id, []), "input": rag_prompt}
    )
    raw_cleaned = re.sub(r"```json|```", "", response["answer"]).strip()
    flow_data = json.loads(raw_cleaned)

    return jsonify({
        "nodes": flow_data.get("nodes", []),
        "edges": flow_data.get("edges", []),
        "session_id": session_id
    })

# === Run ===
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)





