from autobahn.asyncio.websocket import WebSocketServerProtocol

# import acine_proto_dist as pb
from acine_proto_dist.frame_pb2 import Frame
from acine_proto_dist.packet_pb2 import Packet, FrameOperation
from acine_proto_dist.position_pb2 import PointSequence

from .capture import GameCapture

gc = GameCapture("Arknights")


class AcineServerProtocol(WebSocketServerProtocol):

    def onConnect(self, request):
        print("Client connecting: {}".format(request.peer))

    def onOpen(self):
        print("WebSocket connection open.")

    async def onMessage(self, payload, isBinary):
        if isBinary:
            print("Binary message received: {} bytes".format(len(payload)))
        else:
            print("Text message received: {}".format(payload.decode("utf8")))

        # echo back message verbatim
        # self.sendMessage(payload, isBinary)
        if isBinary:
            packet = Packet.FromString(payload)
            print(packet)
            match packet.WhichOneof("type"):
                case "frame_operation":
                    match packet.frame_operation.type:
                        case FrameOperation.FRAME_OP_GET:
                            data = (await gc.get_png_frame()).tobytes()
                            p = Packet(
                                frame_operation=FrameOperation(
                                    type=FrameOperation.FRAME_OP_GET,
                                    frame=Frame(id=0, data=data),
                                )
                            )
                            print(p.ByteSize())
                            self.sendMessage(
                                p.SerializeToString(),
                                isBinary=True,
                            )

    def onClose(self, wasClean, code, reason):
        print("WebSocket connection closed: {}".format(reason))
