import os
import tempfile
from uuid import uuid4
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import openai
import qdrant_client

from prompts.prompt import engineeredprompt
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.chat_message_histories.in_memory import ChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://ivfvirtualtrainingassistantdsah.onrender.com"])

# === SESSION STATE ===
chat_sessions = {}
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

# === VECTOR DB ===
def get_vector_store():
    client = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(client=client, collection_name=collection_name, embeddings=embeddings)

vector_store = get_vector_store()

# === CONVERSATIONAL RAG SETUP ===
def get_context_retriever_chain():
    retriever = vector_store.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder("chat_history"),
        ("user", "{input}"),
        ("user", "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation"),
    ])
    return create_history_aware_retriever(ChatOpenAI(), retriever, prompt)

def get_conversational_rag_chain():
    retriever_chain = get_context_retriever_chain()
    prompt = ChatPromptTemplate.from_messages([
        ("system", engineeredprompt),
        MessagesPlaceholder("chat_history"),
        ("user", "{input}")
    ])
    return create_retrieval_chain(retriever_chain, create_stuff_documents_chain(ChatOpenAI(), prompt))

rag_chain = get_conversational_rag_chain()

# === MEMORY WRAPPER ===
def get_memory(session_id):
    history = ChatMessageHistory()
    if session_id in chat_sessions:
        for msg in chat_sessions[session_id]:
            if msg["role"] == "user":
                history.add_user_message(msg["content"])
            elif msg["role"] == "assistant":
                history.add_ai_message(msg["content"])
    return history

chain_with_memory = RunnableWithMessageHistory(
    rag_chain,
    lambda session_id: get_memory(session_id),
    input_messages_key="input",
    history_messages_key="chat_history",
)

# === /generate endpoint ===
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

    if not data or not data.get("message"):
        return jsonify({"response": "No input provided"}), 400

    session_id = session_id or data.get("session_id") or str(uuid4())
    user_input = data["message"]

    # Invoke the RAG chain
    response = chain_with_memory.invoke(
        {"input": user_input},
        config={"configurable": {"session_id": session_id}},
    )
    answer = response["answer"]

    # Store in session memory
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    chat_sessions[session_id].append({"role": "user", "content": user_input})
    chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return jsonify({
        "response": answer,
        "session_id": session_id
    })

# === /stream endpoint ===
@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    user_input = data.get("message")

    if not user_input:
        return jsonify({"error": "No input message"}), 400

    def generate():
        answer = ""
        for chunk in chain_with_memory.stream(
            {"input": user_input},
            config={"configurable": {"session_id": session_id}},
        ):
            token = chunk.get("answer", "")
            answer += token
            yield token

        # Append to session memory after complete
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []
        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(generate(), content_type="text/plain")

# === /reset endpoint ===
@app.route("/reset", methods=["POST"])
def reset():
    session_id = request.json.get("session_id")
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    return jsonify({"message": "Session reset"}), 200

@app.route("/start-quiz", methods=["POST"])
def start_quiz():
    try:
        session_id = request.json.get("session_id", str(uuid4()))
        topic = request.json.get("topic", "IVF")

        rag_prompt = (
            f"Generate 20 {topic}-related multiple-choice questions in pure JSON format: "
            "[{ \"id\": \"q1\", \"text\": \"...\", \"options\": [...], \"correct\": \"...\" }, ...]"
        )

        response = chain_with_memory.invoke(
            {"input": rag_prompt},
            config={"configurable": {"session_id": session_id}},
        )

        raw_answer = response["answer"]
        print("RAG returned:", raw_answer)

        import json
        questions = json.loads(raw_answer)

        return jsonify({ "questions": questions, "session_id": session_id })

    except Exception as e:
        print("❌ Error in /start-quiz:", str(e))
        return jsonify({
            "error": "Failed to generate quiz",
            "details": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)


