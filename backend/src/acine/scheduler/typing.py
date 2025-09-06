from acine_proto_dist.routine_pb2 import Routine

ExecResult = Routine.RequirementType


class ISchedulerRoutineInterface:
    def __init__(self, routine: Routine):
        self.routine = routine

    async def goto(self, e: Routine.Edge) -> ExecResult:
        """
        Attempts to route towards e, then execute it. Returns the result of it
        in order to determine whether a retry
        """
        raise NotImplementedError("goto is not implemented", e)

    def on_scheduled(self, edge: Routine.Edge) -> None:
        pass
