import os
import tempfile
from uuid import uuid4
from datetime import datetime
import json
import re
import base64
import io
from uuid import uuid4
from dotenv import load_dotenv
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import openai
import qdrant_client
from openai import OpenAI
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
CORS(app, origins=["https://ivfvirtualtrainingassistantdsah.onrender.com","https://ivf-virtual-training-assistant-dsah.onrender.com"])

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
    # Initialize OpenAI client
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def generate_response():
        answer = ""
        use_web_search = False
        sources = []

        # Step 1: Try RAG (vector-based)
        try:
            for chunk in chain_with_memory.stream(
                {"input": user_input},
                config={"configurable": {"session_id": session_id}},
            ):
                token = chunk.get("answer", "")
                answer += token
                yield token
        except Exception as e:
            yield f"\n[Vector error: {str(e)}]"
            use_web_search = True

        # Step 2: Fallback trigger phrases
        fallback_triggers = [
            "i don't know", "i'm not sure", 
            "I can't browse the web",
            "I cannot access the internet", "I cannot search the web",
            "no relevant", "cannot find", 
            "sorry", "unavailable", "unable to answer",
            "not enough information",
            "I currently do not have browsing capabilities",
            "I can't browse the web in real-time to provide the latest information",
            "I cannot access the internet to look up current information",
            "I cannot perform web searches or access external databases",
            "I can't browse the web in real-time to provide the latest information",
            "I do not have the capability to access real-time information",
            "I cannot access the internet to look up current information",

        ]
        if any(trigger in answer.lower() for trigger in fallback_triggers):
            use_web_search = True

        # Step 3: If needed, switch to Web Search
        if use_web_search:
            yield "[WEB_SEARCH_INITIATED]\n"
            try:
                stream = client.responses.create(
                    model="gpt-4.1",
                    input=[{ "role": "user", "content": user_input }],
                    tools=[{ "type": "web_search_preview" }],
                    stream=True
                )

                for event in stream:
                    if hasattr(event, "delta") and event.delta:
                        yield event.delta
                    elif hasattr(event, "citations"):
                        sources.extend(event.citations)
                    elif getattr(event, "type", "") == "response.output_text.done":
                        break

                if sources:
                    yield "\n\n📚 **Sources:**\n"
                    for i, src in enumerate(sources, 1):
                        title = src.get("title", f"Source {i}")
                        url = src.get("url", "#")
                        yield f"- [{title}]({url})\n"

            except Exception as e:
                yield f"\n[Web search error: {str(e)}]"

        # Step 4: Store chat memory
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []

        chat_sessions[session_id].append({"role": "user", "content": user_input})
        chat_sessions[session_id].append({"role": "assistant", "content": answer})

    return Response(generate_response(), content_type="text/plain")

# === /websearch endpoint ===
@app.route("/websearch", methods=["POST"])
def websearch():
    data = request.get_json()
    user_input = data.get("message")
    if not user_input:
        return jsonify({"error": "Missing user input"}), 400
    # Initialize OpenAI client
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def stream_web_response():
        sources = []

        try:
            stream = client.responses.create(
                model="gpt-4.1",
                input=[{ "role": "user", "content": user_input }],
                tools=[{ "type": "web_search_preview" }],
                stream=True
            )

            for event in stream:
                if hasattr(event, "delta") and event.delta:
                    yield event.delta
                elif hasattr(event, "citations"):
                    sources.extend(event.citations)
                elif getattr(event, "type", "") == "response.output_text.done":
                    break

            # 🔗 Append source links at the end
            if sources:
                yield "\n\n📚 **Sources:**\n"
                for i, src in enumerate(sources, 1):
                    title = src.get("title", f"Source {i}")
                    url = src.get("url", "#")
                    yield f"- [{title}]({url})\n"

        except Exception as e:
            yield f"\n[Web search error: {str(e)}]"

    return Response(stream_web_response(), content_type="text/plain")
