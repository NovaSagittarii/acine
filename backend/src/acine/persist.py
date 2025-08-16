"""
Image persistence / save to disk.
"""

import os

from aiofiles import open as aopen

dirname = os.path.dirname(__file__)
path = os.path.join(dirname, "..", "..", "data")


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


def mkdir(dirpath: list[str]) -> None:
    """ensure folder exists"""
    os.makedirs(resolve(*dirpath), exist_ok=True)


class PrefixedFilesystem:
    """
    Calls persist module methods (fs read/write sync/async) with extra prefix.

    Primarily used when setting a context.
    """

    prefix: list[str] = []

    def __init__(self, prefix: list[str] = []):
        if len(prefix):
            self.prefix = prefix

    def set_prefix(self, new_prefix: list[str]):
        self.prefix = new_prefix

    def resolve(self, *paths: str) -> str:
        return resolve(*self.prefix, *paths)

    async def write(self, filename: list[str], contents: bytes):
        return await fs_write([*self.prefix, *filename], contents)

    def write_sync(self, filename: list[str], contents: bytes):
        return fs_write_sync([*self.prefix, *filename], contents)

    def read_sync(self, filename: list[str]) -> bytes:
        return fs_read_sync([*self.prefix, *filename])

    async def read(self, filename: list[str]) -> bytes:
        return await fs_read([*self.prefix, *filename])
