import asyncio

from autobahn.asyncio.websocket import WebSocketServerFactory  # type: ignore

from acine.instance_manager import EXAMPLE_ID, Routine, create_testenv, validate_routine
from acine.server import AcineServerProtocol

if __name__ == "__main__":
    # make sure Example Routine (testenv) exists
    if not validate_routine(Routine(id=EXAMPLE_ID)):
        create_testenv()

    factory = WebSocketServerFactory()
    factory.protocol = AcineServerProtocol

    loop = asyncio.get_event_loop()
    coro = loop.create_server(factory, "127.0.0.1", 9000)
    server = loop.run_until_complete(coro)

    print("starting")
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.close()
        loop.close()
