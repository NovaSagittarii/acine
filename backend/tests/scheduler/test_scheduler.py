from random import randint, seed, shuffle
from typing import Any, List, Sequence, Tuple
from unittest.mock import AsyncMock, Mock, call

import pytest
from acine_proto_dist.routine_pb2 import Routine
from pytest_mock import AsyncMockType

from acine.scheduler.scheduler import Scheduler
from acine.scheduler.typing import (
    ExecResult,
    ISchedulerRoutineInterface,
    OnScheduledCallbackType,
)


class AlwaysOk(ISchedulerRoutineInterface):
    goto: AsyncMockType

    def __init__(
        self, r: Routine, on_scheduled: OnScheduledCallbackType = lambda _: None
    ):
        super().__init__(r)

        self.goto = AsyncMock(return_value=ExecResult.REQUIREMENT_TYPE_COMPLETION)

        self.on_scheduled_callback = on_scheduled

    def on_scheduled(self, edge: Routine.Edge) -> None:
        self.on_scheduled_callback(edge)


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestBasic:
    """Very basic dependencies. (star graph)"""

    def __basic(
        self, deps: List[tuple[int, int]]
    ) -> Tuple[dict[int, Routine.Edge], Mock, Scheduler]:
        adj: dict[str, List[Routine.Dependency]] = {}
        for i, uv in enumerate(deps):
            u, v = map(str, uv)
            if u not in adj:
                adj[u] = []
            if v not in adj:
                adj[v] = []
            dep = Routine.Dependency(
                requirement=Routine.REQUIREMENT_TYPE_COMPLETION,
                type=Routine.DEPENDENCY_TYPE_EXPLICIT,
                requires=u,
                count=1,
                id=str(i),
            )
            adj[v].append(dep)

        n = Routine.Node(edges=[])
        edges: dict[int, Routine.Edge] = {}
        for u, udeps in adj.items():
            e = Routine.Edge(id=u, dependencies=udeps)
            n.edges.append(e)
            edges[int(u)] = e

        r = Routine(nodes={n.id: n})
        ri = AlwaysOk(r)
        return (edges, ri.goto, Scheduler(ri))

    async def test_init(self) -> None:
        edges, goto, _ = self.__basic([(0, 1)])
        assert len(edges[0].dependencies) == 0, "0 is independent"
        assert len(edges[1].dependencies) == 1, "1 dependent on 0"
        assert edges[1].dependencies[0].requires == "0", "1 dependent on 0"
        await goto(5)
        await goto(6)
        goto.assert_has_calls([call(5), call(6)])

    async def test_nodep(self) -> None:
        edges, goto, s = self.__basic([(0, 1)])
        s.schedule(edges[0], 0)
        assert await s.next(), "working on 0"
        goto.assert_has_calls([call(edges[0])])
        assert not await s.next(), "no more"

    async def test_dep2(self) -> None:
        edges, goto, s = self.__basic([(0, 1)])
        s.schedule(edges[1], 0)
        for _ in range(5):
            await s.next()
        goto.assert_has_calls([call(edges[0]), call(edges[1])])

    @pytest.mark.parametrize("n", (3, 5, 10, 100))
    async def test_dep_n(self, n: int) -> None:
        edges, goto, s = self.__basic([(i, n) for i in range(n)])
        s.schedule(edges[n], 0)
        for _ in range(n + 5):  # shouldn't require excessive extra calls
            if not await s.next():
                break
        goto.assert_called_with(edges[n])
        goto.assert_has_calls([call(edges[i]) for i in range(n + 1)], any_order=True)

    async def test_tree(self) -> None:
        edges, goto, s = self.__basic([(0, 1), (1, 3), (2, 3)])
        s.schedule(edges[3], 0)
        for _ in range(20):
            await s.next()
        goto.assert_called_with(edges[3])
        assert goto.call_count == 4

        # this doesn't check ordering
        for i in (0, 1, 2, 3):
            goto.assert_any_call(edges[i])


