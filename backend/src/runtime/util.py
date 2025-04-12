import asyncio
import time


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
