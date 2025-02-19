"""
Image persistence / save to disk.
"""

import os
from aiofiles import open as aopen

dirname = os.path.dirname(__file__)
path = os.path.join(dirname, "..", "data")


async def fs_write(filename: list[str], contents: bytes):
    """
    write as binary to file
    """
    async with aopen(os.path.join(path, *filename), "wb") as f:
        await f.write(contents)


def fs_read_sync(filename: list[str]) -> bytes:
    """
    read as binary from file
    """
    with open(os.path.join(path, *filename), "rb") as f:
        out = f.read()
    return out


async def fs_read(filename: list[str]) -> bytes:
    """
    read as binary from file
    """
    async with aopen(os.path.join(path, *filename), "rb") as f:
        out = await f.read()
    return out
