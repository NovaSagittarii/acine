import asyncio
import uuid

# import acine_proto_dist as pb
from acine_proto_dist.frame_pb2 import Frame
from acine_proto_dist.input_event_pb2 import InputEvent
from acine_proto_dist.packet_pb2 import Configuration, FrameOperation, Packet
from acine_proto_dist.position_pb2 import Point
from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import RuntimeState
from autobahn.asyncio.websocket import WebSocketServerProtocol

from .capture import GameCapture
from .input_handler import InputHandler
from .persist import fs_read, fs_write
from .runtime.runtime import IController, Runtime, cv2

# from .classifier import predict

# title = "Arknights"
title = "TestEnv"
# title = "Untitled - Paint"
gc = GameCapture(title)
ih = InputHandler(title)


class Controller(IController):
    async def get_frame(self) -> cv2.typing.MatLike:
        return await gc.get_frame()

    async def mouse_move(self, x: int, y: int) -> None:
        return ih.mouse_move(x, y)

    async def mouse_down(self) -> None:
        return ih.mouse_down()

    async def mouse_up(self) -> None:
        return ih.mouse_up()


class AcineServerProtocol(WebSocketServerProtocol):
    rt: Runtime | None = None
    current_task: asyncio.Task | None = None

    def onConnect(self, request):
        print("Client connecting: {}".format(request.peer))

    def onOpen(self):
        print("WebSocket connection open.")

    async def onMessage(self, payload, isBinary):
        """
        if isBinary:
            print("Binary message received: {} bytes".format(len(payload)))
        else:
            print("Text message received: {}".format(payload.decode("utf8")))
        """

        if isBinary:
            packet = Packet.FromString(payload)
            match packet.WhichOneof("type"):
                case "frame_operation":
                    await self.on_frame_operation(packet)
                case "input_event":
                    await self.on_input_event(packet)
                case "configuration":
                    await self.on_configuration(packet)
                case "routine":
                    data = Routine.SerializeToString(packet.routine)
                    await fs_write(["rt.pb"], data)
                    old_context = None
                    if self.rt:
                        # save and restore old position (if exists)
                        old_context = self.rt.get_context()

                        if self.current_task:
                            self.current_task.cancel()
                    self.rt = Runtime(
                        packet.routine,
                        Controller(),
                        on_change_curr=self.on_change_curr,
                        on_change_return=self.on_change_return,
                        on_change_edge=self.on_change_edge,
                    )
                    print(old_context)
                    if old_context:
                        self.rt.restore_context(old_context)
                case "get_routine":
                    await self.on_get_routine(packet)
                case "goto":
                    await self.on_goto(packet)

    async def on_frame_operation(self, packet: Packet):
        match packet.frame_operation.type:
            case FrameOperation.OPERATION_GET:
                img = await gc.get_png_frame()
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
                await fs_write(["img", f"{f.id}.png"], f.data)
            case FrameOperation.OPERATION_BATCH_GET:
                # populate requested frames
                for i, f in enumerate(packet.frame_operation.frames):
                    f.data = await fs_read(["img", f"{f.id}.png"])
                self.sendMessage(
                    packet.SerializeToString(),
                    isBinary=True,
                )

    async def on_input_event(self, packet: Packet):
        event_type = packet.input_event.WhichOneof("type")
        match event_type:
            case "move":
                pos: Point = packet.input_event.move
                ih.mouse_move(pos.x, pos.y)
            case "mouse_up" | "mouse_down":
                if event_type == "mouse_up":
                    button = packet.input_event.mouse_up
                    ih.mouse_up()
                else:
                    button = packet.input_event.mouse_down
                    ih.mouse_down()
                match button:
                    case InputEvent.MouseButton.MOUSE_BUTTON_LEFT:
                        pass

    async def on_configuration(self, packet: Packet):
        w, h = gc.dimensions
        response = Packet(configuration=Configuration(width=w, height=h))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    async def on_get_routine(self, packet: Packet):
        s = await fs_read(["rt.pb"])
        response = Packet(get_routine=Routine.FromString(s))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_curr(self, node: Routine.Node):
        response = Packet(set_curr=RuntimeState(current_node=node))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_return(self, return_stack: list[Routine.Node]):
        pass
        # response = Packet(set_stack=RuntimeState(return_stack=return_stack))
        # self.sendMessage(response.SerializeToString(), isBinary=True)

    def on_change_edge(self, edge: Routine.Edge):
        response = Packet(set_curr=RuntimeState(current_edge=edge))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    async def on_goto(self, packet: Packet):
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

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {}".format(reason))
