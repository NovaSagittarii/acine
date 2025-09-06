from acine_proto_dist.routine_pb2 import Routine


class NavigationError(RuntimeError):
    """Unable to navigate for whatever reason."""

    def __init__(self, u: str, v: str):
        super().__init__(u, v)
        self.u = u
        """Attempted from"""

        self.v = v
        """Attempted to"""


class NoPathError(NavigationError):
    """
    No navigable path from u to v.

    This is raised from Runtime.goto or Runtime.queue_edge when the
    destination is not available.
    """

    def __init__(self, u: str, v: str):
        super().__init__(u, v)


class ExecutionError(RuntimeError):
    """Unable to complete an edge transition for whatever reason."""

    def __init__(self, edge: Routine.Edge):
        super().__init__(edge)
        self.edge = edge
        """edge the issue happened on"""


class PreconditionTimeoutError(ExecutionError):
    """
    Precondition timed out.

    This is raised from Runtime.queue_edge when the queued edge precondition fails.
    This is fairly rare during navigation. Aside from the queued edge, an edge
    won't be taken until the precondition passes once during navigation.
    """

    def __init__(self, edge: Routine.Edge):
        super().__init__(edge)


class PostconditionTimeoutError(ExecutionError):
    """
    Postcondition timed out.

    This raised from Runtime.goto or Runtime.queue_edge when the precondition
    passes and the action completes, but the postcondition times out.
    """

    def __init__(self, edge: Routine.Edge):
        super().__init__(edge)


class SubroutineExecutionError(ExecutionError):
    """
    Subroutine failed to complete (unable to get to RET node).
    """

    def __init__(self, edge: Routine.Edge):
        super().__init__(edge)


class SubroutinePostconditionTimeoutError(PostconditionTimeoutError):
    """
    Subroutine completed but failed on postcondition.

    Distinct from PostconditionTimeoutError.
    """

    def __init__(self, edge: Routine.Edge):
        super().__init__(edge)
