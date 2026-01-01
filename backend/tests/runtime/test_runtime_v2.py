"""
A more complete test suite for Runtime?
"""

import asyncio
from copy import deepcopy
from typing import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from acine.runtime.runtime import (
    AcineNavigationError,
    ExecResult,
    IController,
    Routine,
    Runtime,
)

from .util import chain, forest  # type: ignore

NodeType = Routine.Node.NodeType
EdgeType = Routine.Edge.EdgeTriggerType


@pytest.fixture
def mocked_controller(mocker: MockerFixture) -> IController:
    controller = IController()
    mocker.patch.object(controller, "get_frame")
    mocker.patch.object(controller, "mouse_down")
    mocker.patch.object(controller, "mouse_move")
    mocker.patch.object(controller, "mouse_up")
    return controller


@pytest_asyncio.fixture
async def runtime(
    request: pytest.FixtureRequest,
    mocked_controller: IController,
) -> AsyncIterator[Runtime]:
    with Runtime(request.param, mocked_controller) as rt:
        yield rt


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestInvalid:
    async def test_no_start(self, mocked_controller: IController) -> None:
        """the node with id=start is required to initialize"""
        with pytest.raises(AssertionError):
            Runtime(Routine(nodes={"A": Routine.Node()}), mocked_controller)

    @pytest.mark.parametrize(
        "runtime", (forest(), chain()), indirect=True, ids=["forest", "chain"]
    )
    async def test_queue_edge_missing(self, runtime: Runtime) -> None:
        with pytest.raises(ValueError):
            await runtime.queue_edge("INVALID")

    @pytest.mark.parametrize(
        "runtime", (forest(), chain()), indirect=True, ids=["forest", "chain"]
    )
    async def test_goto_missing(self, runtime: Runtime) -> None:
        with pytest.raises(ValueError):
            await runtime.goto("INVALID")


@pytest.fixture(scope="class")
def class_setup_teardown() -> Iterator[None]:
    print("\nSetting up class-level resources...")
    yield  # This is where the tests in the class will run
    print("Tearing down class-level resources...")


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
@pytest.mark.usefixtures("class_setup_teardown")
class TestRunEdge:
    """
    `run_edge` handles condition check and replay.

    subroutine???
    """


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestQueueEdge:
    """
    `queue_edge` should only make calls to `goto` and `run_edge`.

    idk how to deal with subroutine

    ok this doesn't really do that much.
    """

    @pytest.mark.parametrize("runtime", (forest(),), indirect=True, ids=["forest"])
    async def test_attempt(self, mocker: MockerFixture, runtime: Runtime) -> None:
        mocked_goto = mocker.patch.object(runtime, "goto")
        mocked_goto.side_effect = AcineNavigationError("a", "b")
        assert (
            await runtime.queue_edge("e2") == ExecResult.REQUIREMENT_TYPE_ATTEMPT
        ), "Unable to get there."
        mocked_goto.assert_called()


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestGoto:
    """
    `goto` handles path-finding. It handles edge failures and rerouting.

    Makes calls to condition check.

    TODO: figure out how to test this later
    """

    @pytest.mark.parametrize("runtime", (chain(10),), indirect=True, ids=["chain"])
    @pytest.mark.parametrize("target", ("n1", "n3", "n9"))
    async def test_basic(self, runtime: Runtime, target: str) -> None:
        assert runtime.context.curr.id == "start", "Runtime initializes to start."
        await runtime.goto(target)
        assert runtime.context.curr.id == target, "should reach target"


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestGotoOnline:
    """
    `goto` online tests, only required for editor
    """

    @pytest.mark.parametrize("runtime", (chain(10),), indirect=True, ids=["chain"])
    async def test_goto_abort(self, runtime: Runtime) -> None:
        # make n3 -> n4 not reachable
        runtime.routine.nodes["n3"].edges[0].precondition.MergeFrom(
            Routine.Condition(fail=True, timeout=30000)
        )
        # goto n4 should attempt to take failed n3->n4 multiple times before
        # timing out. but it shouldn't time out because it quits after 0.1s
        # when the updated target of n3 is set

        async def to_be_cancelled() -> None:
            try:
                await runtime.goto("n4")
            except asyncio.CancelledError:
                pass

        initial_goto = asyncio.create_task(to_be_cancelled())

        async def delayed_abort() -> None:
            await asyncio.sleep(0.1)
            initial_goto.cancel()
            await runtime.goto("n3")

        await asyncio.gather(initial_goto, delayed_abort())
        assert runtime.context.curr.id == "n3", "should halt and reach n3"


@pytest.mark.asyncio
@pytest.mark.asyncio_time_limit(time_limit=2)
class TestContext:
    """
    `get_context` and `restore_context` are used to restore state when the
    navigation graph is updated by the editor.

    NOTE: Not sure at what graph size that it becomes practical to handle
    each update separately instead of pushing the graph every time.
    """

    @pytest.mark.parametrize("runtime", (chain(10),), indirect=True, ids=["chain"])
    @pytest.mark.parametrize("target", ("n4", "n7", "n9"))
    @pytest.mark.parametrize("source", ("n1", "n2", "n3"))
    async def test_basic(self, runtime: Runtime, source: str, target: str) -> None:
        await runtime.goto(source)
        assert runtime.context.curr.id == source, "should reach source (tmp)"
        ctx = deepcopy(runtime.get_context())
        await runtime.goto(target)
        assert runtime.context.curr.id == target, "should reach target"
        runtime.restore_context(ctx)
        assert runtime.context.curr.id == source, "should be back at source"
        await runtime.goto(target)
        assert runtime.context.curr.id == target, "should reach target"
