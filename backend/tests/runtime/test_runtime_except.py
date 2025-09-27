from typing import Any

import pytest
from acine_proto_dist.runtime_pb2 import Event
from pytest_mock import MockerFixture

from acine.runtime.exceptions import (
    NoPathError,
    SubroutineExecutionError,
)
from acine.runtime.runtime import CheckResult, ExecResult, IController, Routine, Runtime

NodeType = Routine.Node.NodeType
EdgeType = Routine.Edge.EdgeTriggerType


class MockRoutine:
    edge_counter: int = 0

    def __init__(self) -> None:
        self.nodes: dict[str, Routine.Node] = {"start": Routine.Node(id="start")}

    def add_node(
        self,
        id: str,
        node_type: NodeType.ValueType = NodeType.NODE_TYPE_STANDARD,
        **kwargs: Any,
    ) -> Routine.Node:
        self.nodes[id] = Routine.Node(id=id, type=node_type, **kwargs)
        return self.nodes[id]

    def add_edge(
        self,
        u: str,
        v: str,
        edge_type: EdgeType.ValueType = EdgeType.EDGE_TRIGGER_TYPE_STANDARD,
        **kwargs: Any,
    ) -> Routine.Edge:  # everything is subroutine or epsilon
        self.edge_counter += 1
        e = Routine.Edge(
            id=str(self.edge_counter),
            to=v,
            trigger=edge_type,
            repeat_lower=1,
            repeat_upper=1,
            **kwargs,
        )
        self.nodes[u].edges.append(e)
        return e

    def get(self) -> Routine:
        return Routine(nodes=self.nodes)


class MockRuntime(Runtime):
    def __init__(self, routine: Routine, mocker: MockerFixture):
        controller = IController()
        mocker.patch.object(controller, "get_frame")
        super().__init__(routine, controller)
        self._Runtime__exec_action = mocker.AsyncMock(return_value=None)
        self._Runtime__precheck_action = mocker.Mock(return_value=CheckResult.PASS)
        self._Runtime__check = self.__check

    async def __check(
        s,
        edge: Routine.Edge,
        phase: Event.Phase.ValueType,
        *,
        no_delay: bool = False,
        use_dest: bool = False,
    ) -> CheckResult:
        condition = (
            edge.precondition
            if phase == Event.PHASE_PRECONDITION
            else edge.postcondition
        )
        condition = super()._Runtime__process_condition(  # type: ignore
            edge, condition, use_dest=use_dest
        )
        if condition.WhichOneof("condition") is None:
            return CheckResult.PASS
        else:
            return CheckResult.TIMEOUT


@pytest.fixture
def sab() -> Routine:
    """start -> a -> b"""
    r = MockRoutine()
    r.add_node("a")
    r.add_node("b")
    r.add_edge("start", "a")
    r.add_edge("a", "b")
    return r.get()


@pytest.fixture
def srt() -> Routine:
    """start -> a -[c -> d -> e]-> b"""
    r = MockRoutine()
    for c in "adb":
        r.add_node(c)
    r.add_node("c", NodeType.NODE_TYPE_INIT)
    r.add_node("e", NodeType.NODE_TYPE_RETURN)
    r.add_edge("start", "a")
    r.add_edge("a", "b", subroutine="c")
    r.add_edge("c", "d")
    r.add_edge("d", "e")
    return r.get()


@pytest.fixture
def srt2() -> Routine:
    """start -> a -[c -[f -> g -> h]-> d -> e]-> b"""
    r = MockRoutine()
    for c in "adbg":
        r.add_node(c)
    r.add_node("c", NodeType.NODE_TYPE_INIT)
    r.add_node("f", NodeType.NODE_TYPE_INIT)
    r.add_node("e", NodeType.NODE_TYPE_RETURN)
    r.add_node("h", NodeType.NODE_TYPE_RETURN)
    r.add_edge("start", "a")
    r.add_edge("a", "b", subroutine="c")
    r.add_edge("c", "d", subroutine="f")
    r.add_edge("d", "e")
    r.add_edge("f", "g")
    r.add_edge("g", "h")
    return r.get()


def disable_condition(condition: Routine.Condition) -> None:
    condition.MergeFrom(Routine.Condition(image=Routine.Condition.Image()))


def enable_condition(condition: Routine.Condition) -> None:
    condition.ClearField("condition")


def test_enable_disable_condition() -> None:
    c = Routine.Condition()
    assert c.WhichOneof("condition") is None
    disable_condition(c)
    assert c.WhichOneof("condition") == "image"
    enable_condition(c)
    assert c.WhichOneof("condition") is None


class TestRuntimeExceptions:
    @pytest.mark.asyncio
    async def test_basic(self, sab: Routine, mocker: MockerFixture) -> None:
        rt = MockRuntime(sab, mocker)
        await rt.goto("b")
        assert rt.context.curr.id == "b"

    @pytest.mark.asyncio
    async def test_nav_fail(self, sab: Routine, mocker: MockerFixture) -> None:
        """start -/> a -> b"""
        e = sab.nodes["start"].edges[0]
        e2 = sab.nodes["a"].edges[0]
        disable_condition(e.precondition)
        rt = MockRuntime(sab, mocker)
        assert await rt.queue_edge(e2.id) == ExecResult.REQUIREMENT_TYPE_ATTEMPT
        assert rt.context.curr.id == "start"

    @pytest.mark.asyncio
    async def test_precondition_fail(self, sab: Routine, mocker: MockerFixture) -> None:
        """start -> a -/> b"""
        e = sab.nodes["a"].edges[0]
        disable_condition(e.precondition)
        rt = MockRuntime(sab, mocker)
        assert await rt.queue_edge(e.id) == ExecResult.REQUIREMENT_TYPE_CHECK
        assert rt.context.curr.id == "a"

    @pytest.mark.asyncio
    async def test_postcondition_fail(
        self, sab: Routine, mocker: MockerFixture
    ) -> None:
        """start -> a -/> b"""
        e = sab.nodes["a"].edges[0]
        disable_condition(e.postcondition)
        rt = MockRuntime(sab, mocker)
        assert await rt.queue_edge(e.id) == ExecResult.REQUIREMENT_TYPE_EXECUTE
        assert rt.context.curr.id == "a"

    @pytest.mark.asyncio
    async def test_no_path(self, sab: Routine, mocker: MockerFixture) -> None:
        sab.nodes["start"].edges.pop()
        rt = MockRuntime(sab, mocker)
        with pytest.raises(NoPathError):
            await rt.queue_edge(sab.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "start"

    @pytest.mark.skip(reason="currently subroutines cannot fail")
    @pytest.mark.asyncio
    async def test_subroutine_exec_fail(
        self, srt: Routine, mocker: MockerFixture
    ) -> None:
        disable_condition(srt.nodes["c"].edges[0].precondition)
        rt = MockRuntime(srt, mocker)
        with pytest.raises(SubroutineExecutionError):
            await rt.queue_edge(srt.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a", "subroutine fail to complete"

    @pytest.mark.skip(reason="currently subroutines cannot fail")
    @pytest.mark.asyncio
    async def test_nested_subroutine_exec_postcondition_fail(
        self, srt2: Routine, mocker: MockerFixture
    ) -> None:
        disable_condition(srt2.nodes["c"].edges[0].postcondition)
        rt = MockRuntime(srt2, mocker)
        with pytest.raises(SubroutineExecutionError):
            await rt.queue_edge(srt2.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a", "subroutine fail to complete"
