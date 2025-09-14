import os
import json
import time
from typing import List, Dict, Any, Optional

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
import asyncio
import concurrent.futures


load_dotenv()

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
DEFAULT_TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
SAVE_LAST_TO = os.getenv("SAVE_LAST_TO", "last_generated_quiz.json")

app = Flask(__name__)
CORS(app, resources={
    r"/generate/*": {
        "origins": [
            "http://localhost:3000",
            "https://ivf-virtual-training-assistant-dsah.onrender.com",
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }
})

def build_prompt(text: str, quiz_type: str, difficulty: str, count: int) -> str:
    """
    Build a single prompt asking the model to return strict JSON with arrays.
    We ask the model to ONLY output JSON (no narrative) and provide format examples.
    """
    # sanitize
    difficulty = difficulty or "medium"
    quiz_type = quiz_type or "both"
    count = int(count)

    prompt = f"""
You are a helpful assistant that generates quiz questions (MCQs and/or True/False)
from a passage of text. Output MUST be valid JSON and nothing else.

Inputs:
- Text (the passage below) from which to create questions.
- quiz_type: one of "MCQ", "TrueFalse", or "both".
- difficulty: "easy", "medium", or "hard".
- count: number of questions requested (integer). If you cannot produce that many,
  return as many as you can but do not invent extra text that wasn't based on the passage.

Output JSON schema (exact keys and structure):
{{
  "meta": {{
    "generated_at": "<ISO8601 timestamp>",
    "quiz_type": "{quiz_type}",
    "difficulty": "{difficulty}",
    "requested_count": {count},
    "actual_count": <integer>
  }},
  "questions": [ ... ]   // list of question objects as described below
}}

Each question object must be exactly one of the following shapes:

MCQ:
{{
  "type": "mcq",
  "question": "<question text>",
  "options": ["opt1", "opt2", "opt3", "opt4"],
  "correctAnswer": "<one of the option strings exactly>",
  "source_snippet": "<short excerpt (<= 160 chars) from the provided text supporting the answer>",
  "difficulty": "{difficulty}"
}}

True/False:
{{
  "type": "truefalse",
  "question": "<question text>",
  "options": ["True", "False"],
  "correctAnswer": "True" | "False",
  "source_snippet": "<short excerpt (<= 160 chars) from the provided text supporting the answer>",
  "difficulty": "{difficulty}"
}}

Rules:
1. MUST only return valid JSON (no preceding or trailing commentary).
2. Use the provided text to create correct answers. Do NOT hallucinate facts outside the text.
3. Keep source_snippet short (<=160 chars) exactly as it appears in the provided text if possible.
4. For MCQ, provide 4 options. Distractors should be plausible and consistent with the passage.
5. actual_count must equal the number of items in questions array.

Now generate {count} question(s) for quiz_type={quiz_type} and difficulty={difficulty} from the following text:

=== BEGIN TEXT ===
{text}
=== END TEXT ===

Return the JSON now.
""".strip()
    return prompt

client = OpenAI()

def call_openai_chat(prompt: str, model: str = DEFAULT_MODEL, temperature: float = DEFAULT_TEMPERATURE) -> str:
    """
    Call the OpenAI Chat API in a safe wrapper.
    Returns the assistant content (string).
    """
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are a strict JSON generator for quiz questions."},
            {"role": "user", "content": prompt}
        ],
        temperature=temperature,
        max_tokens=1400,
        n=1,
    )
    return resp.choices[0].message.content


def safe_parse_json(maybe_json: str) -> Optional[Dict[str, Any]]:
    """
    Try parse JSON even if model adds trailing text. Strip before/after.
    """
    # find the first '{' and the last '}' and slice
    try:
        start = maybe_json.index("{")
        end = maybe_json.rindex("}") + 1
        piece = maybe_json[start:end]
        return json.loads(piece)
    except Exception:
        try:
            return json.loads(maybe_json)
        except Exception:
            return None


def fallback_generator(text: str, quiz_type: str, difficulty: str, count: int) -> Dict[str, Any]:
    """
    Simple deterministic fallback if OpenAI fails.
    Generates simpler questions (extraction-based).
    """
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    questions = []
    i = 0

    def make_mcq_from_sentence(sent: str, idx: int):
        # simplistic MCQ: blank out a short noun phrase (first 3 words)
        words = sent.split()
        if len(words) < 4:
            return None
        answer = " ".join(words[:3])
        options = [answer, "A) " + " ".join(words[-3:]), "None of the above", "Both A and B"]
        return {
            "type": "mcq",
            "question": f"In the passage: '{sent[:120]}', which of the following matches the beginning of the sentence?",
            "options": options,
            "correctAnswer": answer,
            "source_snippet": (sent[:160]).strip(),
            "difficulty": difficulty
        }

    def make_tf_from_sentence(sent: str, idx: int):
        # ask true/false whether the sentence contains a keyword
        keyword = sent.split()[0]
        question = f"True or False: The passage states that '{keyword}' is mentioned."
        return {
            "type": "truefalse",
            "question": question,
            "options": ["True", "False"],
            "correctAnswer": "True",
            "source_snippet": (sent[:160]).strip(),
            "difficulty": difficulty
        }

    while len(questions) < count and i < len(sentences):
        s = sentences[i]
        if quiz_type.lower() in ("mcq", "both"):
            mcq = make_mcq_from_sentence(s, i)
            if mcq:
                questions.append(mcq)
        if len(questions) < count and quiz_type.lower() in ("truefalse", "both"):
            tf = make_tf_from_sentence(s, i)
            questions.append(tf)
        i += 1

    return {
        "meta": {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "quiz_type": quiz_type,
            "difficulty": difficulty,
            "requested_count": count,
            "actual_count": len(questions),
            "fallback": True
        },
        "questions": questions
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "quiz-generator", "version": "1.0"})


def chunk_text(text: str, chunk_size: int = 3000, chunk_overlap: int = 200):
    """
    Split long text into safe chunks for the model.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
    )
    return splitter.split_text(text)



def process_chunk(chunk, quiz_type, difficulty, count, model, temperature):
    prompt = build_prompt(chunk, quiz_type, difficulty, count)
    raw = call_openai_chat(prompt, model=model, temperature=temperature)
    parsed = safe_parse_json(raw)
    return parsed["questions"] if parsed and "questions" in parsed else []

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json(force=True)
    text = data.get("text", "")
    if not text.strip():
        return jsonify({"error": "Missing 'text'"}), 400

    quiz_type = data.get("quiz_type", "both")
    difficulty = data.get("difficulty", "medium")
    count = int(data.get("count", 10))

    chunks = chunk_text(text)
    per_chunk = count // len(chunks) or 1

    all_questions = []
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(process_chunk, chunk, quiz_type, difficulty, per_chunk, DEFAULT_MODEL, DEFAULT_TEMPERATURE)
            for chunk in chunks
        ]
        for f in concurrent.futures.as_completed(futures):
            all_questions.extend(f.result())

    final_response = {
        "meta": {
            "requested_count": count,
            "actual_count": len(all_questions),
            "quiz_type": quiz_type,
            "difficulty": difficulty,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        },
        "questions": all_questions[:count]
    }
    return jsonify(final_response)


@app.route("/last", methods=["GET"])
def last():
    """Return last saved generated quiz (development helper)"""
    if not os.path.exists(SAVE_LAST_TO):
        return jsonify({"error": "No last generated quiz saved."}), 404
    with open(SAVE_LAST_TO, "r", encoding="utf-8") as fh:
        return jsonify(json.load(fh))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5003")), debug=True)