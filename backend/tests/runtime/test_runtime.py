from random import randint
from typing import Any, AsyncIterator, Never, Tuple, cast
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from acine_proto_dist.input_event_pb2 import InputEvent, InputReplay
from acine_proto_dist.position_pb2 import Point
from pytest_mock import MockerFixture

from acine.runtime.runtime import ActionResult, IController, Routine, Runtime

NodeType = Routine.Node.NodeType
EdgeType = Routine.Edge.EdgeTriggerType

r1 = Routine(id="1", name="Test Routine", nodes={"start": Routine.Node(id="start")})


@pytest.fixture
def mocked_controller(mocker: MockerFixture) -> IController:
    controller = IController()
    mocker.patch.object(controller, "get_frame")
    mocker.patch.object(controller, "mouse_down")
    mocker.patch.object(controller, "mouse_move")
    mocker.patch.object(controller, "mouse_up")
    return controller


@pytest.fixture(autouse=True)
def mocked_now(mocker: MockerFixture) -> Mock:
    return mocker.patch("acine.runtime.runtime.now")


@pytest.fixture(autouse=True)
def mocked_sleep(mocker: MockerFixture) -> AsyncMock:
    return cast(
        AsyncMock,
        mocker.patch("acine.runtime.runtime.sleep", new_callable=mocker.AsyncMock),
    )


MockedRuntimeUtilType = Tuple[Mock, AsyncMock, Mock, Runtime]


@pytest_asyncio.fixture
async def mocked_runtime(
    mocker: MockerFixture,
    mocked_controller: Mock,
    mocked_now: Mock,
    mocked_sleep: AsyncMock,
) -> AsyncIterator[MockedRuntimeUtilType]:
    with Runtime(r1, mocked_controller) as rt:
        yield (mocked_now, mocked_sleep, mocked_controller, rt)


