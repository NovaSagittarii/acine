"""
HTTP server for accessing files (so browser cache works).
Maybe migrate main server sometime?

https://github.com/pallets/quart/?tab=readme-ov-file#quickstart
"""

import asyncio
import io
import os
import re
from pathlib import Path
from typing import Any, Final

from quart import Quart, Response, send_file
from quart_cors import cors

from acine.persist import PATH as DATA_PATH
from acine.persist import PrefixedFilesystem

CORS: Final[str | re.Pattern] = os.environ.get(
    "FS_CORS", re.compile("https?://localhost:(4173|5173)")
)

app = Quart(__name__)
app = cors(app, allow_origin=CORS)
# app = cors(app, allow_origin='*')  # if remote access


def retry(times: int, exceptions: tuple[Exception]) -> Any:
    """
    Retry Decorator
    Retries the wrapped function/method `times` times if the exceptions listed
    in ``exceptions`` are thrown
    :param times: The number of times to repeat the wrapped function/method
    :type times: Int
    :param Exceptions: Lists of exceptions that trigger a retry attempt
    :type Exceptions: Tuple of Exceptions

    from: https://stackoverflow.com/a/64030200
    """

    def decorator(func):
        async def newfn(*args, **kwargs):
            attempt = 0
            while attempt < times:
                try:
                    return await func(*args, **kwargs)
                except exceptions:
                    print(
                        "Exception thrown when attempting to run %s, attempt "
                        "%d of %d" % (func, attempt, times)
                    )
                    attempt += 1
                    await asyncio.sleep(1)
            return func(*args, **kwargs)

        return newfn

    return decorator


@retry(3, (FileNotFoundError,))
@app.route("/data/<routine_id>/img/<img_id>")
async def read_img(routine_id: str, img_id: str) -> Response:
    return await send_file(Path(DATA_PATH, routine_id, "img", f"{img_id}.png"))


@retry(3, (FileNotFoundError,))
@app.route("/data/<routine_id>/archive/<img_id>")
async def read_img_archive(routine_id: str, img_id: str) -> Response:
    data = await PrefixedFilesystem([routine_id]).read_archive([f"{img_id}.bmp"])
    return await send_file(io.BytesIO(data), mimetype="image/bmp", cache_timeout=300)
