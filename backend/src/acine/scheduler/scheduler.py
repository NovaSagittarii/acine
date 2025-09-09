from __future__ import annotations

import heapq

from acine_proto_dist.routine_pb2 import Routine

from .typing import ExecResult, ISchedulerRoutineInterface


class DependencyInfo:
    """Extra information per dependency instance at runtime"""

    def __init__(self, target: Routine.Edge, dependency: Routine.Dependency):
        self.target = target
        """dependent action (wants this dependency to be met before it can run)"""

        self.dependency = dependency
        self.__ok_count: int = 0
        self.ok = False

    def __repr__(self):
        return f"ok={self.__ok_count} E={self.target.id} d={self.dependency}"

    def satisfy_once(self) -> bool:
        """returns True if met, False if not met yet"""
        self.__ok_count += 1
        if self.__ok_count >= self.dependency.count:
            self.ok = True
        return self.ok


class EdgeInfo:
    """Extra information per edge at runtime"""

    def __init__(self, edge: Routine.Edge):
        self.edge = edge

        self.dependents: list[DependencyInfo] = []
        """references to DependencyInfo that depend on this edge happening"""

        self.__dependents: dict[int, SchedulerEntry] = {}

        self.dependencies: list[DependencyInfo] = []
        """DependencyInfo this edge depends on"""

        self.fail_count: int = 0

        self.pending: int = 0
        """how many instances yet to complete?"""

    def __repr__(self):
        return (
            f"pending={self.pending} fail={self.fail_count} "
            + f"triggers[{len(self.dependents)}]={self.dependents}"
        )

    def fail_once(self) -> int:
        self.fail_count += 1
        return self.fail_count

    def broadcast(self, result: ExecResult) -> list[SchedulerEntry]:
        """Notifies all subscriptions, returns completions"""
        completions: list[SchedulerEntry] = []
        for v in tuple(self.__dependents.values()):
            # on_completed will call unsubscribe (modifying self.__dependents)
            print("BROADCAST", self.edge.description, result, v.edge.description, v.requirement)
            print("ACTUAL", v.requirement)
            if result >= v.requirement:
                if v.on_completed(self):
                    completions.append(v)
        return completions

    def subscribe(self, entry: SchedulerEntry) -> None:
        assert (
            entry.id not in self.__dependents or self.__dependents[entry.id] == entry
        ), "No ID collision should happen."
        self.__dependents[entry.id] = entry

    def unsubscribe(self, entry: SchedulerEntry) -> None:
        del self.__dependents[entry.id]


class SchedulerEntry:
    counter = 0

    def __init__(
        self,
        edge: Routine.Edge,
        deadline: int,
        requirement: ExecResult = ExecResult.REQUIREMENT_TYPE_COMPLETION,
    ):
        super().__init__()
        self.edge = edge
        self.deadline = deadline
        self.requirement = requirement
        self.count = 0
        self.deps: dict[str, DependencyInfo] = {}
        for dep in edge.dependencies:
            self.deps[dep.requires] = DependencyInfo(edge, dep)

        self.id = str(SchedulerEntry.counter)
        SchedulerEntry.counter += 1

    def __repr__(self):
        return f"D={self.deadline}+{self.count} {self.edge}".strip()

    def __lt__(self, other: SchedulerEntry):
        if self.deadline == other.deadline:
            return self.count < other.count
        return self.deadline < other.deadline

    def on_completed(self, e: EdgeInfo) -> bool:
        """return True if ready to run"""
        id = e.edge.id
        if id in self.deps:
            if self.deps[id].satisfy_once():
                del self.deps[id]
        if id not in self.deps:
            e.unsubscribe(self)
        print("RESOLVing", e.edge.name, self.deps)
        return not self.deps

    def fail(self):
        self.count += 1


class Scheduler:
    """
    Handles dependency ordering (given a list of things to do)
    """

    def __init__(self, interface: ISchedulerRoutineInterface):
        self.edges: dict[str, EdgeInfo] = {}
        self.deps: dict[str, DependencyInfo] = {}
        self.ready_queue: list[SchedulerEntry] = []  # heapq

        self.interface = interface
        self.routine = interface.routine
        for u in self.routine.nodes.values():
            for edge in u.edges:
                self.edges[edge.id] = EdgeInfo(edge)

        for u in self.routine.nodes.values():
            for edge in u.edges:
                e = self.edges[edge.id]
                for dep in edge.dependencies:
                    d = DependencyInfo(edge, dep)
                    self.deps[dep.id] = d
                    print(dep.requires, "will trigger", d.target.id)
                    self.edges[dep.requires].dependents.append(d)
                    e.dependencies.append(d)

    def __schedulable(self, edge: Routine.Edge) -> bool:
        return self.edges[edge.id].pending >= 1

    async def __exec(self, entry: SchedulerEntry) -> bool:
        """
        Handle route to edge and execute, returns True if there is progress.
        Updates failcount/okcount.
        """

        edge = entry.edge
        e = self.edges[edge.id]
        deadline = entry.deadline

        print("EXEC", entry.edge.id, [d.dependency.requires for d in e.dependencies])

        if not self.__schedulable(edge):
            return False

        if entry.deps:  # has dependencies to run
            for dep in entry.deps.values():
                e = self.edges[dep.dependency.requires]
                print(entry.edge.description, "BLOCKED BY", e.edge.description, dep.dependency.requirement)
                e.subscribe(entry)
                for _ in range(max(0, dep.dependency.count - e.pending)):
                    self.schedule(e.edge, deadline + 1, requirement=dep.dependency.requirement)
            return True

        # Able to run now.
        assert e.pending >= 1, "should've been scheduled before exec"
        e.fail_count = 0
        e.pending -= 1

        print("RUN ", edge.id, edge.name, edge.description)
        result = await self.interface.goto(edge)
        print("RUN RESULT", result, ">=?", entry.requirement)

        candidates = e.broadcast(result)
        print("RESOLVE", [x.edge.name for x in candidates])
        for entry in candidates:
            assert not entry.deps, "Should have no unmet dependencies."
            heapq.heappush(self.ready_queue, entry)

        progressing = result >= entry.requirement or candidates
        if not progressing:
            e.fail_once()

        return progressing

    async def next(self) -> bool:
        """
        attempts to run the next scheduled item,
        returns False when nothing to run (empty pq)
        """
        if not self.ready_queue:
            return False

        entry = heapq.heappop(self.ready_queue)
        edge = entry.edge
        if not self.__schedulable(edge):
            return True

        if not await self.__exec(entry):
            entry.fail()  # reschedule with lower priority
            heapq.heappush(self.ready_queue, entry)

        return True

    def schedule(self, edge: Routine.Edge, deadline: int, update=True, requirement=ExecResult.REQUIREMENT_TYPE_CHECK):
        print("SCHEDULE", edge.id, f"d={deadline}")
        self.interface.on_scheduled(edge)
        e = self.edges[edge.id]
        if update:
            e.pending += 1
        entry = SchedulerEntry(edge, deadline, requirement=requirement)
        heapq.heappush(self.ready_queue, entry)
