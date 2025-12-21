"""
HTTP server for accessing files (so browser cache works).
Maybe migrate main server sometime?

https://github.com/pallets/quart/?tab=readme-ov-file#quickstart
"""

import io
import re
from pathlib import Path

from quart import Quart, Response, send_file
from quart_cors import cors

from acine.persist import PrefixedFilesystem
from acine.persist import path as data_path

app = Quart(__name__)
app = cors(app, allow_origin=re.compile("https?://localhost:(4173|5173)"))
# app = cors(app, allow_origin='*')  # if remote access


@app.route("/data/<routine_id>/img/<img_id>")
async def read_img(routine_id: str, img_id: str) -> Response:
    return await send_file(Path(data_path, routine_id, "img", f"{img_id}.png"))


@app.route("/data/<routine_id>/archive/<img_id>")
async def read_img_archive(routine_id: str, img_id: str) -> Response:
    data = await PrefixedFilesystem([routine_id]).read_archive([f"{img_id}.bmp"])
    return await send_file(io.BytesIO(data), mimetype="image/bmp")
