"""
Image persistence / save to disk.
"""

import os
from io import BytesIO
from pathlib import Path
from typing import Final, List, Optional

import py7zr
from aiofiles import open as aopen
from py7zr.helpers import ArchiveTimestamp

DIRNAME: Final[str] = os.path.dirname(__file__)
PATH: Final[str] = os.path.join(DIRNAME, "..", "..", "data")


def resolve(*paths: str) -> str:
    """
    Resolves file path relative to data folder
    """
    assert not paths or isinstance(paths[0], str), "expect strings"
    return os.path.realpath(os.path.join(PATH, *paths))


async def fs_write(filename: List[str], contents: bytes) -> None:
    """
    write as binary to file
    """
    async with aopen(resolve(*filename), "wb") as f:
        await f.write(contents)


def fs_write_sync(filename: List[str], contents: bytes) -> None:
    """
    write as binary file (sync)
    """
    with open(resolve(*filename), "wb") as f:
        f.write(contents)


def fs_read_sync(filename: List[str]) -> bytes:
    """
    read as binary from file
    """
    with open(resolve(*filename), "rb") as f:
        out = f.read()
    return out


async def fs_read(filename: List[str]) -> bytes:
    """
    read as binary from file
    """
    async with aopen(resolve(*filename), "rb") as f:
        out = await f.read()
    return out


def mkdir(dirpath: List[str]) -> None:
    """ensure folder exists"""
    os.makedirs(resolve(*dirpath), exist_ok=True)


class BytesData:
    """Used for input to py7zr.Worker.writestr"""

    def __init__(self, data: bytes):
        self.__data = BytesIO(data)

    def data(self) -> BytesIO:
        return self.__data


class OutputStream(py7zr.io.Py7zIO):
    """Writer for in-memory extraction, based on example network storage writer from
    https://py7zr.readthedocs.io/en/latest/advanced.html#example-to-extract-into-network-storage
    """

    def __init__(self, fname: str):
        self.fname = fname
        self.length = 0
        self.data = bytearray()

    def write(self, data: bytes | bytearray) -> int:
        # py7zr calls this multiple times to append extracted data
        # returns number of bytes written, check py7zr.io.HashIO
        self.length += len(data)
        self.data += data
        return len(data)

    def read(self, _: Optional[int] = None) -> bytes:
        return b""

    def seek(self, offset: int, whence: int = 0) -> int:
        return offset

    def flush(self) -> None:
        pass

    def size(self) -> int:
        return self.length


class OutputStreamFactory(py7zr.io.WriterFactory):
    """Factory class to return StreamWriter object."""

    def __init__(self) -> None:
        self.files: dict[str, OutputStream] = {}

    def create(self, filename: str) -> py7zr.io.Py7zIO:
        product = OutputStream(filename)
        self.files[filename] = product
        return product


class PrefixedFilesystem:
    """
    Calls persist module methods (fs read/write sync/async) with extra prefix.

    Primarily used when setting a context.
    """

    prefix: List[str] = []

    def __init__(self, prefix: List[str] = []):
        if len(prefix):
            self.prefix = prefix

    def set_prefix(self, new_prefix: List[str]) -> None:
        self.prefix = new_prefix

    def resolve(self, *paths: str) -> str:
        return resolve(*self.prefix, *paths)

    async def write(self, filename: List[str], contents: bytes) -> None:
        return await fs_write([*self.prefix, *filename], contents)

    async def write_archive(self, filename: List[str], contents: bytes) -> None:
        with py7zr.SevenZipFile(Path(self.resolve("archive.7z")), "a") as archive:
            # py7zr.SevenZipFile.write()
            folder = archive.header.initialize()
            path = Path(*filename)
            # py7zr.SevenZipFile._make_file_info() -- but the file doesn't exist
            # so make up something reasonable, everything should be fine, but
            # "attributes" and "filename" might be incorrect on non-win32 OS
            file_info = {
                "origin": path,
                "filename": str(path),
                "emptystream": False,
                "attributes": 32,  # some attribute flags, copied from Windows 11 file
                "uncompressed": len(contents),
                "creationtime": ArchiveTimestamp.from_now(),
                "lastwritetime": ArchiveTimestamp.from_now(),
                "lastaccesstime": ArchiveTimestamp.from_now(),
            }
            archive.header.files_info.files.append(file_info)
            archive.header.files_info.emptyfiles.append(file_info["emptystream"])
            archive.files.append(file_info)

            # py7zr.Worker.archive()
            worker = archive.worker
            current_file_index = worker.current_file_index
            foutsize, crc = worker.writestr(archive.fp, BytesData(contents), folder)
            worker.header.files_info.files[current_file_index]["maxsize"] = foutsize
            worker.header.files_info.files[current_file_index]["digest"] = crc
            worker.last_file_index = current_file_index
            worker.current_file_index += 1

        # mkdir([*self.prefix, "tmp"])
        # os.chdir(self.resolve("tmp"))
        # path = Path(*filename)
        # async with aopen(path, "wb") as file:
        #     await file.write(contents)
        # with py7zr.SevenZipFile(Path(self.resolve("archive.7z")), "a") as archive:
        #     archive.write(path)
        # os.remove(path)

    async def read(self, filename: List[str]) -> bytes:
        return await fs_read([*self.prefix, *filename])

    async def read_archive(self, filename: List[str]) -> bytes:
        factory = OutputStreamFactory()
        with py7zr.SevenZipFile(Path(self.resolve("archive.7z")), "r") as archive:
            archive.extract(factory=factory, path=self.resolve("tmp"), targets=filename)
        return next(iter(factory.files.values())).data
