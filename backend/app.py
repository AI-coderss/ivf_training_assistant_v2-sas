import os
import tempfile
from uuid import uuid4
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response
from prompts.prompt import engineeredprompt
from flask_cors import CORS

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.chat_message_histories import ChatMessageHistory

import qdrant_client
import openai

# Load env
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://ivfvirtualtrainingassistantdsah.onrender.com"])

# Memory store for session chat history
store = {}
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

# Load Qdrant vector DB
def get_vector_store():
    client = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY")
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(client=client, collection_name=collection_name, embeddings=embeddings)

vector_store = get_vector_store()

# Memory loader
def get_memory(session_id: str):
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

# RAG Setup
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
        ("user", "{input}"),
    ])
    return create_retrieval_chain(retriever_chain, create_stuff_documents_chain(ChatOpenAI(), prompt))

rag_chain = get_conversational_rag_chain()

chain_with_memory = RunnableWithMessageHistory(
    rag_chain,
    lambda session_id: get_memory(session_id),
    input_messages_key="input",
    history_messages_key="chat_history"
)

# TEXT + AUDIO handler
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
    user_query = data["message"]

    response = chain_with_memory.invoke(
        {"input": user_query},
        config={"configurable": {"session_id": session_id}}
    )

    return jsonify({
        "response": response["answer"],
        "session_id": session_id
    })

# STREAMING endpoint (for live text)
@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    user_query = data.get("message")

    if not user_query:
        return jsonify({"error": "No input message"}), 400

    def generate():
        response = chain_with_memory.stream(
            {"input": user_query},
            config={"configurable": {"session_id": session_id}}
        )
        for chunk in response:
            if "answer" in chunk:
                yield chunk["answer"]

    return Response(generate(), content_type="text/plain")

# Reset chat history
@app.route("/reset", methods=["POST"])
def reset():
    session_id = request.json.get("session_id")
    if session_id and session_id in store:
        del store[session_id]
    return jsonify({"message": "Chat history reset"}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)

