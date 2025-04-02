```sh
python -m uv venv --seed # tested on 3.12.1
.venv\Scripts\activate # or equivalent
pip install uv
uv pip install -r requirements.txt
protoc -I ../.. --python_out=acine_proto_dist --mypy_out=acine_proto_dist ../../*.proto
```
