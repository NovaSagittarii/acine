from src.server import AcineServerProtocol

if __name__ == "__main__":

    import asyncio

    from autobahn.asyncio.websocket import WebSocketServerFactory

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
