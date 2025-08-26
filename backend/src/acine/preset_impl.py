"""
Utility classes that are basic implementation of interfaces.
"""

from acine.capture import GameCapture
from acine.input_handler import InputHandler
from acine.runtime.runtime import IController, Runtime
from acine.scheduler.scheduler import ExecResult, ISchedulerRoutineInterface
from acine_proto_dist.routine_pb2 import Routine
from cv2.typing import MatLike


class BuiltinController(IController):
    """basic controller (no hooks) that uses InputHandler and GameCapture"""

    def __init__(
        self,
        game_capture: GameCapture,
        input_handler: InputHandler,
    ):
        super().__init__()
        self.gc = game_capture
        self.ih = input_handler

    async def get_frame(self) -> MatLike:
        return await self.gc.get_frame()

    async def mouse_move(self, x: int, y: int) -> None:
        return self.ih.mouse_move(x, y)

    async def mouse_down(self) -> None:
        return self.ih.mouse_down()

    async def mouse_up(self) -> None:
        return self.ih.mouse_up()


class BuiltinSchedulerRoutineInterface(ISchedulerRoutineInterface):
    def __init__(self, routine: Routine, runtime: Runtime):
        super().__init__(routine)
        self.runtime = runtime

    async def goto(self, e: Routine.Edge) -> ExecResult:
        await self.runtime.queue_edge(e.id)
        # TODO: queue_edge should return ExecResult
        return ExecResult.REQUIREMENT_TYPE_COMPLETION
