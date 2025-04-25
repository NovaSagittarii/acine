from random import randint

import pytest
from acine.runtime.runtime import IController, Routine, Runtime
from acine_proto_dist.input_event_pb2 import InputEvent, InputReplay
from acine_proto_dist.position_pb2 import Point
from pytest_mock import MockerFixture, MockType

r1 = Routine(id=1, name="Test Routine", frames=[], nodes=[Routine.Node()])


@pytest.fixture
def mocked_controller(mocker: MockerFixture):
    controller = IController()
    controller.get_frame = mocker.AsyncMock()
    controller.mouse_down = mocker.AsyncMock()
    controller.mouse_move = mocker.AsyncMock()
    controller.mouse_up = mocker.AsyncMock()
    return controller


@pytest.fixture(autouse=True)
def mocked_now(mocker: MockerFixture):
    return mocker.patch("acine.runtime.runtime.now")


@pytest.fixture(autouse=True)
def mocked_sleep(mocker: MockerFixture):
    return mocker.patch("acine.runtime.runtime.sleep", new_callable=mocker.AsyncMock)


@pytest.fixture
def mocked_runtime(
    mocker: MockerFixture, mocked_controller, mocked_now, mocked_sleep
) -> tuple[MockType, MockType, IController, Runtime]:
    rt = Runtime(r1, mocked_controller)
    return (mocked_now, mocked_sleep, mocked_controller, rt)


def single_event_replay(event: InputEvent) -> InputReplay:
    return InputReplay(events=[event])


class TestRuntime:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("x", (1, 4))
    @pytest.mark.parametrize("y", (2, 3))
    async def test_run_replay_mouse_move(
        self, mocker: MockerFixture, mocked_runtime, x, y
    ):
        now, sleep, controller, rt = mocked_runtime

        event = InputEvent(move=Point(x=x, y=y))
        await rt.run_replay(single_event_replay(event))

        controller.mouse_move.assert_called_with(x, y)
        now.assert_called()
        sleep.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_replay_mouse_up(self, mocker: MockerFixture, mocked_runtime):
        now, sleep, controller, rt = mocked_runtime

        event = InputEvent(mouse_up=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        await rt.run_replay(single_event_replay(event))

        controller.mouse_up.assert_called()
        now.assert_called()
        sleep.assert_called_once()


class TestRuntimeIntegration:
    """
    Various tests on the graph traversal algorithm
    """

    def node(
        self,
        id: str,
        type: Routine.Node.NodeType = Routine.Node.NodeType.NODE_TYPE_STANDARD,
    ) -> Routine.Node:
        return Routine.Node(id=id, type=type)

    def node_init(self, id: str) -> Routine.Node:
        return self.node(id=id, type=Routine.Node.NodeType.NODE_TYPE_INIT)

    def node_ret(self, id: str) -> Routine.Node:
        return self.node(id=id, type=Routine.Node.NodeType.NODE_TYPE_RETURN)

    def add_edge(self, u: Routine.Node, v: Routine.Node, **kwargs) -> Routine.Edge:
        e = Routine.Edge(id=f"{u.id}->{v.id}", to=v.id, **kwargs)
        if e.WhichOneof("action") in ("replay", None):
            # if it is unset, assume it's a replay action (trackable)
            e.replay.duration = randint(0, 10**9)  # use as an id
        u.edges.append(e)
        return e

    @pytest.mark.asyncio
    @pytest.mark.parametrize("to", ("n1", "n2", "n3", "n4", "n5", "n6"))
    async def test_subroutine(self, mocker: MockerFixture, mocked_controller, to: str):
        """
        Starting from n1; every node is reachable.

        ```
        n1 ==(n3 -> n4 -> n5)==> n2 -> n6
        ```
        """

        n1 = self.node("n1")
        n2 = self.node("n2")
        n3 = self.node_init("n3")
        n4 = self.node("n4")
        n5 = self.node_ret("n5")
        n6 = self.node("n6")
        self.add_edge(n1, n2, subroutine="n3")
        self.add_edge(n2, n6)
        self.add_edge(n3, n4)
        self.add_edge(n4, n5)

        r = Routine(nodes=[n1, n2, n3, n4, n5, n6])
        rt = Runtime(r, mocked_controller)
        rt.run_replay = mocker.AsyncMock()
        rt.curr = n1
        await rt.goto(to)
        assert rt.curr.id == to
        await rt.goto("n6")
        assert rt.curr.id == "n6"
        rt.run_replay.assert_called()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("to", ("n2", "n3", "n4", "n5"))
    async def test_subroutine_nested(
        self, mocker: MockerFixture, mocked_controller, to: str
    ):
        """
        ```
        n1 ==(n2 ==(n3 -> n4)==> n5)==> n6
        ```
        """
        n1 = self.node("n1")
        n2 = self.node_init("n2")
        n3 = self.node_init("n3")
        n4 = self.node_ret("n4")
        n5 = self.node_ret("n5")
        n6 = self.node("n6")
        self.add_edge(n1, n6, subroutine="n2")
        self.add_edge(n2, n5, subroutine="n3")
        self.add_edge(n3, n4)

        r = Routine(nodes=[n1, n2, n3, n4, n5, n6])
        rt = Runtime(r, mocked_controller)
        rt.run_replay = mocker.AsyncMock()
        rt.curr = n1
        await rt.goto(to)
        assert rt.curr.id == to
        await rt.goto("n6")
        assert rt.curr.id == "n6"
        rt.run_replay.assert_called()
