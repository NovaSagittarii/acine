import asyncio
import os
from typing import Final

from autobahn.asyncio.websocket import WebSocketServerFactory  # type: ignore

from acine.instance_manager import EXAMPLE_ID, Routine, create_testenv, validate_routine
from acine.server import AcineServerProtocol

HOST: Final[str] = os.environ.get("BACKEND_HOST", "127.0.0.1")
PORT: Final[int] = int(os.environ.get("BACKEND_PORT", "9000"))


async def main() -> None:
    # make sure Example Routine (testenv) exists
    if not validate_routine(Routine(id=EXAMPLE_ID)):
        create_testenv()

    factory = WebSocketServerFactory()
    factory.protocol = AcineServerProtocol

    loop = asyncio.get_running_loop()
    print(f"Running on ws://{HOST}:{PORT}")
    server = await loop.create_server(factory, HOST, PORT)

    print("starting")
    await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
