from autobahn.asyncio.websocket import WebSocketServerProtocol
from time import time  # used to id frames

# import acine_proto_dist as pb
from acine_proto_dist.frame_pb2 import Frame
from acine_proto_dist.packet_pb2 import Packet, FrameOperation, Configuration
from acine_proto_dist.position_pb2 import Point

from .capture import GameCapture
from .input_handler import InputHandler
from .persist import fs_read, fs_write

title = "Arknights"
# title = "Untitled - Paint"
gc = GameCapture(title)
ih = InputHandler(title)


class AcineServerProtocol(WebSocketServerProtocol):

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

        # echo back message verbatim
        # self.sendMessage(payload, isBinary)
        if isBinary:
            packet = Packet.FromString(payload)
            match packet.WhichOneof("type"):
                case "frame_operation":
                    await self.on_frame_operation(packet)
                case "mouse_event":
                    await self.on_mouse_event(packet)
                case "configuration":
                    await self.on_configuration(packet)

    async def on_frame_operation(self, packet: Packet):
        match packet.frame_operation.type:
            case FrameOperation.FRAME_OP_GET:
                data = (await gc.get_png_frame()).tobytes()
                p = Packet(
                    frame_operation=FrameOperation(
                        type=FrameOperation.FRAME_OP_GET,
                        frame=Frame(id=int(time() * 1000), data=data),
                    )
                )
                # print(p.ByteSize())
                self.sendMessage(
                    p.SerializeToString(),
                    isBinary=True,
                )
            case FrameOperation.FRAME_OP_SAVE:
                f: Frame = packet.frame_operation.frame
                await fs_write(f"{f.id}.png", f.data)
            case FrameOperation.FRAME_OP_BATCH_GET:
                # populate requested frames
                for i, f in enumerate(packet.frame_operation.frames):
                    f.data = await fs_read(f"{f.id}.png")
                self.sendMessage(
                    packet.SerializeToString(),
                    isBinary=True,
                )

    async def on_mouse_event(self, packet: Packet):
        mouse_event_type = packet.mouse_event.WhichOneof("type")
        match mouse_event_type:
            case "move":
                pos: Point = packet.mouse_event.move
                ih.mouse_move(pos.x, pos.y)
            case "mouse_up" | "mouse_down":
                if mouse_event_type == "mouse_up":
                    button = packet.mouse_event.mouse_up
                    ih.mouse_up()
                else:
                    button = packet.mouse_event.mouse_down
                    ih.mouse_down()
                match button:
                    case Packet.MouseEvent.MouseButton.MOUSE_BUTTON_LEFT:
                        pass

    async def on_configuration(self, packet: Packet):
        w, h = gc.dimensions
        response = Packet(configuration=Configuration(width=w, height=h))
        self.sendMessage(response.SerializeToString(), isBinary=True)

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {}".format(reason))
