import pytest
from pytest_mock import MockerFixture

from acine.runtime.exceptions import (
    NavigationError,
    NoPathError,
    PostconditionTimeoutError,
    PreconditionTimeoutError,
    SubroutineExecutionError,
)
from acine.runtime.runtime import CheckResult, IController, Routine, Runtime

NodeType = Routine.Node.NodeType
EdgeType = Routine.Edge.EdgeTriggerType


class MockRoutine:
    edge_counter: int = 0

    def __init__(self):
        self.nodes: dict[str, Routine.Node] = {"start": Routine.Node(id="start")}

    def add_node(
        self,
        id: str,
        node_type: NodeType = NodeType.NODE_TYPE_STANDARD,
        **kwargs,
    ) -> Routine.Node:
        self.nodes[id] = Routine.Node(id=id, type=node_type, **kwargs)
        return self.nodes[id]

    def add_edge(
        self,
        u: str,
        v: str,
        edge_type: EdgeType = EdgeType.EDGE_TRIGGER_TYPE_STANDARD,
        **kwargs,
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

    def get(self):
        return Routine(nodes=self.nodes)


class MockRuntime(Runtime):
    def __init__(self, routine: MockRoutine, mocker: MockerFixture):
        controller = IController()
        controller.get_frame = mocker.AsyncMock()
        super().__init__(routine, controller)
        self._Runtime__exec_action = mocker.AsyncMock(return_value=None)
        self._Runtime__precheck_action = mocker.Mock(return_value=CheckResult.PASS)
        self._Runtime__check = self.__check

    async def __check(
        s,
        edge: Routine.Edge,
        condition: Routine.Condition,
        *,
        no_delay: bool = False,
        use_dest: bool = False,
    ):
        condition = super()._Runtime__process_condition(
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


def disable_condition(condition: Routine.Condition):
    condition.MergeFrom(Routine.Condition(image={}))


def enable_condition(condition: Routine.Condition):
    condition.MergeFrom(Routine.Condition)


class TestRuntimeExceptions:
    @pytest.mark.asyncio
    async def test_basic(self, sab, mocker):
        rt = MockRuntime(sab, mocker)
        await rt.goto("b")
        assert rt.context.curr.id == "b"

    @pytest.mark.asyncio
    async def test_nav_fail(self, sab: Routine, mocker):
        """start -/> a -> b"""
        disable_condition(sab.nodes["start"].edges[0].precondition)
        rt = MockRuntime(sab, mocker)
        with pytest.raises(NavigationError):
            await rt.queue_edge(sab.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "start"

    @pytest.mark.asyncio
    async def test_precondition_fail(self, sab: Routine, mocker):
        """start -> a -/> b"""
        disable_condition(sab.nodes["a"].edges[0].precondition)
        rt = MockRuntime(sab, mocker)
        with pytest.raises(PreconditionTimeoutError):
            await rt.queue_edge(sab.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a"

    @pytest.mark.asyncio
    async def test_postcondition_fail(self, sab: Routine, mocker):
        """start -> a -/> b"""
        disable_condition(sab.nodes["a"].edges[0].postcondition)
        rt = MockRuntime(sab, mocker)
        with pytest.raises(PostconditionTimeoutError):
            await rt.queue_edge(sab.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a"

    @pytest.mark.asyncio
    async def test_no_path(self, sab: Routine, mocker):
        sab.nodes["start"].edges.pop()
        rt = MockRuntime(sab, mocker)
        with pytest.raises(NoPathError):
            await rt.queue_edge(sab.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "start"

    @pytest.mark.skip(reason="currently subroutines cannot fail")
    @pytest.mark.asyncio
    async def test_subroutine_exec_fail(self, srt, mocker):
        disable_condition(srt.nodes["c"].edges[0].precondition)
        rt = MockRuntime(srt, mocker)
        with pytest.raises(SubroutineExecutionError):
            await rt.queue_edge(srt.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a", "subroutine fail to complete"

    @pytest.mark.skip(reason="currently subroutines cannot fail")
    @pytest.mark.asyncio
    async def test_nested_subroutine_exec_postcondition_fail(self, srt2, mocker):
        disable_condition(srt2.nodes["c"].edges[0].postcondition)
        rt = MockRuntime(srt2, mocker)
        with pytest.raises(SubroutineExecutionError):
            await rt.queue_edge(srt2.nodes["a"].edges[0].id)
        assert rt.context.curr.id == "a", "subroutine fail to complete"