class MockRuntime:
    class BlockedTask:
        def __init__(self, edge: Routine.Edge):
            requirements: dict[str, int] = {}
            for dep in edge.dependencies:
                eid = dep.requires
                if eid not in requirements:
                    requirements[eid] = 0
                requirements[eid] += dep.count
            self.waiting_for = requirements
            self.edge = edge

        def on_completion(self, u: str) -> bool:
            """
            callback called whenever a task completes,
            returns True when the last requirement was satisfied
            """
            if u in self.waiting_for:
                self.waiting_for[u] -= 1
                if self.waiting_for[u] == 0:
                    del self.waiting_for[u]
            return not self.waiting_for

    @staticmethod
    def generate_dependency(u: str, id: str, kwargs: Any) -> Routine.Dependency:
        DEFAULT_KWARGS = {
            "requirement": Routine.REQUIREMENT_TYPE_COMPLETION,
            "type": Routine.DEPENDENCY_TYPE_EXPLICIT,
            "count": 1,
        }
        kwargs = {**DEFAULT_KWARGS, **kwargs}
        return Routine.Dependency(requires=u, id=id, **kwargs)

    def __init__(
        self, deps: Sequence[Tuple[int, int] | Tuple[int, int, dict[str, Any]]]
    ):
        adj: dict[str, List[Routine.Dependency]] = {}
        for i, uvw in enumerate(deps):
            u, v = map(str, uvw[:2])
            if u not in adj:
                adj[u] = []
            if v not in adj:
                adj[v] = []
            kwargs = uvw[2] if len(uvw) >= 3 else {}
            adj[v].append(MockRuntime.generate_dependency(u, str(i), kwargs))

        self.edges: dict[int, Routine.Edge] = {}
        n = Routine.Node()
        for u, udeps in adj.items():
            edge = Routine.Edge(id=u, dependencies=udeps)
            n.edges.append(edge)
            self.edges[int(u)] = edge

        self.routine = Routine(nodes={n.id: n})
        self.routine_interface = AlwaysOk(self.routine, self.__on_scheduled)
        self.scheduler = Scheduler(self.routine_interface)
        self.ready = {u: 0 for u in adj.keys()}
        """counts how many of an edge has satisfied its requirements"""
        self.blocked_tasks: List[MockRuntime.BlockedTask] = []
        self.__goto: AsyncMock = self.routine_interface.goto
        self.goto: Mock = Mock()

    def _on_scheduled(self, edge: Routine.Edge) -> None:
        id = edge.id
        if not self.edges[int(id)].dependencies:
            self.ready[id] += 1
        else:
            self.blocked_tasks.append(MockRuntime.BlockedTask(edge))

    def __on_scheduled(self, edge: Routine.Edge) -> None:
        self._on_scheduled(edge)

    def _process_call(self, edge: Routine.Edge) -> None:
        id = edge.id
        assert (
            self.ready[id] >= 1
        ), f"""Attempted RUN(eid={id}) but none ready.
    === BLOCKED INSTANCES ===
    {[x.waiting_for for x in self.blocked_tasks if x.edge.id == id]}
    =========================
    """
        self.ready[id] -= 1

        nblocked = []
        for t in self.blocked_tasks:
            if t.on_completion(id):
                self.ready[t.edge.id] += 1
            else:
                nblocked.append(t)
        self.blocked_tasks = nblocked

    def __process_call(self, edge: Routine.Edge) -> None:
        self._process_call(edge)

    def schedule(self, id: int) -> None:
        self.scheduler.schedule(self.edges[id], 10000)

    async def step(self, iterations: int) -> None:
        for _ in range(iterations):
            if not await self.next():
                break

    async def next(self) -> bool:
        self.__goto.reset_mock()
        ret = await self.scheduler.next()

        # validate call
        prev_call = self.__goto.call_args
        if prev_call:
            # print("PREV CALL", prev_call.args)
            self.__process_call(*prev_call.args)
            self.goto(*prev_call.args)
        return ret


