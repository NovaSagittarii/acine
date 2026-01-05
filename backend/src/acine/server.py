from __future__ import annotations

import asyncio
import multiprocessing.pool
import time
import uuid
from copy import deepcopy
from typing import List, Optional

# import acine_proto_dist as pb
from acine_proto_dist.frame_pb2 import Frame
from acine_proto_dist.input_event_pb2 import InputEvent
from acine_proto_dist.packet_pb2 import (
    ConditionProcessing,
    Configuration,
    FrameOperation,
    Packet,
)
from acine_proto_dist.position_pb2 import Point
from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import RuntimeState
from autobahn.asyncio.websocket import WebSocketServerProtocol  # type: ignore
from autobahn.websocket.types import ConnectionRequest  # type: ignore

from acine import instance_manager
from acine.capture import GameCapture
from acine.input_handler import InputHandler
from acine.instance_manager import write_runtime_data
from acine.persist import PrefixedFilesystem
from acine.runtime.check_image import SimilarityResult, check_similarity
from acine.runtime.runtime import IController, ImageBmpType, Runtime
from acine.runtime.util import get_frame

# from .classifier import predict

# title = "Arknights"
title = "TestEnv"
# title = "Untitled - Paint"
# ih = InputHandler(title)  # ahk waits for window
# gc = GameCapture(title)  # windows_capture doesn't wait for window


