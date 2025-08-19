from __future__ import annotations

import heapq

from acine_proto_dist.routine_pb2 import Routine

ExecResult = Routine.RequirementType


class DependencyInfo:
    """Extra information per dependency at runtime"""

    def __init__(self, target: Routine.Edge, dependency: Routine.Dependency):
        self.target = target
        """dependent action (wants this dependency to be met before it can run)"""

        self.dependency = dependency
        self.ok_count: int = 0

    def __repr__(self):
        return f"ok={self.ok_count} E={self.target.id} d={self.dependency}"

    def satisfy_once(self) -> int:
        self.ok_count += 1
        return self.ok_count


class EdgeInfo:
    """Extra information per edge at runtime"""

    def __init__(self, edge: Routine.Edge):
        self.edge = edge

        self.dependents: list[DependencyInfo] = []
        """references to DependencyInfo that depend on this edge happening"""

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


class SchedulerEntry:
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

    def __repr__(self):
        return f"D={self.deadline}+{self.count} {self.edge}".strip()

    def __lt__(self, other: SchedulerEntry):
        if self.deadline == other.deadline:
            return self.count < other.count
        return self.deadline < other.deadline

    def fail(self):
        self.count += 1


class ISchedulerRoutineInterface:
    def __init__(self, routine: Routine):
        self.routine = routine

    def goto(self, e: Routine.Edge) -> ExecResult:
        """
        Attempts to route towards e, then execute it. Returns the result of it
        in order to determine whether a retry
        """
        raise NotImplementedError("goto is not implemented", e)


class Scheduler:
    """
    Handles dependency ordering (given a list of things to do)
    """

    def __init__(self, interface: ISchedulerRoutineInterface):
        self.edges: dict[str, EdgeInfo] = {}
        self.deps: dict[str, DependencyInfo] = {}
        self.pq: list[SchedulerEntry] = []  # heapq

        self.interface = interface
        self.routine = interface.routine
        for u in self.routine.nodes:
            for edge in u.edges:
                self.edges[edge.id] = EdgeInfo(edge)

        for u in self.routine.nodes:
            for edge in u.edges:
                e = self.edges[edge.id]
                for dep in edge.dependencies:
                    d = DependencyInfo(edge, dep)
                    self.deps[dep.id] = d
                    print(dep.requires, "will trigger", d.target.id)
                    self.edges[dep.requires].dependents.append(d)
                    e.dependencies.append(d)

    def __check(self, edge: Routine.Edge) -> Routine.Edge | None:
        """returns first unsatisfied dependency of an edge"""
        for d in edge.dependencies:
            if self.deps[d.id].ok_count < d.count:
                return self.edges[d.requires].edge
        return None

    def __schedulable(self, edge: Routine.Edge) -> bool:
        return self.edges[edge.id].pending >= 1

    def __exec(self, entry: SchedulerEntry) -> bool:
        """
        Handle route to edge and execute, returns True if there is progress.
        Updates failcount/okcount.
        """

        edge = entry.edge
        e = self.edges[edge.id]
        deadline = entry.deadline

        print("EXEC", entry.edge.id, [d.target.id for d in e.dependencies])

        if not self.__schedulable(edge):
            return False

        dep = self.__check(edge)
        if dep:  # cannot run yet
            self.schedule(dep, deadline)
            return False

        assert e.pending >= 1, "should've been scheduled before exec"
        e.fail_count = 0
        e.pending -= 1
        for dep in edge.dependencies:
            d = self.deps[dep.id]
            d.ok_count = 0

        print("RUN ", edge.id)
        result = self.interface.goto(edge)

        candidates: set[str] = set()
        progressing = False
        for d in e.dependents:
            if result >= d.dependency.requirement:
                d.satisfy_once()
                progressing = True
                candidates.add(d.target.id)

        if result >= entry.requirement:
            progressing = True

        for eid in candidates:
            e = self.edges[eid]
            edge = e.edge
            if self.__schedulable(edge):
                dep = self.__check(edge)
                if dep:
                    self.schedule(dep, deadline)
                else:
                    self.schedule(edge, deadline, update=False)

        if not progressing:
            e.fail_once()

        return progressing

    def next(self) -> bool:
        """attempts to run the next scheduled item, returns False when nothing"""
        if not self.pq:
            return False

        entry = heapq.heappop(self.pq)
        edge = entry.edge
        if not self.__schedulable(edge):
            return False

        if not self.__exec(entry):
            entry.fail()  # reschedule with lower priority
            heapq.heappush(self.pq, entry)

        return True

    def schedule(self, edge: Routine.Edge, deadline: int, update=True):
        e = self.edges[edge.id]
        if update:
            e.pending += 1
        heapq.heappush(self.pq, SchedulerEntry(edge, deadline))
