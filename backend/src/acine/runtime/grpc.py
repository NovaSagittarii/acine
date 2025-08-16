"""
gRPC service rpc handlers for acine runtime

**currently not implemented**

if programming is needed, just work with runtime directly
"""

import asyncio
import logging

import acine_proto_dist.runtime_pb2_grpc as runtime_grpc
import google.protobuf.empty_pb2 as Empty
import grpc
from acine_proto_dist.routine_pb2 import Routine

rt = Routine()


class RuntimeService(runtime_grpc.RuntimeServicer):
    async def GetCurrentNode(
        self,
        _request: Empty,
        _context: grpc.aio.ServicerContext,
    ) -> Routine.Node:
        return curr

    async def SetNode(
        self,
        request: Routine.Node,
        _context: grpc.aio.ServicerContext,
    ) -> Empty:
        global curr
        curr = request
        return Empty()

    async def GoToNode(
        self,
        request: Routine.Node,
        _context: grpc.aio.ServicerContext,
    ) -> Empty:
        return Empty()


async def serve() -> None:
    server = grpc.aio.server()
    runtime_grpc.add_RuntimeServicer_to_server(RuntimeService(), server)
    listen_addr = "[::]:50051"
    server.add_insecure_port(listen_addr)
    logging.info("Starting server on %s", listen_addr)
    await server.start()
    await server.wait_for_termination()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(serve())