# === /tts endpoint ===
# Initialize OpenAI TTS client
tts_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
@app.route("/tts", methods=["POST"])
def tts():
    text = (request.json or {}).get("text", "").strip()
    if not text:
        return jsonify({"error": "No text supplied"}), 400

    try:
        # PCM streaming output
        pcm_stream = tts_client.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice="coral",
            input=text,
            instructions="Speak in a friendly tone.",
            response_format="pcm",  # raw 16-bit 48-kHz PCM stream
        )
    except Exception as e:
        print("TTS error:", e)
        return jsonify({"error": "TTS failed"}), 500

    # Convert PCM-bytes → base64 chunk-by-chunk
    @stream_with_context
    def gen():
        for chunk in pcm_stream.iter_bytes():
            # encode small chunk to base64 (keep chunks small for smooth stream)
            b64 = base64.b64encode(chunk).decode("ascii")
            yield b64
        # mark end for the browser
        yield "[[END_OF_AUDIO]]"

    # text/plain so fetch() treats it as text stream
    return Response(gen(), mimetype="text/plain")
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
        difficulty = request.json.get("difficulty", "mixed")  # ✅ new param

        rag_prompt = (
            f"You are an IVF virtual training assistant. Generate exactly 20 multiple-choice questions on '{topic}'. "
            f"Each question must reflect '{difficulty}' difficulty level. Return them strictly as a JSON array. "
            "Each object must follow this format:\n"
            '{ "id": "q1", "text": "...", "options": ["A", "B", "C", "D"], "correct": "B", "difficulty": "easy" }\n'
            "Respond ONLY with valid JSON — no markdown, commentary, or explanations."
        )

        # 🧠 Ask AI via RAG
        response = chain_with_memory.invoke(
            {"input": rag_prompt},
            config={"configurable": {"session_id": session_id}},
        )
        raw_answer = response["answer"]
        print("✅ AI response received")

        # 🔍 Clean and parse JSON safely
        raw_cleaned = re.sub(r"```json|```", "", raw_answer).strip()
        questions = json.loads(raw_cleaned)

        # ✅ Validate structure
        if not isinstance(questions, list) or not all(
            "text" in q and "options" in q and "correct" in q and "difficulty" in q for q in questions
        ):
            raise ValueError("Parsed questions are not valid or missing difficulty field.")

        print("✅ Parsed question example:", questions[0])

        # 💾 Save history (optional)
        if session_id not in chat_sessions:
            chat_sessions[session_id] = []
        chat_sessions[session_id].append({"role": "user", "content": rag_prompt})
        chat_sessions[session_id].append({"role": "assistant", "content": raw_answer})

        return jsonify({
            "questions": questions,
            "session_id": session_id
        })

    except Exception as e:
        print("❌ Failed to parse quiz questions:", str(e))
        print("🛠 Raw AI output:", raw_answer if 'raw_answer' in locals() else "No output")

        return jsonify({
            "error": "Failed to generate valid quiz from AI response.",
            "details": str(e)
        }), 500
    
@app.route("/quiz-feedback-stream", methods=["POST"])
def quiz_feedback_stream():
    try:
        data = request.get_json()
        session_id = data.get("session_id", str(uuid4()))
        prompt = data.get("prompt") or data.get("message", "").strip()
        context_items = data.get("context", [])  # 💡 Injected Q&A context from frontend

        # Build context string from failed Q&A
        context_string = "\n".join([
            f"Q: {item['text']}\nUser Answer: {item['userAnswer']}\nCorrect Answer: {item['correct']}"
            for item in context_items
        ]) if context_items else ""

        if not prompt:
            return jsonify({"error": "Missing prompt or message"}), 400

        # Final input includes both context and question
        full_prompt = (
            f"You are a helpful IVF tutor. The following questions were answered incorrectly by the trainee:\n\n"
            f"{context_string}\n\nNow answer this question:\n{prompt}"
        )

        def stream_response():
            for chunk in chain_with_memory.stream(
                {"input": full_prompt},
                config={"configurable": {"session_id": session_id}}
            ):
                yield chunk.get("answer", "")

        return Response(stream_response(), content_type="text/plain")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

performance_log = []

@app.route("/submit-quiz", methods=["POST"])
def submit_quiz():
    try:
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
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/quiz-performance", methods=["GET"])
def quiz_performance():
    try:
        attempts = [entry["attempt"] for entry in performance_log]
        scores = [entry["score"] for entry in performance_log]
        correct = [entry["correct"] for entry in performance_log]
        durations = [entry["duration"] for entry in performance_log]
        timestamps = [entry["timestamp"] for entry in performance_log]

        return jsonify({
            "attempt": attempts,
            "score": scores,
            "correct_answers": correct,
            "duration_minutes": durations,
            "timestamp": timestamps
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route("/suggestions", methods=["GET"])
def suggestions():
    try:
        # ✅ Use your persistent vector store & default RAG chain
        conversation_chain = get_conversational_rag_chain()

        # ✅ Ask the AI to generate common questions
        response = conversation_chain.invoke({
            "chat_history": [],
            "input": "Suggest 25 common and helpful questions users may ask about IVF or IVF protocols and ESHREE guidelines. Return them as a numbered list."
        })

        raw = response.get("answer", "")
        lines = raw.split("\n")
        questions = [re.sub(r"^[\s•\-\d\.\)]+", "", line).strip() for line in lines if line.strip()]

        return jsonify({
            "suggested_questions": questions[:25]
        }), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to generate suggested questions.",
            "details": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)


