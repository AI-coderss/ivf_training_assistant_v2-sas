from flask import Blueprint, request, jsonify
import requests
import os

ocr_bp = Blueprint('ocr', __name__)
OCR_SPACE_API_KEY = os.getenv("OCR_SPACE_API_KEY")  # Make sure it's in your .env

@ocr_bp.route("/ocr", methods=["POST"])
def ocr_from_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file uploaded"}), 400

    image_file = request.files['image']

    try:
        response = requests.post(
            'https://api.ocr.space/parse/image',
            files={'file': (
                        'upload.png',  # <-- force a valid filename
                        image_file,
                        image_file.content_type or 'image/png'  # <-- force valid MIME type
                    )},
            data={
                'apikey': OCR_SPACE_API_KEY,
                'language': 'eng',
                'isOverlayRequired': False
            }
        )

        result = response.json()

        # Check for OCR API errors
        if not result.get("IsErroredOnProcessing") and "ParsedResults" in result:
            parsed_text = result["ParsedResults"][0]["ParsedText"]
            return jsonify({"text": parsed_text})
        else:
            # Return detailed error info
            return jsonify({
                "error": "OCR failed",
                "message": result.get("ErrorMessage", "No detailed message"),
                "details": result
            }), 400

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500
