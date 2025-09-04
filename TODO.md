# TODO

budget issue tracker

## Task Queue

- v0.1.0 Automation Features (static)
  - [x] subroutine edit
  - [x] implement graph (for debugging)
  - [x] implement router; goto state
  - [x] improve UX; add collapseable ui elements
  - [x] queue edge
  - [x] improve frame select (v2: autoselect)
  - [x] implement node default precondition; action default
  - [x] implement interrupt handler (send to state)
  - [x] subroutine postcondition
- Verification Features (design not ready)
  - [ ] improve frame select (v3: visual selector)
  - [ ] implement frame grouping (states!!)
  - [x] implement threshold matching
  - [x] query backend for which frames match a condition
  - [x] multiprocessing frame query
- v0.1.2 Runtime Frontend
  - [x] display runtime state (needed for debugging runtime)
  - [x] goto from frontend
  - [x] queue_edge from frontend
  - [ ] handle goto timeout (possible failure)
- v0.1.3 Automation Features (dynamic)
  - [x] implement template match
  - [ ] interrupt during postcondition (or action)
  - [x] implement replay offset (on dynamic check)
  - [ ] implement text match
  - [x] repeat action N times (replay + subroutine)
- v0.1.4 Automation Features (generalized)
  - [ ] implement multi-node interrupt (event listener)
- v0.2.0 Routine Manager
  - [x] routine new/open/save (multi-instance)
  - [ ] routine export (tar.bz2), include frames
  - [x] routine launch sequence
  - [ ] attach width/height to positional data (handle rotation and scaling)
- v0.3.0 Scheduler (with parallelism)
  - [x] implement dependency (implicit)
  - [x] implement scheduling groups
  - [ ] implement scheduler (multicore EDF, Postorder DFS)
  - [ ] implement action duration logging
  - [ ] implement scheduled action
  - [ ] implement dependency (implicit) with navigation listen
- v0.4.0 Background Runtime
  - [x] single routine background task
  - [ ] multi routine background task
- v0.5.0 Scheduler Optimization
  - [ ] implement variables (explicit dependency)
  - linear programming
- v0.6.0 Power Saving
  - [x] sleep and wake from sleep
    - https://learn.microsoft.com/en-us/windows/win32/api/powrprof/nf-powrprof-setsuspendstate
    - https://learn.microsoft.com/en-us/windows/win32/power/system-wake-up-events
    - Use sleep after X minute Power Plan setting, SetWaitableTimer for wake up.
- v0.7.0 Scheduler Error Handling (Faults)
  - [ ] failure modes: "cannot reach", "reach but timeout"
  - [ ] scheduled retry/backoff
  - [ ] temporary deletion of failed edge
- v1.0.0 Quality of Life
  - [x] node/edge preset
  - [x] variable display scaling support
  - [ ] hotkeys on buttons
  - [ ] metrics (high-level version of duration logging)
- v1.1.0 Runtime Optimization
  - some sort of template match cache to speed up future queries
  - find the magic pixel(s)

### Lower Priority

- [ ] implement search by node name (frontend editor)
- [ ] implement graph based editor
- [ ] route display
- [x] migrate venv to uv
- [ ] self loop with "sample"/"data source" action (text match parse)
- [ ] move (py, proto) comments to after
- [x] proto map<> instead of repeated
- [ ] ts alias, import sorting
- [ ] gpu related capture
- [ ] time travel capture (pick frame from a recording)
- [ ] uvloop
- [ ] server methods tests
- [ ] mypy type checks

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
