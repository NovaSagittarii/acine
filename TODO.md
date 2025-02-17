# TODO

budget issue tracker

## Done

- `PY` setup python screenshot capability
- `PY` setup websocket communication (flask i guess?)
- `PR` setup python protobuf + mypy; maybe bring the patch script over

## Core Feature

- `JS/PY` forward mouse movements
- `JS` routine states

## High priority

- `PY` setup routine handling

## Medium priority

- `PY` do something about mypy needing insert `from . ` to fix the imports
  - maybe bring the patch script over; or submit PR to mypy proto
- `JS` persistent websocket

## Low priority

- `JS/PR/PY` get the package overhead out of proto -- no need to build it there?? i don't know
- `PR` uninvert the proto/dist/{lang} to proto/{lang}/dist (this is a waste of paths)
- `PR` fix the documentation on proto; js stuff lives in root and py stuff in dist/py
- `JS` setup path alias