class TestMockRuntime:
    def test_notready(self) -> None:
        a = MockRuntime([(0, 1)])
        with pytest.raises(AssertionError):
            a._process_call(a.edges[0])

    def test_dependency_not_met(self) -> None:
        a = MockRuntime([(0, 1)])
        with pytest.raises(AssertionError):
            a._on_scheduled(a.edges[1])
            a._process_call(a.edges[1])

    def test_intended(self) -> None:
        a = MockRuntime([(0, 1)])
        a._on_scheduled(a.edges[1])
        a._on_scheduled(a.edges[0])
        a._process_call(a.edges[0])
        a._process_call(a.edges[1])


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestOrdering:
    @pytest.mark.parametrize("n", (2, 4, 7, 15, 16, 99))
    @pytest.mark.parametrize("b", (2, 5))
    async def test_tree(self, n: int, b: int) -> None:
        a = MockRuntime([(i, i // b) for i in range(1, n)])
        a.schedule(0)
        await a.step(2 * n + 5)
        assert not await a.next(), "Should finish within `2n + 5` iterations."
        a.goto.assert_any_call(a.edges[0])

    @pytest.mark.parametrize("n", (99,))
    @pytest.mark.parametrize("b", (2, 10))
    @pytest.mark.parametrize("k", (3, 10))
    async def test_tree_k_times(self, n: int, b: int, k: int) -> None:
        a = MockRuntime([(i, i // b) for i in range(1, n)])
        for _ in range(k):
            a.schedule(0)
        await a.step(5 * k * n + 5)
        assert not await a.next(), "Should finish within `5kn + 5` iterations."
        a.goto.assert_any_call(a.edges[0])

    @pytest.mark.parametrize("n", (99,))
    @pytest.mark.parametrize("b", (2, 10))
    @pytest.mark.parametrize("k", (10,))
    async def test_tree_k_times_todo(self, n: int, b: int, k: int) -> None:
        a = MockRuntime([(i, i // b) for i in range(1, n)])
        for _ in range(k):
            a.schedule(0)
        await a.step(2 * k * n + 5)
        assert not await a.next(), "Should finish within `2kn + 5` iterations."
        a.goto.assert_any_call(a.edges[0])

    async def test_tree_random(self) -> None:
        seed(0)
        k = 10
        for id in range(1, 101):
            try:
                n = randint(2, id + 2)
                edges = [(i, randint(0, i - 1)) for i in range(1, n)]
                remap = [i for i in range(n)]
                shuffle(remap)
                edges = [(remap[u], remap[v]) for u, v in edges]
                a = MockRuntime(edges)
                expected = [randint(0, n - 1) for _ in range(k)]
                for eid in expected:
                    a.schedule(eid)
                    await a.step(3)  # a bit of offset between scheduling
                await a.step(2 * k * n)
                assert (
                    not await a.next()
                ), "Should finish within 2n avg steps per scheduled."
                for eid in expected:
                    a.goto.assert_any_call(a.edges[eid])
            except AssertionError as e:
                extra = [f"Failed on test {id} -- {e.args[0]}", f"edges={edges}"]
                raise AssertionError("\n".join((*extra, *e.args)))

    async def test_transitive(self) -> None:
        a = MockRuntime([(0, 4), (0, 2), (2, 4)])
        a.schedule(0)
        await a.step(4)
        assert not await a.next(), "Should finish"
        a.goto.assert_any_call(a.edges[0])

    async def test_overlap(self) -> None:
        edges: List[Tuple[int, int]] = []
        for k in range(5):
            for i in range(10):
                for j in range(10):
                    edges.append((i + 10 * k + 10, j + 10 * k))
        a = MockRuntime(edges)
        a.schedule(0)
        await a.step(100)
        assert not await a.next(), "Should finish within 100 steps. (50 exec, 50 run)"
        a.goto.assert_any_call(a.edges[0])
