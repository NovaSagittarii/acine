"""
Example usage of interacting with the runtime
"""

import asyncio

from acine.capture import GameCapture
from acine.input_handler import InputHandler
from acine.persist import fs_read_sync as fs_read
from acine.runtime.runtime import IController, Routine, Runtime

if __name__ != "__main__":
    raise ImportError("Do not import this file.")

title = "Arknights"
gc = GameCapture(title)
ih = InputHandler(title)


class Controller(IController):
    async def get_frame(self):
        return await gc.get_frame()

    async def mouse_move(self, x, y):
        # print("MOVE", x, y)
        ih.mouse_move(x, y)

    async def mouse_up(self):
        # print("M DOWN")
        ih.mouse_up()

    async def mouse_down(self):
        # print("M UP")
        ih.mouse_down()


# sorry, no unit tests at the time of writing
# to verify correctness, i ran the program in a UI loop with a subroutine
# for about 10 minutes and it didn't break (previously it would break)
async def run():

    routine = Routine.FromString(fs_read(["rt.pb"]))
    rt = Runtime(routine, Controller())
    rt.curr = rt.nodes["1743814810164"]  # pretitle
    rt.curr = rt.nodes["1743845025324"]  # title
    rt.curr = rt.nodes["1743845105546"]  # lobby
    # await rt.goto(1744272692041)  # store_credit
    # await rt.goto(1744273928651)  # store_credit_claim
    # await rt.goto(1744273938680)  # resource_gain
    # await rt.goto(1744272692041)  # store_credit
    # await rt.queue_edge("12")  # claim credit
    for i in range(15, 21):
        # base routine
        await rt.queue_edge(str(i))

    # rt.curr = rt.nodes[1744434006282] # base
    while True:
        await rt.goto("1744434006282")  # go to base
        await rt.goto("1744434325209")  # confirm (via leave base, probably)


asyncio.run(run())
