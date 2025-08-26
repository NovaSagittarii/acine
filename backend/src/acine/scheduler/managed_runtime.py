import time

from acine.capture import GameCapture
from acine.input_handler import InputHandler
from acine.preset_impl import BuiltinController, BuiltinSchedulerRoutineInterface
from acine.runtime.runtime import Routine, Runtime
from acine.scheduler.cron import next
from acine.scheduler.scheduler import Scheduler


class RoutineInstance:
    def __init__(self, routine: Routine):
        self.ih = InputHandler(routine.window_name, cmd=routine.start_command)
        self.gc = GameCapture(routine.window_name)
        self.controller = BuiltinController(self.gc, self.ih)
        self.rt = Runtime(routine, self.controller)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        if exc_type:
            raise exc_val

    async def queue_edge(self, edge: Routine.Edge):
        await self.rt.queue_edge(edge.id)

    def close(self):
        self.gc.close()
        self.ih.close()


class SchedulingGroupInfo:
    def __init__(self, group: Routine.SchedulingGroup):
        self.group = group
        self.linked: list[Routine.Edge] = []
        self.last_time = time.time()
        self.next_time = next(time.time(), group)

    def on_scheduled(self):
        self.last_time = self.next_time
        self.next_time = next(time.time(), self.group)


class ManagedRuntime:
    """
    Scheduler-controlled Runtime
    """

    def __init__(self, routine: Routine):
        self.routine = routine
        self.S = {k: SchedulingGroupInfo(v) for k, v in routine.sgroups.items()}
        for node in routine.nodes:
            for edge in node.edges:
                for s in edge.schedules:
                    # TODO: s.count, s.requirement
                    self.S[s.scheduling_group_id].linked.append(edge)

    def next_time(self) -> float:
        """Returns the next time something gets scheduled."""
        return min(sg.next_time for sg in self.S.values())

    async def run(self, t: float = None):
        """
        `t` is seconds since UNIX epoch. When no `t` is provided, uses the current time.

        Schedules everything that happens <= `t` and runs it before exiting.
        """
        if not t:
            t = time.time()
        if self.next_time() > t:
            return  # nothing ready to run

        with RoutineInstance(self.routine) as instance:
            sri = BuiltinSchedulerRoutineInterface(self.routine, instance.rt)
            scheduler = Scheduler(sri)
            for sg in self.S.values():
                if sg.next_time <= t:
                    for edge in sg.linked:
                        scheduler.schedule(edge, t)
                    sg.on_scheduled()
            while await scheduler.next():
                pass
