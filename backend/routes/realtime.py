from flask import Blueprint, jsonify, request
from openai import OpenAI
import os

bp_realtime = Blueprint("realtime_routes", __name__)

@bp_realtime.get("/realtime-key")
def get_realtime_key():
    """
    Creates a realtime session and returns the short‑lived client_secret.
    Frontend uses it to perform the WebRTC SDP exchange directly with OpenAI.
    """
    model = request.args.get("model", "gpt-4o-realtime-preview-2024-12-17")
    voice = request.args.get("voice", "alloy")

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    session = client.beta.realtime.sessions.create(
        model=model,
        voice=voice,
        turn_detection={"type": "server_vad", "threshold": 0.5},
        output_audio_format="pcm16"
    )

    return jsonify(
        client_secret=session.client_secret.value,
        session_id=session.id,
        expires_at=session.client_secret.expires_at
    )