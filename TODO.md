# TODO

budget issue tracker

## Done

- `PY` setup python screenshot capability
- `PY` setup websocket communication (flask i guess?)
- `PR` setup python protobuf + mypy; maybe bring the patch script over
- `JS/PY` forward mouse movements
- `JS` routine states
- `JS` persistent routine (persistent-nanostores)
- `JS/PY` disk-persistent frame samples

## Core Feature

- `PY` decision tree generation
- `JS` graph editor, very basic (node and adjacent list editor haha)

## High priority

- `PY` setup routine handling (running it; dependent on everything else working though)
- `JS` graph editor visual (not sure if react/pixi/p5js yet)

## Medium priority

- `PY` do something about mypy needing insert `from . ` to fix the imports
  - maybe bring the patch script over; or submit PR to mypy proto
- `JS` persistent websocket
- `JS` move input listener into its own component
- `JS` CollapseRegion.tsx -- implement collapseable region for viewing samples
- `JS` allow zooming in on samples
- `JS` don't flood the backend with image requests (don't cause backpressure)
- `BE` setup compression on images (each one being 1MiB aint great)
- `JS` state searchbar

## Low priority

- `JS/PR/PY` get the package overhead out of proto -- no need to build it there?? i don't know
- `PR` uninvert the proto/dist/{lang} to proto/{lang}/dist (this is a waste of paths)
- `PR` fix the documentation on proto; js stuff lives in root and py stuff in dist/py
- `JS` setup path alias
- `JS` EditableText.tsx -- improve UX
- `JS` break up toOutCoordinates into two functions, probably shouldn't be one?
- `JS` reset region of interest selection; back to default (entire screen)
- `JS/PR/PY` improve stream FPS -- seems to be bottlenecked somewhere
- `PR` fix the build/lib/build/lib/... recursion (move `*_dist` to `src/*_dist`)
- `JS/PR` region composition: union

## No priority

- `PY` figure out how to make mouseinput (raw input?) work with game applications
  - currently AHK only works on Virtualbox and CROSVM based applications
- `JS/PR` region composition: difference
- `JS/PR` region composition: arbitrary selection