class Controller(IController):
    def __init__(
        self,
        websocket: WebSocketServerProtocol,
        game_capture: GameCapture,
        input_handler: InputHandler,
    ):
        super().__init__()
        self.ws = websocket
        self.gc = game_capture
        self.ih = input_handler

    async def get_frame(self) -> ImageBmpType:
        return await self.gc.get_frame()

    async def mouse_move(self, x: int, y: int) -> None:
        p = Packet(input_event=InputEvent(move=Point(x=x, y=y)))
        res = await self.ih.mouse_move(x, y)
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return res

    async def mouse_down(self) -> None:
        p = Packet(
            input_event=InputEvent(mouse_down=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        )
        res = await self.ih.mouse_down()
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return res

    async def mouse_up(self) -> None:
        p = Packet(
            input_event=InputEvent(mouse_up=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        )
        res = await self.ih.mouse_up()
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return res


class AcineServerProtocol(WebSocketServerProtocol):
    def __init__(self):
        super().__init__()
        self.gc: Optional[GameCapture] = None
        self.ih: Optional[InputHandler] = None
        self.rt: Optional[Runtime] = None
        self.fs = PrefixedFilesystem()
        self.current_task: Optional[asyncio.Task] = None

    def onConnect(self, request: ConnectionRequest) -> None:
        """WebSocketServerProtocol method, 'connect' event"""
        print("Client connecting: {}".format(request.peer))

    def onOpen(self) -> None:
        """WebSocketServerProtocol method, 'open' event"""
        print("WebSocket connection open.")

    def onClose(self, wasClean: bool, code: int, reason: str) -> None:
        print("WebSocket connection closed: {}".format(reason))

        # cleanup
        if self.gc:
            print("run cleanup")
            write_runtime_data(self.rt.routine, self.rt.data)  # persist logs
            self.gc.close()
            self.gc = None
            self.ih = None

    async def onMessage(self, payload: bytes, isBinary: bool) -> None:
        """WebSocketServerProtocol method, 'message' event"""
        # if isBinary:
        #     print("Binary message received: {} bytes".format(len(payload)))
        # else:
        #     print("Text message received: {}".format(payload.decode("utf8")))

        # 20ms is going to grief the goal of 60fps sending frames and forwarding inputs?
        # asyncio.get_running_loop().slow_callback_duration = 0.020
        # nvm it turns out PYTHONASYNCIODEBUG destroys performance

        if isBinary:
            packet = Packet.FromString(payload)
            match packet.WhichOneof("type"):
                case "create_routine":
                    await self.on_create_routine(packet)
                case "load_routine":
                    await self.on_load_routine(packet)
                case "get_configuration":
                    await self.on_get_configuration(packet)

            if self.gc is None:
                return
                # capture should be online before any routine-specific code runs

            match packet.WhichOneof("type"):
                case "frame_operation":
                    await self.on_frame_operation(packet)
                case "input_event":
                    await self.on_input_event(packet)
                case "configuration":
                    await self.on_configuration(packet)
                case "routine":
                    data = Routine.SerializeToString(packet.routine)
                    await self.fs.write(["rt.pb"], data)
                    await self.load_routine(packet.routine)
                case "get_routine":
                    await self.on_get_routine(packet)
                case "set_curr":
                    await self.on_set_curr(packet)
                case "goto":
                    await self.on_goto(packet)
                case "queue_edge":
                    await self.on_queue_edge(packet)
                case "sample_condition":
                    await self.on_sample_condition(packet, False)
                case "sample_current":
                    await self.on_sample_condition(packet, True)

    def abort_task(f):
        """abort current task (goto/queue_edge) before running"""

        async def wrapped(self: AcineServerProtocol, *args, **kwargs):
            if self.current_task:
                # abort previous goto (if still running)
                self.current_task.cancel()
            await f(self, *args, **kwargs)

        return wrapped

    async def prepare_routine(self, routine: Routine) -> None:
        """
        Updates input_handler/game_capture and FS prefix based on the routine.
        """

        self.ih = InputHandler(
            routine.launch_config.window_name, cmd=routine.launch_config.start_command
        )
        await self.ih.init()
        if self.gc:
            self.gc.close()
        self.gc = GameCapture(routine.launch_config.window_name)
        self.fs.set_prefix([routine.id])

    @abort_task
    async def load_routine(self, routine: Routine) -> None:
        """
        Reloads the runtime with an updated routine.
        Retains context if possible, i.e. same current_node still exists.
        """

        old_context = None
        if self.rt:
            # save and restore old position (if exists)
            old_context = deepcopy(self.rt.get_context())

            if self.rt.routine.window_name != routine.window_name:
                # if window_name is different, recreate gc/ih
                await self.prepare_routine(routine)
        else:
            # no routine existed before so gc/ih are unset
            await self.prepare_routine(routine)

        assert self.gc and self.ih, "Peripherals should be initialized."

        self.rt = Runtime(
            routine,
            Controller(self, self.gc, self.ih),
            on_change_curr=self.on_change_curr,
            on_change_return=self.on_change_return,
            on_change_edge=self.on_change_edge,
            # NOTE: this is only for testing, this won't persist since
            # runtimedata is not set (so it gets reset repeatedly)
            # enable_logs=True,
        )
        if old_context:
            self.rt.restore_context(old_context)

    async def on_frame_operation(self, packet: Packet) -> None:
        match packet.frame_operation.type:
            case FrameOperation.OPERATION_GET:
                if not self.gc:
                    return
                img, width, height = await self.gc.get_png_frame()
                state = "DISABLED"  # predict(img)
                data = img.tobytes()
                p = Packet(
                    frame_operation=FrameOperation(
                        type=FrameOperation.OPERATION_GET,
                        frame=Frame(
                            # since websocket is built on HTTP
                            # you don't need to worry about the time for
                            # reordering packets
                            id=str(uuid.uuid4()),
                            data=data,
                            state=state,
                            width=width,
                            height=height,
                        ),
                    )
                )
                # print(p.ByteSize())
                self.sendMessage(
                    p.SerializeToString(),
                    isBinary=True,
                )
            case FrameOperation.OPERATION_SAVE:
                f: Frame = packet.frame_operation.frame
                await self.fs.write(["img", f"{f.id}.png"], f.data)
            case FrameOperation.OPERATION_BATCH_GET:
                # populate requested frames
                for i, f in enumerate(packet.frame_operation.frames):
                    f.data = await self.fs.read(["img", f"{f.id}.png"])
                self.sendMessage(
                    packet.SerializeToString(),
                    isBinary=True,
                )

    async def on_input_event(self, packet: Packet) -> None:
        if not self.ih:
            return
        event_type = packet.input_event.WhichOneof("type")
        match event_type:
            case "move":
                pos: Point = packet.input_event.move
                await self.rt.controller.mouse_move(pos.x, pos.y)
            case "mouse_up" | "mouse_down":
                if event_type == "mouse_up":
                    button = packet.input_event.mouse_up
                    await self.rt.controller.mouse_up()
                else:
                    button = packet.input_event.mouse_down
                    await self.rt.controller.mouse_down()
                match button:
                    case InputEvent.MouseButton.MOUSE_BUTTON_LEFT:
                        pass

    async def on_configuration(self, packet: Packet) -> None:
        raise DeprecationWarning("Prefer frame stream dimensions")
        w, h = self.gc.dimensions
        response = Packet(configuration=Configuration(width=w, height=h))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    async def on_get_routine(self, packet: Packet) -> None:
        routine = Routine.FromString(await self.fs.read(["rt.pb"]))
        response = Packet(get_routine=routine)
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_curr(self, node: Routine.Node) -> None:
        response = Packet(
            set_curr=RuntimeState(
                current_node=node, target_node=self.rt.target_node if self.rt else None
            )
        )
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_return(self, call_stack: List[Runtime.Call]) -> None:
        # prune dummy node before sending
        st = [x.edge for x in call_stack[1:]]  # TODO: maybe modify RuntimeState?
        # seems like SubroutineCall **can** be a proto

        response = Packet(set_stack=RuntimeState(stack_edges=st))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_edge(self, edge: Optional[Routine.Edge]) -> None:
        response = Packet(
            set_curr=RuntimeState(
                current_edge=edge, target_node=self.rt.target_node if self.rt else None
            )
        )
        self.sendMessage(response.SerializeToString(), isBinary=True)

    @abort_task
    async def on_set_curr(self, packet: Packet) -> None:
        """(from client) request to set curr"""
        target_node = packet.set_curr.current_node
        if self.rt and target_node.id in self.rt.nodes:
            # for debug purposes, it's easier to just set state
            # on_queue_edge (click edge) can be used to test navigation
            self.rt.set_curr(target_node)

    @abort_task
    async def on_goto(self, packet: Packet) -> None:
        """(from client) request to navigate goto a node"""
        target_node = packet.goto.current_node
        if self.rt and target_node.id in self.rt.nodes:

            async def run_goto(rt: Runtime) -> None:
                try:
                    for _ in range(10):
                        try:
                            await rt.goto(target_node.id)
                            break
                        except BaseException:
                            pass
                except asyncio.CancelledError:
                    pass

            self.current_task = asyncio.create_task(run_goto(self.rt))
            await self.current_task

    @abort_task
    async def on_queue_edge(self, packet: Packet) -> None:
        target_edge = packet.queue_edge.current_edge
        if self.rt and target_edge.id in self.rt.edges:

            async def run_goto(rt: Runtime) -> None:
                try:
                    await rt.queue_edge(target_edge.id)
                except asyncio.CancelledError:
                    pass

            self.current_task = asyncio.create_task(run_goto(self.rt))
            await self.current_task

    async def on_sample_condition(self, packet: Packet, curr: bool = False) -> None:
        """
        Processes a batch of frames based on a condition.
        """

        if not self.rt or not self.gc:
            return

        match packet.WhichOneof("type"):
            case "sample_condition":
                imgs = [
                    (f, get_frame(self.rt.routine.id, f.id))
                    for f in self.rt.routine.frames.values()
                ]
                output = packet.sample_condition.frames
                condition = packet.sample_condition.condition
            case "sample_current":
                emptyFrame = Frame(id="REALTIME")
                imgs = [(emptyFrame, await self.gc.get_frame())]
                output = packet.sample_current.frames
                condition = packet.sample_current.condition
            case _:
                raise NotImplementedError(
                    "Unsupported packet type for on_sample_condition",
                    packet.WhichOneof("type"),
                )
        condition_type = condition.WhichOneof("condition")
        match condition_type:
            case "image":
                c = condition.image
                c.threshold = 0.4  # clientside can filter
                ref = get_frame(self.rt.routine.id, c.frame_id)
                iresults: List[List[SimilarityResult]] = []
                if len(imgs) == 1:
                    iresults.append(check_similarity(c, imgs[0][1], ref))
                else:

                    def exec(
                        fimg: tuple[Frame, ImageBmpType],
                    ) -> List[SimilarityResult]:
                        return check_similarity(c, fimg[1], ref, return_one=True)

                    t0 = time.time()
                    print(f"[ ] Start processing {len(imgs)} frames")
                    with multiprocessing.pool.ThreadPool() as p:
                        iresults = p.map(exec, imgs, chunksize=3)
                    print(f"[+] Completed {time.time() - t0:.2f}s")
                for i, fimg in enumerate(imgs):
                    f, _ = fimg
                    results = iresults[i]
                    if not results:
                        continue

                    pb = ConditionProcessing.Frame(frame=f)
                    for result in results:
                        y, x = result.position
                        pb.matches.append(
                            ConditionProcessing.Match(
                                position=Point(x=x, y=y), score=result.score
                            )
                        )
                    output.append(pb)
                output.sort(key=lambda x: x.matches[0].score, reverse=True)
            case _:
                raise NotImplementedError(f"No implementation for {condition_type}")
        self.sendMessage(packet.SerializeToString(), isBinary=True)

    async def on_create_routine(self, packet: Packet) -> None:
        routine = instance_manager.create_routine(packet.create_routine)
        await self.load_routine(routine)

        packet = Packet(get_routine=routine)
        self.sendMessage(packet.SerializeToString(), isBinary=True)

    async def on_load_routine(self, packet: Packet) -> None:
        routine = instance_manager.get_routine(packet.load_routine)
        await self.load_routine(routine)

        packet = Packet(get_routine=routine)
        self.sendMessage(packet.SerializeToString(), isBinary=True)

        data = instance_manager.get_runtime_data(routine)
        self.sendMessage(Packet(runtime=data).SerializeToString(), isBinary=True)

    async def on_get_configuration(self, packet: Packet) -> None:
        packet.get_configuration.Clear()
        packet.get_configuration.routines.extend(instance_manager.get_routines())
        self.sendMessage(packet.SerializeToString(), isBinary=True)
