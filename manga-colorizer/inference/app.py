"""
Inference service — Flask wrapper around manga-colorization-v2.

Setup (on a GPU machine):
  1. Clone https://github.com/qweasdd/manga-colorization-v2
  2. Copy these files into this directory:
       - colorizator.py
       - networks/  (models.py, extractor.py)
       - denoising/ (denoiser.py, models.py, functions.py, utils.py)
       - utils/     (utils.py)
  3. Download model weights:
       - generator.zip  → inference/networks/generator.zip
       - extractor.pth  → inference/networks/extractor.pth
       - net_rgb.pth    → inference/denoising/models/net_rgb.pth
  4. pip install -r requirements.txt
  5. python app.py
"""

import os
import io
import traceback
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')  # headless — no display needed
import matplotlib.pyplot as plt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image

# ---------------------------------------------------------------------------
# Lazy-load the colorizer so the service starts even without model weights.
# On first /colorize request it will attempt to load; stub is used as fallback.
# ---------------------------------------------------------------------------
_colorizer = None
_using_stub = False


def get_colorizer():
    global _colorizer, _using_stub
    if _colorizer is not None:
        return _colorizer

    device = os.environ.get('DEVICE', 'cuda')

    # Try real colorizator first
    try:
        from colorizator import MangaColorizator
        _colorizer = MangaColorizator(
            device=device,
            generator_path='networks/generator.zip',
            extractor_path='networks/extractor.pth',
        )
        _using_stub = False
        print(f"[inference] MangaColorizator loaded on {device}")
    except Exception as e:
        print(f"[inference] Real colorizator unavailable ({e}), falling back to stub")
        from colorizator_stub import MangaColorizatorStub
        _colorizer = MangaColorizatorStub()
        _using_stub = True

    return _colorizer


app = Flask(__name__)
CORS(app)

ALLOWED_EXT = {'.png', '.jpg', '.jpeg', '.webp'}


def pil_to_numpy_rgb(pil_image: Image.Image) -> np.ndarray:
    """Convert PIL image to float32 RGB numpy array in [0, 1] range."""
    img = pil_image.convert('RGB')
    return np.array(img, dtype=np.float32) / 255.0


def numpy_to_pil(arr: np.ndarray) -> Image.Image:
    """Convert float32 numpy array [0,1] to PIL Image."""
    clipped = np.clip(arr, 0.0, 1.0)
    return Image.fromarray((clipped * 255).astype(np.uint8))


@app.get('/health')
def health():
    networks_ok = (
        Path('networks/generator.zip').exists()
        and Path('networks/extractor.pth').exists()
    )
    denoiser_ok = Path('denoising/models/net_rgb.pth').exists()
    return jsonify({
        'status': 'ok',
        'colorizer_loaded': _colorizer is not None,
        'using_stub': _using_stub,
        'weights': {
            'networks': networks_ok,
            'denoiser': denoiser_ok,
        },
    })


@app.post('/colorize')
def colorize():
    if 'image' not in request.files:
        return jsonify({'error': 'No image field in request'}), 400

    output_path = request.form.get('output_path')
    if not output_path:
        return jsonify({'error': 'output_path is required'}), 400

    file = request.files['image']
    suffix = Path(file.filename or 'file.png').suffix.lower()
    if suffix not in ALLOWED_EXT:
        return jsonify({'error': f'Unsupported file type: {suffix}'}), 400

    # Parse optional params
    size = int(request.form.get('size', 576))
    apply_denoise = request.form.get('denoise', 'true').lower() == 'true'
    denoise_sigma = int(request.form.get('denoise_sigma', 25))

    if size % 32 != 0:
        return jsonify({'error': 'size must be divisible by 32'}), 400

    try:
        pil_img = Image.open(file.stream)
        img_array = pil_to_numpy_rgb(pil_img)

        colorizer = get_colorizer()

        # Real MangaColorizator API: set_image → colorize
        colorizer.set_image(
            img_array,
            size=size,
            apply_denoise=apply_denoise,
            denoise_sigma=denoise_sigma,
        )
        result = colorizer.colorize()  # returns numpy float32 [0,1]

        output_image = numpy_to_pil(result)
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        output_image.save(output_path, 'PNG')

        return jsonify({
            'output_path': output_path,
            'status': 'done',
            'stub': _using_stub,
        })

    except Exception:
        return jsonify({'error': traceback.format_exc()}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Pre-warm on startup if weights exist
    if Path('networks/generator.zip').exists():
        print("[inference] Pre-warming colorizer...")
        get_colorizer()
    app.run(host='0.0.0.0', port=port, debug=False)
