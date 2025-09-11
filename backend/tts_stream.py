import os
import fitz  # PyMuPDF
import requests
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import openai
from openai import OpenAI
import tempfile
import traceback
import re
from dotenv import load_dotenv


from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
from langchain.chains.summarize import load_summarize_chain
from langchain.docstore.document import Document

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
app = Flask(__name__)
CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "https://ivf-virtual-training-assistant-dsah.onrender.com",
                "http://localhost:3000",
            ],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True,
        }
    },
)
openai.api_key = os.getenv("OPENAI_API_KEY")

# Store book in memory so selection doesn't require refetching
BOOK_STORAGE = {"full_text": ""}


# Utility: Split text into chunks
def chunk_text(text, max_chars=2000):
    words = text.split()
    chunks, chunk = [], ""
    for word in words:
        if len(chunk) + len(word) + 1 > max_chars:
            chunks.append(chunk.strip())
            chunk = word
        else:
            chunk += " " + word
    if chunk:
        chunks.append(chunk.strip())
    return chunks


# 1️⃣ Extract PDF text
# @app.route("/extract-pdf-text", methods=["POST"])
# def extract_pdf_text():
#     data = request.json
#     pdf_url = data.get("pdfUrl")
#     start_text = data.get("startText", "").strip()

#     if not pdf_url:
#         return {"error": "No PDF URL provided"}, 400

#     try:
#         response = requests.get(pdf_url)
#         if response.status_code != 200:
#             return {"error": "Failed to fetch PDF"}, 400

#         pdf = fitz.open(stream=response.content, filetype="pdf")
#         full_text = ""
#         for page in pdf:
#             full_text += page.get_text() + "\n"

#         if start_text:
#             idx = full_text.find(start_text)
#             if idx != -1:
#                 full_text = full_text[idx:]

#         return jsonify({"text": full_text})
#     except Exception as e:
#         traceback.print_exc()
#         return {"error": str(e)}, 500


@app.route("/extract-pdf-text", methods=["POST"])
def extract_pdf_text():
    data = request.json
    pdf_url = data.get("pdfUrl")
    start_text = data.get("startText", "").strip()

    try:
        # If start_text provided, we just return from stored full_text
        if start_text and BOOK_STORAGE["full_text"]:
            idx = BOOK_STORAGE["full_text"].find(start_text)
            if idx != -1:
                return jsonify({"text": BOOK_STORAGE["full_text"][idx:]})
            else:
                return jsonify({"text": BOOK_STORAGE["full_text"]})  # fallback

        # Otherwise load PDF fresh (first load)
        if not pdf_url:
            return {"error": "No PDF URL provided"}, 400

        response = requests.get(pdf_url)
        if response.status_code != 200:
            return {"error": "Failed to fetch PDF"}, 400

        pdf = fitz.open(stream=response.content, filetype="pdf")
        full_text = ""
        for page in pdf:
            full_text += page.get_text() + "\n"

        # Store in memory
        BOOK_STORAGE["full_text"] = full_text

        return jsonify({"text": full_text})
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}, 500


# 2️⃣ Generate word timings
@app.route("/tts-timings", methods=["POST"])
def tts_timings():
    """
    Returns word timings and sentence grouping for accurate highlighting.
    """
    text = request.json.get("text", "")
    if not text:
        return {"error": "No text provided"}, 400

    # Split into sentences using punctuation
    sentences = re.split(r"(?<=[.?!])\s+", text.strip())
    timings = []
    time = 0.0
    sentence_timings = []

    for sent_idx, sentence in enumerate(sentences):
        words = sentence.split()
        sentence_start = time
        sentence_word_indices = []

        for word in words:
            word_data = {
                "word": word,
                "start": time,
                "end": time + 0.4,  # 0.4s per word (can be adjusted)
                "sentenceIndex": sent_idx,
            }
            timings.append(word_data)
            sentence_word_indices.append(len(timings) - 1)
            time += 0.4

        sentence_timings.append(
            {
                "sentenceIndex": sent_idx,
                "text": sentence,
                "start": sentence_start,
                "end": time,
                "wordIndices": sentence_word_indices,
            }
        )

    return {"timings": timings, "sentences": sentence_timings}


