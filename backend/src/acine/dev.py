from __future__ import annotations

from time import time


class Timer:
    """
    Debug timer class for timing how slow a section is.
    """

    def __init__(self, label: str = ""):
        self.label = label
        self.t0 = 0.0

    def __enter__(self) -> Timer:
        self.t0 = time()
        return self

    def __exit__(self, *args: object) -> None:
        d = time() - self.t0
        if d > 0.02:
            print(f"SLOW t={(d * 1e3):1f}ms", self.label)
