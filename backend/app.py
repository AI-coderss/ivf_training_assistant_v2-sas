import os
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from prompts.prompt import engineeredprompt
import qdrant_client
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.runnables import RunnableLambda
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_qdrant import Qdrant
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_community.chat_message_histories import ChatMessageHistory
from uuid import uuid4

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "https://ivfvirtualtrainingassistantdsah.onrender.com"])


# Load Qdrant collection name
collection_name = os.getenv("QDRANT_COLLECTION_NAME")

# Memory storage (per-session example, simple in-memory store)
store = {}

def get_memory(session_id: str) -> ChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

# Initialize vector store
def get_vector_store():
    client = qdrant_client.QdrantClient(
        url=os.getenv("QDRANT_HOST"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )
    embeddings = OpenAIEmbeddings()
    return Qdrant(
        client=client,
        collection_name=collection_name,
        embeddings=embeddings,
    )

vector_store = get_vector_store()

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
    stuff_documents_chain = create_stuff_documents_chain(ChatOpenAI(), prompt)
    return create_retrieval_chain(retriever_chain, stuff_documents_chain)

# Wrap with memory handling
rag_chain = get_conversational_rag_chain()
chain_with_memory = RunnableWithMessageHistory(
    rag_chain,
    lambda session_id: get_memory(session_id),
    input_messages_key="input",
    history_messages_key="chat_history"
)

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    user_query = data.get("message", "")
    session_id = data.get("session_id", str(uuid4()))  # use UUID if not passed

    if not user_query:
        return jsonify({"response": "No message provided"}), 400

    response = chain_with_memory.invoke(
        {"input": user_query},
        config={"configurable": {"session_id": session_id}}
    )

    return jsonify({"response": response["answer"], "session_id": session_id})

@app.route("/reset", methods=["POST"])
def reset():
    session_id = request.json.get("session_id")
    if session_id and session_id in store:
        del store[session_id]
    return jsonify({"message": "Chat history reset"}), 200

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)