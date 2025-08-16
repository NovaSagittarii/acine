"""
Various utility functions.

Currently only contains time (sleep/now) functions.
"""

import asyncio
import time
from functools import lru_cache

import cv2
from acine.persist import resolve


def now() -> int:
    """
    Returns current time as milliseconds since the Epoch

    https://stackoverflow.com/a/5998359
    """
    return round(time.time() * 1000)


async def sleep(ms: int):
    """
    Sleeps for some time in milliseconds.
    `asyncio.sleep` (python in general) uses float seconds
    """
    await asyncio.sleep(ms / 1000)


@lru_cache(maxsize=64)
def get_frame(routine_id: str, frame_id: str) -> cv2.typing.MatLike:
    """
    Fetches the image data associated with a frame id. (has cache)
    """
    assert routine_id, "routine_id not set"
    assert frame_id, "frame_id not set"
    path = resolve(routine_id, "img", f"{frame_id}.png")  # probably in BGR
    return cv2.imread(path)
