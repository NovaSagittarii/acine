"""
Image persistence / save to disk.
"""

import os

from aiofiles import open as aopen

dirname = os.path.dirname(__file__)
path = os.path.join(dirname, "..", "data")


def resolve(*paths: str) -> str:
    """
    Resolves file path relative to data folder
    """
    return os.path.join(path, *paths)


async def fs_write(filename: list[str], contents: bytes):
    """
    write as binary to file
    """
    async with aopen(resolve(*filename), "wb") as f:
        await f.write(contents)


def fs_write_sync(filename: list[str], contents: bytes):
    """
    write as binary file (sync)
    """
    with open(resolve(*filename), "wb") as f:
        f.write(contents)


def fs_read_sync(filename: list[str]) -> bytes:
    """
    read as binary from file
    """
    with open(resolve(*filename), "rb") as f:
        out = f.read()
    return out


async def fs_read(filename: list[str]) -> bytes:
    """
    read as binary from file
    """
    async with aopen(resolve(*filename), "rb") as f:
        out = await f.read()
    return out
