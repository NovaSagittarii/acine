# TODO

budget issue tracker

## Task Queue

- [x] subroutine edit
- [x] implement graph (for debugging)
- [x] implement router; goto state
- [ ] improve UX; add collapseable ui elements (maybe add search if it's still bad)
- [ ] queue edge
- [ ] implement scheduling groups
- [ ] implement scheduler

### Lower Priority

- [ ] route display

Currently the tasks below aren't being considered (even lower priority) after
the project revision.

## Done

- `PY` setup python screenshot capability
- `PY` setup websocket communication (flask i guess?)
- `PR` setup python protobuf + mypy; maybe bring the patch script over
- `JS/PY` forward mouse movements
- `JS` routine states
- `JS` persistent routine (persistent-nanostores)
- `JS/PY` disk-persistent frame samples
- `JS/PY` send routine to backend for analysis
- `CL` decision tree generation (ydf -- it's alright)

## Core Feature

- `JS` graph editor, very basic (node and adjacent list editor haha)
- `JS/PY` routine replay and replay state inspector

## High priority

- `PY` setup routine handling (running it; dependent on everything else working though)
- `JS` graph editor visual (not sure if react/pixi/p5js yet)

## Medium priority

- `JS` persistent websocket
- `JS` move input listener into its own component
- `JS` CollapseRegion.tsx -- implement collapseable region for viewing samples
- `JS` allow zooming in on samples
- `JS` don't flood the backend with image requests (don't cause backpressure)
- `BE` setup compression on images (each one being 1MiB aint great)
- `JS` state searchbar
- `JS` undo/redo history

## Low priority

- `JS` setup path alias
- `JS` EditableText.tsx -- improve UX
- `JS` break up toOutCoordinates into two functions, probably shouldn't be one?
- `JS` reset region of interest selection; back to default (entire screen)
- `JS/PR/PY` improve stream FPS -- seems to be bottlenecked somewhere
- `CL` warn when there are ambiguous states (samples are too similar)

## No priority

- `PY` figure out how to make mouseinput (raw input?) work with game applications
  - currently AHK only works on Virtualbox and CROSVM based applications
- `JS/PR` region composition: difference
- `JS/PR` region composition: arbitrary selection
