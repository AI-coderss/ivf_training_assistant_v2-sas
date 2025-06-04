from flask import Flask, request, jsonify, stream_with_context, Response
from flask_cors import CORS
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.messages import AIMessage, HumanMessage
from dotenv import load_dotenv
import os
import tempfile
import base64
from openai import OpenAI

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["https://ivfvirtualtrainingassistantdsah.onrender.com"])

chat_histories = {}
vector_stores = {}
client = OpenAI()

def get_vectorestore_from_path(file_path):
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter()
    doc_chunks = text_splitter.split_documents(documents)
    return FAISS.from_documents(doc_chunks, OpenAIEmbeddings())

def get_context_retriever_chain(vector_store):
    llm = ChatOpenAI()
    retriever = vector_store.as_retriever()
    prompt = ChatPromptTemplate.from_messages([
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}"),
        ("user", "Given the above conversation, generate a search query to look up relevant information.")
    ])
    return create_history_aware_retriever(llm, retriever, prompt)

def get_conversational_rag_chain(retriever_chain):
    llm = ChatOpenAI()
    prompt = ChatPromptTemplate.from_messages([
        ("system", "Answer the user's question given the below context:\n\n{context}"),
        MessagesPlaceholder(variable_name="chat_history"),
        ("user", "{input}")
    ])
    stuff_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever_chain, stuff_chain)

@app.route('/chatwithbooks/upload', methods=['POST'])
def upload_pdf():
    file = request.files['file']
    user_id = request.form.get("user_id", "default_user")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            file.save(tmp.name)

            # Step 1: Build vector store from PDF
            vector_store = get_vectorestore_from_path(tmp.name)
            vector_stores[user_id] = vector_store
            chat_histories[user_id] = [
                AIMessage(content="Hello! I'm your book assistant. How can I help you today?")
            ]

            # Step 2: Generate suggested questions using RAG
            retriever_chain = get_context_retriever_chain(vector_store)
            conversation_chain = get_conversational_rag_chain(retriever_chain)

            response = conversation_chain.invoke({
                "chat_history": [],
                "input": "Suggest 5 questions to understand this book better."
            })

            suggestions = response.get("answer", "").split("\n")
            questions = [q.strip("•- 1234567890.") for q in suggestions if q.strip()]

            # Step 3: Return signal to frontend that embedding is complete
            return jsonify({
                "embedding_done": True,
                "message": "Embedding completed successfully.",
                "suggested_questions": questions[:5]
            }), 200

    except Exception as e:
        print(f"[ERROR] Upload failed: {e}")
        return jsonify({
            "embedding_done": False,
            "error": "Embedding or question generation failed.",
            "details": str(e)
        }), 500

@app.route('/chatwithbooks/message', methods=['POST'])
def chat_message():
    data = request.get_json()
    user_input = data['message']
    user_id = data.get('user_id', 'default_user')

    if user_id not in chat_histories or user_id not in vector_stores:
        return jsonify({"error": "No vector store found. Please upload a PDF first."}), 400

    chat_history = chat_histories[user_id]
    vector_store = vector_stores[user_id]
    retriever_chain = get_context_retriever_chain(vector_store)
    conversation_chain = get_conversational_rag_chain(retriever_chain)

    def generate():
        for chunk in conversation_chain.stream({
            "chat_history": chat_history,
            "input": user_input
        }):
            content = chunk.get("answer", "")
            yield content

    chat_histories[user_id].append(HumanMessage(content=user_input))
    return Response(stream_with_context(generate()), content_type='text/plain')

@app.route('/chatwithbooks/reset', methods=['POST'])
def reset_chat():
    user_id = request.form.get("user_id", "default_user")
    chat_histories[user_id] = []
    vector_stores.pop(user_id, None)
    return jsonify({"message": "Session reset."})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
