import os
import fitz  # PyMuPDF
import requests
from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import openai
import tempfile
import traceback
import re

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
    voice = data.get("voice", "fable")
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


if __name__ == "__main__":
    app.run(debug=True, port=5001)