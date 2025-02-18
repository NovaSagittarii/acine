"""
Image persistence / save to disk.
"""

import os
from aiofiles import open

dirname = os.path.dirname(__file__)
path = os.path.join(dirname, "../data")


async def fs_write(filename: str, contents: bytes):
    async with open(os.path.join(path, filename), "wb") as f:
        await f.write(contents)


async def fs_read(filename: str) -> bytes:
    async with open(os.path.join(path, filename), "rb") as f:
        out = await f.read()
    return out
