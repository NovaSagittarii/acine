_A quest for an abstracted (functional) automation tool_

# Background

<!-- - Recorded macros
- Macro with wait/goto (MacroRecorder)
- Scripts -->

# Feature List

| Feature            | Issue                                    |
| ------------------ | ---------------------------------------- |
| Graph structure    | Reusable navigation for "game state"     |
| Subroutine         | Reusable components, enable abstraction  |
| Scheduling         | Periodic task                            |
| Interrupt          | Aperiodic task, expected but unsure when |
| Pre/post condition | Addressing unreliable I/O or network     |
| Labeled frames     | Automated testing when tuning conditions |

# Open Questions

A list of problems/issues that exist but not addressed yet.

- Is this over-engineered?
- How to handle landscape/portrait orientation?
- How to handle inconsistent window sizes? Responsive UI?
- How to handle open world environments? Are replays sufficient? Consistency?
  - How about combat in 2D/3D environments?
- Are there practical benefits to having a complex navigation graph?
  (high [k-core](<https://en.wikipedia.org/wiki/Degeneracy_(graph_theory)>))
  > On a tree, there is a unique shortest path between any pair of vertices.
  - If cycling occurs, when should you attempt routing a different method?
- `Extensions::Subroutine` How to pathfind with actual recursion?
  > I'm pretty sure current implementation breaks with duplicate states on
  > the return stack.
- `Extensions::Dependency` How to implement dependency?
  > A dependency graph is a reasonable choice, but it makes optimization
  > more complex. Optimization is possibly irrelevant?
  - `<=` Dependency?
- `Extensions::ExtAction` What is the distribution for a region click?
  > Macro detection evasion. Reverse turing test?
- How to prioritize template matches (if variable offset)?
  > Currently take highest match. It might be useful if over all valid matches
  > that met the threshold, to prefer some positions over others
  > (f.e. right-to-left).
- How to handle variable resolution? Scaling?
  > Template threshold tuning needs to take this into consideration.
  > Resampling tends to result in some information loss.
- How to handle interrupt between action and postcondition?

  <span style="color:skyblue">Action can be interruptable or not.</span>

  <span style="color:skyblue">Anything on from endpoint can trigger.
  Postcondition passing means the transition is complete (then to endpoint
  should apply)</span>

- `Scheduling` How to handle interrupt?
- How to handle multiple-window games?

# Design

## Routine Graph Data Structure

### Atoms

Based on FSA/flow charts, extended with **transition choice** (during runtime)
to relax linearization requirement of traditional macros.

- Mandatory transition -- react to async expected (nondeterministic) event
- Optional transition -- general deterministic navigation (if/else branching)
- Action node -- execute this action upon entering this node
  - Basic actions: (mouse:up/down/move, key:up/down)
  - Can be edge action,
    but slightly more complex due to branching on transitions.

### Extensions

- Delay/retry -- (probably unnecessary)
  - Equivalent to extending how many optional transitions happen
- Subroutine -- graph substructures
  - Allows reuse of existing components. GUIs often share repeated elements.
- Dependency -- built over subroutines (need to run this before that).
  - Relax ordering requirements for subroutines.
  - Enables navigation graph to be used purely for navigation instead of ordering.
    This simplifies graph complexity.
- Event listener -- directed hypergraph generalization of mandatory transitions.
  - Can trigger from multiple locations.
- Extended actions are generalizations of the basic actions.
  - Replay: sequence of basic actions; most practical due to ease of recording.
  - Region click: click anywhere in this region, less robotic behavior.
    - Budget region click: click one of K positions.

### [File Structure](/backend/data/README.md)

## Scheduling

# UX

<!-- - Live stream
- Captured frames
- State using frames
- Conditions using frames -->
