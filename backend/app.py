import os
import tempfile
from uuid import uuid4
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from prompts.prompt import engineeredprompt
import openai
import qdrant_client

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://ivfvirtualtrainingassistantdsah.onrender.com"])

# === Memory store for chat sessions ===
chat_sessions = {}

# === Qdrant Vector Store ===
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

def get_vector_store():
    client = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY")
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(client=client, collection_name=collection_name, embeddings=embeddings)

vector_store = get_vector_store()

# === Chat Model ===
llm = ChatOpenAI(model="gpt-4")

# === Helper: Build full message list ===
def build_prompt_messages(history, user_input):
    messages = [{"role": "system", "content": engineeredprompt}]
    for entry in history:
        messages.append({"role": "user", "content": entry["user"]})
        messages.append({"role": "assistant", "content": entry["bot"]})
    messages.append({"role": "user", "content": user_input})
    return messages

# === Handle /generate for both text and audio ===
@app.route("/generate", methods=["POST"])
def generate():
    session_id = request.form.get("session_id") or request.args.get("session_id")
    data = {}

    if request.content_type.startswith("multipart/form-data"):
        audio_file = request.files.get("audio")
        if not audio_file:
            return jsonify({"response": "No audio file provided"}), 400

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp:
            audio_path = temp.name
            audio_file.save(audio_path)

        with open(audio_path, "rb") as af:
            transcript = openai.Audio.transcribe("whisper-1", af)["text"]
        os.remove(audio_path)
        data["message"] = transcript
    else:
        data = request.get_json()

    user_query = data.get("message", "")
    session_id = session_id or data.get("session_id") or str(uuid4())
    if not user_query:
        return jsonify({"response": "No input provided"}), 400

    chat_history = chat_sessions.get(session_id, [])

    # Build prompt from full history
    messages = build_prompt_messages(chat_history, user_query)

    # Get completion
    response = llm.invoke(messages)
    answer = response.content

    # Save new turn in memory
    chat_history.append({
        "user": user_query,
        "bot": answer
    })
    chat_sessions[session_id] = chat_history

    return jsonify({"response": answer, "session_id": session_id})

# === Stream endpoint ===
@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    user_query = data.get("message", "")

    if not user_query:
        return jsonify({"error": "No input"}), 400

    chat_history = chat_sessions.get(session_id, [])
    messages = build_prompt_messages(chat_history, user_query)

    def generate():
        chunks = llm.stream(messages)
        answer = ""
        for chunk in chunks:
            token = chunk.content
            if token:
                answer += token
                yield token

        # Update history after full response
        chat_history.append({
            "user": user_query,
            "bot": answer
        })
        chat_sessions[session_id] = chat_history

    return Response(generate(), content_type="text/plain")

# === Reset chat history ===
@app.route("/reset", methods=["POST"])
def reset():
    session_id = request.json.get("session_id")
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return jsonify({"message": "Session reset"}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)


