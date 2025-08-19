from unittest.mock import Mock, call

import pytest
from acine.scheduler import ExecResult, ISchedulerRoutineInterface, Scheduler
from acine_proto_dist.routine_pb2 import Routine


class AlwaysOk(ISchedulerRoutineInterface):
    def __init__(self, r: Routine):
        super().__init__(r)

        self.goto = Mock(return_value=ExecResult.REQUIREMENT_TYPE_COMPLETION)


class TestOrdering:
    def __basic(
        self, deps: list[tuple[int, int]]
    ) -> tuple[dict[int, Routine.Edge], Mock, Scheduler]:
        adj: dict[str, list[Routine.Dependency]] = {}
        for i, uv in enumerate(deps):
            u, v = map(str, uv)
            if u not in adj:
                adj[u] = []
            if v not in adj:
                adj[v] = []
            dep = Routine.Dependency(
                requirement=Routine.REQUIREMENT_TYPE_COMPLETION,
                explicit=True,
                requires=u,
                count=1,
                id=str(i),
            )
            adj[v].append(dep)

        n = Routine.Node(edges=[])
        edges: dict[int, Routine.Edge] = {}
        for u, deps in adj.items():
            e = Routine.Edge(id=u, dependencies=deps)
            n.edges.append(e)
            edges[int(u)] = e

        r = Routine(nodes=[n])
        ri = AlwaysOk(r)
        return (edges, ri.goto, Scheduler(ri))

    def test_init(self):
        edges, goto, _ = self.__basic([(0, 1)])
        assert len(edges[0].dependencies) == 0, "0 is independent"
        assert len(edges[1].dependencies) == 1, "1 dependent on 0"
        assert edges[1].dependencies[0].requires == "0", "1 dependent on 0"
        goto(5)
        goto(6)
        goto.assert_has_calls([call(5), call(6)])

    def test_nodep(self):
        edges, goto, s = self.__basic([(0, 1)])
        s.schedule(edges[0], 0)
        assert s.next(), "working on 0"
        goto.assert_has_calls([call(edges[0])])
        assert not s.next(), "no more"

    def test_dep2(self):
        edges, goto, s = self.__basic([(0, 1)])
        s.schedule(edges[1], 0)
        for _ in range(5):
            s.next()
        goto.assert_has_calls([call(edges[0]), call(edges[1])])

    @pytest.mark.parametrize("n", (3, 5, 10, 100))
    def test_dep_n(self, n: int):
        edges, goto, s = self.__basic([(i, n) for i in range(n)])
        s.schedule(edges[n], 0)
        for _ in range(n + 5):  # shouldn't require excessive extra calls
            if not s.next():
                break
        goto.assert_called_with(edges[n])
        goto.assert_has_calls([call(edges[i]) for i in range(n + 1)], any_order=True)

    def test_tree(self):
        edges, goto, s = self.__basic([(0, 1), (1, 3), (2, 3)])
        s.schedule(edges[3], 0)
        for _ in range(20):
            s.next()
        goto.assert_called_with(edges[3])
        assert goto.call_count == 4

        # this ordering can be relaxed (but currently not set up)
        goto.assert_has_calls([call(edges[i]) for i in (0, 1, 2, 3)])
