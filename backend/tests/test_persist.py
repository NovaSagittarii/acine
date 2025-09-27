import os
import random
import shutil
from typing import Awaitable, Callable, Generator, List

import pytest

from acine.persist import PrefixedFilesystem, mkdir, resolve


@pytest.fixture
def pfs() -> Generator[PrefixedFilesystem]:
    test_dir = resolve("test")
    assert "backend\\data" in test_dir or "backend/data" in test_dir, "sanity check"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir, ignore_errors=True)
    mkdir(["test"])
    yield PrefixedFilesystem(["test"])
    # shutil.rmtree(test_dir, ignore_errors=True)


async def read_write_test(
    read: Callable[[List[str]], Awaitable[bytes]],
    write: Callable[[List[str], bytes], Awaitable[None]],
    generate: Callable[[], bytes],
    file_count: int = 20,
) -> None:
    expect: dict[str, bytes] = {}
    files = [f"f{i}" for i in range(file_count)]
    for file in files:
        expect[file] = generate()
        await write([file], expect[file])
        assert await read([file]) == expect[file]
    for _ in range(file_count * 10):
        file = random.choice(files)
        assert await read([file]) == expect[file]


@pytest.mark.asyncio
async def test_prefixed_filesystem_rw(pfs: PrefixedFilesystem) -> None:
    content = "hello world".encode()
    await pfs.write(["f1"], content)
    assert await pfs.read(["f1"]) == content


@pytest.mark.asyncio
async def test_prefixed_filesystem_archive_rw(pfs: PrefixedFilesystem) -> None:
    content = "hello world".encode()
    await pfs.write_archive(["f1"], content)
    assert await pfs.read_archive(["f1"]) == content


class TestBenchmark:
    @staticmethod
    @pytest.mark.asyncio
    # @pytest.mark.parametrize("filesize", (10**3, 10**6))
    # @pytest.mark.benchmark(group="filesystem", max_time=1)
    async def test_pfs_rw(pfs: PrefixedFilesystem, filesize: int = 16) -> None:
        async def read(path: List[str]) -> bytes:
            return await pfs.read(path)

        async def write(path: List[str], contents: bytes) -> None:
            return await pfs.write(path, contents)

        def generate() -> bytes:
            return random.randbytes(filesize).hex().encode()

        await read_write_test(read, write, generate)

    @staticmethod
    @pytest.mark.asyncio
    # @pytest.mark.parametrize("filesize", (10**3, 10**6))
    # @pytest.mark.benchmark(group="filesystem", max_time=1)
    async def test_pfs_archive_rw(pfs: PrefixedFilesystem, filesize: int = 16) -> None:
        async def read(path: List[str]) -> bytes:
            return await pfs.read_archive(path)

        async def write(path: List[str], contents: bytes) -> None:
            return await pfs.write_archive(path, contents)

        def generate() -> bytes:
            return random.randbytes(filesize).hex().encode()

        await read_write_test(read, write, generate)