@pytest.fixture
def mocked_check(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("acine.runtime.runtime.check")


@pytest.fixture
def mocked_check_once(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("acine.runtime.runtime.check_once")


@pytest.fixture
def checks_always_pass(
    mocker: MockerFixture, mocked_check: AsyncMock, mocked_check_once: AsyncMock
) -> None:
    mocked_check.return_value = (ActionResult.RESULT_PASS, None)
    mocked_check_once.return_value = True


def single_event_replay(event: InputEvent) -> InputReplay:
    return InputReplay(events=[event])


class TestRuntime:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("x", (1, 4))
    @pytest.mark.parametrize("y", (2, 3))
    async def test_run_replay_mouse_move(
        self,
        mocker: MockerFixture,
        mocked_runtime: MockedRuntimeUtilType,
        x: int,
        y: int,
    ) -> None:
        now, sleep, controller, rt = mocked_runtime

        event = InputEvent(move=Point(x=x, y=y))
        await rt.run_replay(single_event_replay(event))

        controller.mouse_move.assert_called_with(x, y)
        now.assert_called()
        sleep.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_replay_mouse_up(
        self, mocker: MockerFixture, mocked_runtime: MockedRuntimeUtilType
    ) -> None:
        now, sleep, controller, rt = mocked_runtime

        event = InputEvent(mouse_up=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        await rt.run_replay(single_event_replay(event))

        controller.mouse_up.assert_called()
        now.assert_called()
        sleep.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalid_restore_context(
        self, mocker: MockerFixture, mocked_runtime: MockedRuntimeUtilType
    ) -> None:
        now, sleep, controller, rt = mocked_runtime

        context = Runtime.Context()
        context.curr = Routine.Node(id="INVALID ID")

        old_curr = rt.get_context().curr
        assert rt.get_context().curr == old_curr
        rt.restore_context(context)
        assert rt.get_context().curr == old_curr

    @pytest.mark.asyncio
    async def test_invalid_goto(
        self, mocker: MockerFixture, mocked_runtime: MockedRuntimeUtilType
    ) -> None:
        now, sleep, controller, rt = mocked_runtime
        with pytest.raises(ValueError) as info:
            await rt.goto("INVALID ID")
        assert "target does not exist" in str(info.value)


class TestRuntimeIntegration:
    """
    Various tests on the graph traversal algorithm
    """

    @staticmethod
    def node(
        id: str,
        type: NodeType.ValueType = NodeType.NODE_TYPE_STANDARD,
    ) -> Routine.Node:
        return Routine.Node(
            id=id,
            type=type,
            default_condition=Routine.Condition(
                text=Routine.Condition.Text(regex=f"{id} {randint(1, 10**9)}")
            ),
        )

    @classmethod
    def node_init(cls, id: str) -> Routine.Node:
        return cls.node(id=id, type=Routine.Node.NodeType.NODE_TYPE_INIT)

    @classmethod
    def node_ret(cls, id: str) -> Routine.Node:
        return cls.node(id=id, type=Routine.Node.NodeType.NODE_TYPE_RETURN)

    @staticmethod
    def add_edge(
        u: Routine.Node,
        v: Routine.Node,
        type: EdgeType.ValueType = EdgeType.EDGE_TRIGGER_TYPE_STANDARD,
        repeat: int = 1,
        **kwargs: Any,
    ) -> Routine.Edge:
        e = Routine.Edge(
            id=f"{u.id}->{v.id}", to=v.id, repeat_lower=repeat, trigger=type, **kwargs
        )
        if e.WhichOneof("action") in ("replay", None):
            # if it is unset, assume it's a replay action (trackable)
            e.replay.duration = randint(0, 10**9)  # use as an id
        u.edges.append(e)
        return e

    @pytest.mark.asyncio
    @pytest.mark.dependency(name="goto")
    @pytest.mark.parametrize("s", ("start", "n2", "n3", "n4"))
    @pytest.mark.parametrize("t", ("start", "n2", "n3", "n4"))
    async def test_goto(
        self, mocker: MockerFixture, mocked_controller: IController, s: str, t: str
    ) -> None:
        """
              +-----------+
              v           |
        n1 -> n2 -> n3 -> n4
         ^          |
         +----------+
        """
        n1 = self.node("start")
        n2 = self.node("n2")
        n3 = self.node("n3")
        n4 = self.node("n4")
        self.add_edge(n1, n2)
        self.add_edge(n2, n3)
        self.add_edge(n3, n1)
        self.add_edge(n3, n4)
        self.add_edge(n4, n2)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(rt, "run_replay", return_value=None)
            await rt.goto(s)
            assert rt.context.curr.id == s
            await rt.goto(t)
            assert rt.context.curr.id == t

    @pytest.mark.asyncio
    @pytest.mark.dependency(name="subroutine", depends=["goto"])
    @pytest.mark.parametrize(
        "to",
        (
            "start",
            "n2",
            "n3",  # if failed this, probably didn't consider taking subroutine edge
            "n4",
            # pytest.param(
            #     "n5", marks=pytest.mark.xfail(reason="n5 is ret node, CAN autoret")
            # ),
            "n6",
        ),
    )
    async def test_subroutine(
        self, mocker: MockerFixture, mocked_controller: IController, to: str
    ) -> None:
        """
        Starting from n1; every node is reachable.

        ```
        n1 ==(n3 -> n4 -> n5)==> n2 -> n6
        ```
        """

        n1 = self.node("start")
        n2 = self.node("n2")
        n3 = self.node_init("n3")
        n4 = self.node("n4")
        n5 = self.node_ret("n5")
        n6 = self.node("n6")
        self.add_edge(n1, n2, subroutine="n3")
        e26 = self.add_edge(n2, n6)
        e34 = self.add_edge(n3, n4)
        e45 = self.add_edge(n4, n5)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4, n5, n6)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(rt, "run_replay", return_value=None)

            assert rt.context.curr.id == n1.id
            await rt.goto(to)
            assert rt.context.curr.id == to
            await rt.goto("n6")
            assert rt.context.curr.id == "n6"
            expected_calls = [mocker.call(e.replay, 0, 0) for e in [e34, e45, e26]]
            cast(AsyncMock, rt.run_replay).assert_has_calls(expected_calls)

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["subroutine"])
    @pytest.mark.parametrize(
        "to",
        (
            "n2",
            "n3",
            # pytest.param(
            #     "n4", marks=pytest.mark.xfail(reason="goto ret node CAN autoresolve")
            # ),
            # pytest.param(
            #     "n5", marks=pytest.mark.xfail(reason="goto ret node CAN autoresolve")
            # ),
        ),
    )
    async def test_subroutine_nested(
        self, mocker: MockerFixture, mocked_controller: IController, to: str
    ) -> None:
        """
        ```
        n1 ==(n2 ==(n3 -> n4)==> n5)==> n6
        ```
        """
        n1 = self.node("start")
        n2 = self.node_init("n2")
        n3 = self.node_init("n3")
        n4 = self.node_ret("n4")
        n5 = self.node_ret("n5")
        n6 = self.node("n6")
        self.add_edge(n1, n6, subroutine="n2")
        self.add_edge(n2, n5, subroutine="n3")
        e34 = self.add_edge(n3, n4)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4, n5, n6)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(rt, "run_replay", return_value=None)

            assert rt.context.curr.id == n1.id
            await rt.goto(to)
            assert rt.context.curr.id == to
            await rt.goto("n6")
            assert rt.context.curr.id == "n6"
            cast(AsyncMock, rt.run_replay).assert_called_once_with(e34.replay, 0, 0)

    @pytest.mark.parametrize(
        "subtest",
        (
            "check pre",
            "check post",
            "check pre/post",
        ),
    )
    @pytest.mark.asyncio
    async def test_default_condition(
        self,
        mocker: MockerFixture,
        mocked_controller: IController,
        mocked_check: AsyncMock,
        mocked_check_once: AsyncMock,
        subtest: str,
    ) -> None:
        """
        n1 -> n2 -> n3
        edge n1->n2 has auto precondition
        edge n2->n3 has auto postcondition
        """
        n1 = self.node("start")
        n2 = self.node("n2")
        n3 = self.node("n3")
        e12 = self.add_edge(n1, n2, precondition=Routine.Condition(auto=True))
        e23 = self.add_edge(n2, n3, postcondition=Routine.Condition(auto=True))

        # should be using check when you queue_edge
        mocked_check.return_value = (ActionResult.RESULT_PASS, None)
        mocked_check_once.return_value = True
        r = Routine(nodes={u.id: u for u in (n1, n2, n3)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(rt, "run_replay", return_value=None)

            if "pre" in subtest:  # 1 -> 2
                assert rt.context.curr.id == n1.id
                await rt.queue_edge(e12.id)
                # call pattern is (condition, getframe/frame, no_delay)
                checked = list(c.args[0] for c in mocked_check.call_args_list)
                # print(checked)
                # print("CMP", n1.default_condition)
                # print("CMP", checked[0])
                assert rt.context.curr.id == n2.id
                assert checked[0] == n1.default_condition
                assert checked[1] == e12.postcondition
                mocked_check_once.assert_not_called()
            else:
                await rt.goto(n2.id)
                assert rt.context.curr.id == n2.id
            mocked_check.reset_mock()

            if "post" in subtest:  # 2 -> 3
                assert rt.context.curr.id == n2.id
                await rt.queue_edge(e23.id)
                checked = list(c.args[0] for c in mocked_check.call_args_list)
                assert rt.context.curr.id == n3.id
                assert checked[0] == e23.precondition
                assert checked[1] == n3.default_condition

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["goto"])
    async def test_interrupt(
        self,
        mocker: MockerFixture,
        checks_always_pass: Never,
        mocked_controller: IController,
    ) -> None:
        """
        n1 --> n2 <-- n3
        |              ^
        +----> n4 -----+
        edge n1->n4 is an interrupt
        edge n1->n2 shouldn't be taken (should get interrupted)
        """
        n1 = self.node("start")
        n2 = self.node("n2")
        n3 = self.node("n3")
        n4 = self.node("n4")
        e12 = self.add_edge(n1, n2)
        e32 = self.add_edge(n3, n2)
        e14 = self.add_edge(n1, n4, Routine.Edge.EDGE_TRIGGER_TYPE_INTERRUPT)
        e43 = self.add_edge(n4, n3)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(rt, "run_replay", return_value=None)

            assert rt.context.curr.id == n1.id
            await rt.goto(n2.id)

            assert rt.context.curr.id == n2.id, "should be at n2 after `rt.goto(n2.id)`"
            cast(AsyncMock, rt.run_replay).assert_called()
            replays = [c.args[0] for c in cast(AsyncMock, rt.run_replay).call_args_list]
            assert e12.replay not in replays, "do not take edge n1->n2"
            assert e14.replay in replays, "take edge n1->n4 (interrupt)"
            assert e43.replay in replays, "take edge n4->n3 (after n1->n4 interrupt)"
            assert e32.replay in replays, "take edge n3->n2 (after n4->n3)"

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["goto"])
    @pytest.mark.parametrize("repeat", (1, 2, 3))
    async def test_queue_edge_subroutine(
        self,
        mocker: MockerFixture,
        checks_always_pass: Never,
        mocked_controller: IController,
        repeat: int,
    ) -> None:
        """
        n1 ==(n3 -> n4)==> n2
        """
        n1 = self.node("start")
        n2 = self.node("n2")
        n3 = self.node("n3", Routine.Node.NODE_TYPE_INIT)
        n4 = self.node("n4", Routine.Node.NODE_TYPE_RETURN)
        e12 = self.add_edge(n1, n2, repeat=repeat, subroutine="n3")
        e34 = self.add_edge(n3, n4)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(
                rt, "run_replay", return_value=None, autospec=rt.run_replay
            )

            assert rt.context.curr.id == n1.id
            await rt.queue_edge(e12.id)
            assert (
                rt.context.curr == n2
            ), "should be at n2 after exec subroutine `n1->n2`"
            cast(AsyncMock, rt.run_replay).assert_has_calls(
                [mocker.call(e34.replay, 0, 0) for _ in range(repeat)]
            )

    @pytest.mark.asyncio
    @pytest.mark.dependency(depends=["goto"])
    @pytest.mark.parametrize("repeat_outer", (1, 2, 3))
    @pytest.mark.parametrize("repeat_inner", (1, 5, 7))
    async def test_queue_edge_subroutine_nested(
        self,
        mocker: MockerFixture,
        checks_always_pass: Never,
        mocked_controller: IController,
        repeat_outer: int,
        repeat_inner: int,
    ) -> None:
        """
        n1 ==(n2 ==(n3 -> n4)==> n5)==> n6
        """
        n1 = self.node("start")
        n2 = self.node_init("n2")
        n3 = self.node_init("n3")
        n4 = self.node_ret("n4")
        n5 = self.node_ret("n5")
        n6 = self.node("n6")
        e16 = self.add_edge(n1, n6, repeat=repeat_outer, subroutine="n2")
        self.add_edge(n2, n5, repeat=repeat_inner, subroutine="n3")
        e34 = self.add_edge(n3, n4)

        r = Routine(nodes={u.id: u for u in (n1, n2, n3, n4, n5, n6)})
        with Runtime(r, mocked_controller) as rt:
            mocker.patch.object(
                rt, "run_replay", return_value=None, autospec=rt.run_replay
            )

            assert rt.context.curr.id == n1.id
            await rt.queue_edge(e16.id)
            assert (
                rt.context.curr == n6
            ), "should be at n6 after exec subroutine `n1->n6`"
            total = repeat_inner * repeat_outer
            assert cast(AsyncMock, rt.run_replay).call_count == total
            cast(AsyncMock, rt.run_replay).assert_has_calls(
                [mocker.call(e34.replay, 0, 0) for _ in range(total)]
            )
