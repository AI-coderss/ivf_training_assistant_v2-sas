from flask import Blueprint, request, jsonify
from PIL import Image
import numpy as np
import io
import easyocr

ocr_bp = Blueprint('ocr', __name__)
reader = easyocr.Reader(['en'], gpu=False)

@ocr_bp.route("/ocr", methods=["POST"])
def ocr_from_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file uploaded"}), 400

    image_file = request.files['image']
    try:
        image = Image.open(io.BytesIO(image_file.read())).convert("RGB")
        image_np = np.array(image)
        results = reader.readtext(image_np)
        text = ' '.join([res[1] for res in results])
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500