# 3️⃣ Stream GPT TTS audio for a single chunk
@app.route("/tts-chunk", methods=["POST"])
def tts_chunk():
    data = request.json
    text = data.get("text", "")
    voice = data.get("voice", "ballad")
    model = "gpt-4o-mini-tts"

    if not text:
        return {"error": "No text provided"}, 400

    try:
        print(f"[TTS] Generating chunk of length {len(text)} chars")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp_file:
            tmp_path = tmp_file.name

        # Save directly to temporary file
        with openai.audio.speech.with_streaming_response.create(
            model=model, voice=voice, input=text
        ) as response:
            response.stream_to_file(tmp_path)

        # Return file content to client
        def generate():
            with open(tmp_path, "rb") as f:
                yield from f

        return Response(generate(), mimetype="audio/mpeg")

    except Exception as e:
        print("[TTS ERROR]", e)
        traceback.print_exc()
        return {"error": str(e)}, 500



@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    try:
        data = request.json

        # Get fields
        text = data.get("text", "")
        mode = data.get("mode", "paragraph").lower()
        length = data.get("length", "short").lower()
        tone = data.get("tone", "neutral").lower()
        scope = data.get("scope", "selection").lower()
        extras = data.get("extras", {})

        # Page info / custom range
        page_info = data.get("page_info", {})
        custom_range = data.get("customRange") or page_info.get("customRange", {})

        # Source reference logic
        source_reference = "0"
        if custom_range:
            start = custom_range.get("start")
            end = custom_range.get("end")
            if start and end:
                source_reference = f"{start}" if start == end else f"{start}-{end}"
        elif page_info:
            current_page = page_info.get("currentPage")
            start = page_info.get("startPage")
            end = page_info.get("endPage")
            chapter = page_info.get("chapter")

            if scope == "current page" and current_page:
                source_reference = f"{current_page}"
            elif scope in ["page range", "selection"] and start and end:
                source_reference = f"{start}" if start == end else f"{start}-{end}"
            elif scope == "chapter" and chapter is not None:
                source_reference = f"{chapter}"

        # Length config
        length_config = {
            "short": {"words": 150, "bullets": 5, "tokens": 200},
            "medium": {"words": 300, "bullets": 8, "tokens": 400},
            "long": {"words": 600, "bullets": 12, "tokens": 800},
        }
        length_settings = length_config.get(length, length_config["medium"])

        # Instructions
        instructions = f"Summarize in {mode} format. Tone: {tone}. Scope: {scope}. Length: {length}."
        if mode == "paragraph":
            instructions += " Maintain coherent paragraphs."
        elif mode == "bullets":
            instructions += f" Generate about {length_settings['bullets']} clear bullet points."

        # === Special handling for entire book ===
        if scope == "entire book":
            llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.7)

            # Split text into chunks
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=200)
            docs = [Document(page_content=chunk) for chunk in text_splitter.split_text(text)]

            # Map-reduce summarization chain
            chain = load_summarize_chain(llm, chain_type="map_reduce", verbose=False)

            result = chain.run(docs)
            result = f"{result}\n\n(Source: Entire Book)"
        
        else:
            # Default: direct GPT call (for smaller scopes)
            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant that summarizes text as per user instructions."
                },
                {
                    "role": "user",
                    "content": f"{instructions}\n\nText:\n{text}\n\n(Source: {source_reference})"
                },
            ]
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7,
                max_tokens=length_settings["tokens"],
            )
            result = response.choices[0].message.content.strip()

        return jsonify({
            "result": result,
            "source_reference": source_reference,
            "length_setting": length
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5001)