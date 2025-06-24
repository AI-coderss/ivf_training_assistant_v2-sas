import os
import base64
from dotenv import load_dotenv
from flask import Flask, request, Response, jsonify, stream_with_context
from flask_cors import CORS
from uuid import uuid4
from langchain_qdrant import Qdrant
import qdrant_client
from prompts.prompt import engineeredprompt
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from openai import OpenAI

load_dotenv()
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

chat_sessions = {}
client = OpenAI()

def get_vector_store():
    client_qdrant = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY"),
       
    )
    embeddings = OpenAIEmbeddings()
    vector_store = Qdrant(
        client=client_qdrant,
        collection_name=collection_name,
        embeddings=embeddings,
    )
    return vector_store

vector_store = get_vector_store()

def get_context_retriever_chain(vector_store=vector_store):
    llm = ChatOpenAI()
    retriever = vector_store.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        (
            "user",
            "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
        ),
    ])
    return create_history_aware_retriever(llm, retriever, prompt)

def get_conversational_rag_chain(retriever_chain):
    llm = ChatOpenAI()
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
           engineeredprompt,
        ),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
    ])
    stuff_documents_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever_chain, stuff_documents_chain)

@app.route("/stream", methods=["POST"])
def stream():
    data = request.get_json()
    session_id = data.get("session_id", str(uuid4()))
    user_input = data.get("message")

    if not user_input:
        return jsonify({"error": "No input message"}), 400

    if session_id not in chat_sessions:
        chat_sessions[session_id] = []

    retriever_chain = get_context_retriever_chain()
    conversation_rag_chain = get_conversational_rag_chain(retriever_chain)

    def generate():
        answer = ""
        for chunk in conversation_rag_chain.stream(
            {"chat_history": chat_sessions[session_id], "input": user_input}
        ):
            token = chunk.get("answer", "")
            answer += token
            yield token
        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(
        stream_with_context(generate()),
        content_type="text/plain",
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"}
    )

@app.route("/tts", methods=["POST"])
def tts():
    data = request.json
    text = data.get("text", "")
    response = client.audio.speech.create(model="tts-1", voice="fable", input=text)
    audio_file = "temp_audio.mp3"
    response.stream_to_file(audio_file)
    with open(audio_file, "rb") as f:
        audio_bytes = f.read()
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    return jsonify({"audio_base64": audio_base64})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)