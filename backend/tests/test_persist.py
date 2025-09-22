import os
import random
import shutil
from typing import Awaitable, Callable

import pytest

import acine.persist


@pytest.fixture
def pfs():
    test_dir = acine.persist.resolve("test")
    assert "backend\\data" in test_dir or "backend/data" in test_dir, "sanity check"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir, ignore_errors=True)
    acine.persist.mkdir(["test"])
    yield acine.persist.PrefixedFilesystem(["test"])
    # shutil.rmtree(test_dir, ignore_errors=True)


async def read_write_test(
    read: Callable[[list[str]], Awaitable[bytes]],
    write: Callable[[list[str], bytes], Awaitable[None]],
    generate: Callable[[], bytes],
    file_count: int = 20,
):
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
async def test_prefixed_filesystem_rw(pfs):
    content = "hello world".encode()
    await pfs.write(["f1"], content)
    assert await pfs.read(["f1"]) == content


@pytest.mark.asyncio
async def test_prefixed_filesystem_archive_rw(pfs):
    content = "hello world".encode()
    await pfs.write_archive(["f1"], content)
    assert await pfs.read_archive(["f1"]) == content


class TestBenchmark:
    @staticmethod
    @pytest.mark.asyncio
    # @pytest.mark.parametrize("filesize", (10**3, 10**6))
    # @pytest.mark.benchmark(group="filesystem", max_time=1)
    async def test_pfs_rw(pfs: acine.persist.PrefixedFilesystem, filesize=16):
        async def read(path: list[str]):
            return await pfs.read(path)

        async def write(path: list[str], contents: bytes):
            return await pfs.write(path, contents)

        def generate():
            return random.randbytes(filesize).hex().encode()

        await read_write_test(read, write, generate)

    @staticmethod
    @pytest.mark.asyncio
    # @pytest.mark.parametrize("filesize", (10**3, 10**6))
    # @pytest.mark.benchmark(group="filesystem", max_time=1)
    async def test_pfs_archive_rw(pfs: acine.persist.PrefixedFilesystem, filesize=16):
        async def read(path: list[str]):
            return await pfs.read_archive(path)

        async def write(path: list[str], contents: bytes):
            return await pfs.write_archive(path, contents)

        def generate():
            return random.randbytes(filesize).hex().encode()

        await read_write_test(read, write, generate)
