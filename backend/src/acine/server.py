from __future__ import annotations

import asyncio
import multiprocessing.pool
import time
import uuid
from copy import deepcopy

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
from autobahn.asyncio.websocket import WebSocketServerProtocol

from acine.runtime.util import get_frame

from . import instance_manager
from .capture import GameCapture
from .input_handler import InputHandler
from .persist import PrefixedFilesystem
from .runtime.check_image import check_similarity
from .runtime.runtime import IController, Runtime, cv2

# from .classifier import predict

# title = "Arknights"
title = "TestEnv"
# title = "Untitled - Paint"
# ih = InputHandler(title)  # ahk waits for window
# gc = GameCapture(title)  # windows_capture doesn't wait for window


class Controller(IController):
    ws: WebSocketServerProtocol
    gc: GameCapture
    ih: InputHandler

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

    async def get_frame(self) -> cv2.typing.MatLike:
        return await self.gc.get_frame()

    async def mouse_move(self, x: int, y: int) -> None:
        p = Packet(input_event=InputEvent(move=Point(x=x, y=y)))
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return self.ih.mouse_move(x, y)

    async def mouse_down(self) -> None:
        p = Packet(
            input_event=InputEvent(mouse_down=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        )
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return self.ih.mouse_down()

    async def mouse_up(self) -> None:
        p = Packet(
            input_event=InputEvent(mouse_up=InputEvent.MouseButton.MOUSE_BUTTON_LEFT)
        )
        self.ws.sendMessage(p.SerializeToString(), isBinary=True)
        return self.ih.mouse_up()


class AcineServerProtocol(WebSocketServerProtocol):
    gc: GameCapture | None = None
    ih: InputHandler | None = None
    rt: Runtime | None = None
    fs = PrefixedFilesystem()
    current_task: asyncio.Task | None = None

    def onConnect(self, request):
        """WebSocketServerProtocol method, 'connect' event"""
        print("Client connecting: {}".format(request.peer))

    def onOpen(self):
        """WebSocketServerProtocol method, 'open' event"""
        print("WebSocket connection open.")

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {}".format(reason))

        # cleanup
        if self.gc:
            print("run cleanup")
            self.gc.close()
            self.gc = None
            self.ih = None

    async def onMessage(self, payload, isBinary):
        """WebSocketServerProtocol method, 'message' event"""
        # if isBinary:
        #     print("Binary message received: {} bytes".format(len(payload)))
        # else:
        #     print("Text message received: {}".format(payload.decode("utf8")))

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
                    self.load_routine(packet.routine)
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

    def prepare_routine(self, routine: Routine):
        """
        Updates input_handler/game_capture and FS prefix based on the routine.
        """

        self.ih = InputHandler(routine.window_name, cmd=routine.start_command)
        if self.gc:
            self.gc.close()
        self.gc = GameCapture(routine.window_name)
        self.fs.set_prefix([routine.id])

    def load_routine(self, routine: Routine):
        """
        Reloads the runtime with an updated routine.
        Retains context if possible, i.e. same current_node still exists.
        """

        old_context = None
        if self.rt:
            # save and restore old position (if exists)
            old_context = deepcopy(self.rt.get_context())

            if self.current_task:
                self.current_task.cancel()

            if self.rt.routine.window_name != routine.window_name:
                # if window_name is different, recreate gc/ih
                self.prepare_routine(routine)
        else:
            # no routine existed before so gc/ih are unset
            self.prepare_routine(routine)

        self.rt = Runtime(
            routine,
            Controller(self, self.gc, self.ih),
            on_change_curr=self.on_change_curr,
            on_change_return=self.on_change_return,
            on_change_edge=self.on_change_edge,
        )
        if old_context:
            self.rt.restore_context(old_context)

    async def on_frame_operation(self, packet: Packet):
        match packet.frame_operation.type:
            case FrameOperation.OPERATION_GET:
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

    async def on_input_event(self, packet: Packet):
        event_type = packet.input_event.WhichOneof("type")
        match event_type:
            case "move":
                pos: Point = packet.input_event.move
                self.ih.mouse_move(pos.x, pos.y)
            case "mouse_up" | "mouse_down":
                if event_type == "mouse_up":
                    button = packet.input_event.mouse_up
                    self.ih.mouse_up()
                else:
                    button = packet.input_event.mouse_down
                    self.ih.mouse_down()
                match button:
                    case InputEvent.MouseButton.MOUSE_BUTTON_LEFT:
                        pass

    async def on_configuration(self, packet: Packet):
        raise DeprecationWarning("Prefer frame stream dimensions")
        w, h = self.gc.dimensions
        response = Packet(configuration=Configuration(width=w, height=h))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    async def on_get_routine(self, packet: Packet):
        s = await self.fs.read(["rt.pb"])
        response = Packet(get_routine=Routine.FromString(s))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_curr(self, node: Routine.Node):
        response = Packet(
            set_curr=RuntimeState(
                current_node=node, target_node=self.rt.target_node if self.rt else None
            )
        )
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_return(self, return_stack: list[Routine.Node]):
        # prune dummy node before sending
        response = Packet(set_stack=RuntimeState(stack_nodes=return_stack[1:]))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_edge(self, edge: Routine.Edge):
        response = Packet(set_curr=RuntimeState(current_edge=edge))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    async def on_set_curr(self, packet: Packet):
        """(from client) request to set curr"""
        target_node = packet.set_curr.current_node
        if self.rt and target_node.id in self.rt.nodes:
            if self.current_task:
                # abort previous goto (if still running)
                self.current_task.cancel()

            # for debug purposes, it's easier to just set state
            # on_queue_edge (click edge) can be used to test navigation
            self.rt.set_curr(target_node)

    async def on_goto(self, packet: Packet):
        """(from client) request to navigate goto a node"""
        target_node = packet.goto.current_node
        if self.rt and target_node.id in self.rt.nodes:
            if self.current_task:
                # abort previous goto (if still running)
                self.current_task.cancel()

            async def run_goto():
                try:
                    await self.rt.goto(target_node.id)
                except asyncio.CancelledError:
                    pass

            self.current_task = asyncio.create_task(run_goto())
            await self.current_task

    async def on_queue_edge(self, packet: Packet):
        target_edge = packet.queue_edge.current_edge
        if self.rt and target_edge.id in self.rt.edges:
            if self.current_task:
                # abort previous goto (if still running)
                self.current_task.cancel()

            async def run_goto():
                try:
                    await self.rt.queue_edge(target_edge.id)
                except asyncio.CancelledError:
                    pass

            self.current_task = asyncio.create_task(run_goto())
            await self.current_task

    async def on_sample_condition(self, packet: Packet, curr=False):
        """
        Processes a batch of frames based on a condition.
        """

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
                    "Unsupported packet type for on_sample_condition: "
                    + packet.WhichOneof("type")
                )
        condition_type = condition.WhichOneof("condition")
        match condition_type:
            case "image":
                c = condition.image
                c.threshold = 0.4  # clientside can filter
                ref = get_frame(self.rt.routine.id, c.frame_id)
                iresults = [None for _ in imgs]
                if len(imgs) == 1:
                    iresults[0] = check_similarity(c, imgs[0][1], ref)
                else:

                    def exec(fimg: tuple[Frame, cv2.typing.MatLike]):
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

    async def on_create_routine(self, packet: Packet):
        routine = instance_manager.create_routine(packet.create_routine)
        self.load_routine(routine)

        packet = Packet(get_routine=routine)
        self.sendMessage(packet.SerializeToString(), isBinary=True)

    async def on_load_routine(self, packet: Packet):
        routine = instance_manager.get_routine(packet.load_routine)
        self.load_routine(routine)

        packet = Packet(get_routine=routine)
        self.sendMessage(packet.SerializeToString(), isBinary=True)

    async def on_get_configuration(self, packet: Packet):
        packet.get_configuration.Clear()
        packet.get_configuration.routines.extend(instance_manager.get_routines())
        self.sendMessage(packet.SerializeToString(), isBinary=True)
