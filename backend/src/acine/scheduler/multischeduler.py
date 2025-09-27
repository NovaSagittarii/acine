import datetime
import time
from typing import List

from acine_proto_dist.routine_pb2 import Routine

from acine.scheduler.managed_runtime import ManagedRuntime


class Multischeduler:
    """handles scheduling when there are multiple routines to schedule"""

    def __init__(self, routines: List[Routine]):
        self.tasks = [ManagedRuntime(r) for r in routines]

    def __str__(self) -> str:
        lines = []
        a = sorted([(x.next_time(), x) for x in self.tasks], key=lambda x: x[0])
        for t, x in a:
            dt = t - time.time()
            if dt > 1e9:
                continue
            D = datetime.timedelta(seconds=int(dt)).__str__()
            T = datetime.datetime.fromtimestamp(t).__str__()
            Z = ", ".join(x.next_groups(t))
            lines.append(f"{D if dt > 0 else "READY":>16} {T} {x.routine.name} {Z}")
        return "\n".join(lines)

    def next_time(self) -> float:
        """Returns the next time something happens"""
        return min([x.next_time() for x in self.tasks])

    def get_next(self) -> ManagedRuntime:
        """Returns the next task (runtime) to execute"""
        return min(self.tasks, key=lambda x: x.next_time())
