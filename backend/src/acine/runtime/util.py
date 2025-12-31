"""
Various utility functions.

Currently only contains time (sleep/now) functions.
"""

import asyncio
import time
from functools import lru_cache
from typing import Generic, TypeVar

import cv2

from acine.persist import resolve
from acine.runtime.check_image import ImageBmpType

T = TypeVar("T")
U = TypeVar("U")


def now() -> int:
    """
    Returns current time as milliseconds since the Epoch

    https://stackoverflow.com/a/5998359
    """
    return round(time.time() * 1000)


async def sleep(ms: int) -> None:
    """
    Sleeps for some time in milliseconds.
    `asyncio.sleep` (python in general) uses float seconds
    """
    await asyncio.sleep(ms / 1000)


@lru_cache(maxsize=64)
def get_frame(routine_id: str, frame_id: str) -> ImageBmpType:
    """
    Fetches the image data associated with a frame id. (has cache)
    """
    assert routine_id, "routine_id not set"
    assert frame_id, "frame_id not set"
    path = resolve(routine_id, "img", f"{frame_id}.png")  # probably in BGR
    return cv2.imread(path)  # type: ignore


class IntertaskProcedure(Generic[T, U]):
    """
    For procedures called by one coroutine to be done by a separate coroutine.
    """

    def __init__(self) -> None:
        self.input = asyncio.Queue[T]()
        self.output = asyncio.Queue[U]()
        self.waiting: int = 0

    def __del__(self) -> None:
        assert not self.waiting

    async def call(self, input: T) -> U:
        """From calling side."""
        self.waiting += 1
        await self.input.put(input)
        return await self.output.get()

    async def await_call(self) -> T:
        """From implementation side."""
        return await self.input.get()

    async def resolve(self, output: U) -> None:
        """From implementation side."""
        assert self.waiting
        self.waiting -= 1
        return await self.output.put(output)
