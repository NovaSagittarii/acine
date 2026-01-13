"""
Utility classes that are basic implementation of interfaces.
"""

from acine_proto_dist.routine_pb2 import Routine

from acine.capture import GameCapture
from acine.input_handler import InputHandler
from acine.runtime.runtime import IController, ImageBmpType, Runtime
from acine.scheduler.typing import ExecResult, ISchedulerRoutineInterface


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

    async def get_frame(self) -> ImageBmpType:
        return await self.gc.get_frame()

    async def mouse_move(self, x: int, y: int) -> None:
        return await self.ih.mouse_move(x, y)

    async def mouse_down(self) -> None:
        return await self.ih.mouse_down()

    async def mouse_up(self) -> None:
        return await self.ih.mouse_up()


class BuiltinSchedulerRoutineInterface(ISchedulerRoutineInterface):
    def __init__(self, routine: Routine, runtime: Runtime):
        super().__init__(routine)
        self.runtime = runtime

    async def goto(self, e: Routine.Edge) -> ExecResult.ValueType:
        return await self.runtime.queue_edge(e.id)
