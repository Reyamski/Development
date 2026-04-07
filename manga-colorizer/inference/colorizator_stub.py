"""
STUB — mirrors the exact API of MangaColorizator from manga-colorization-v2.

Used when:
  - Model weights are not yet downloaded
  - Running on a CPU-only / dev machine
  - Testing the API contract end-to-end without GPU

Returns the input image unchanged (no colorization).
Replace by copying the real colorizator.py from:
  https://github.com/qweasdd/manga-colorization-v2
"""

import numpy as np


class MangaColorizatorStub:
    """
    Mirrors MangaColorizator interface exactly:
      stub.set_image(numpy_array, size, apply_denoise, denoise_sigma)
      result = stub.colorize()  # returns numpy float32 [H, W, 3]
    """

    def __init__(self):
        self._image = None
        print("[STUB] MangaColorizatorStub ready — no weights loaded, images returned unchanged")

    def set_image(self, image: np.ndarray, size: int = 576,
                  apply_denoise: bool = True, denoise_sigma: int = 25,
                  **kwargs):
        """Store image; ignore all processing params."""
        if image.max() > 1.0:
            image = image.astype(np.float32) / 255.0
        self._image = image.astype(np.float32)

    def colorize(self) -> np.ndarray:
        """Return the image unchanged."""
        if self._image is None:
            raise RuntimeError("call set_image() before colorize()")
        return self._image
