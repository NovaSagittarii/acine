"""
Process to schedule all active routines.
"""

import asyncio
import datetime
import time

from acine.instance_manager import get_routines
from acine.power.win32 import sleep
from acine.scheduler import Multischeduler


async def main():
    routines = get_routines(full=True)
    ms = Multischeduler(routines)

    k = len(str(ms).split("\n")) + 2
    print("\n" * k)

    while True:
        try:
            next_unix = ms.next_time()
            idle_time = next_unix - time.time()
            print("\33[F\33[2K" * k, "\n" + str(ms), flush=True)
            print("clock", datetime.datetime.fromtimestamp(time.time()))
            if idle_time > 60:
                await sleep(idle_time - 10)
            else:
                await sleep(1)
            await ms.get_next().run()
        except BaseException as e:
            print(e)
            return 1


if __name__ == "__main__":
    asyncio.run(main())
