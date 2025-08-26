import asyncio
import datetime
import time

from acine.instance_manager import get_routines
from acine.scheduler.managed_runtime import ManagedRuntime


async def main():
    routines = get_routines(full=True)
    for i, x in enumerate(routines):
        print(i, x.name, x.start_command)
    i = int(input("which index? "))
    assert routines[i]
    routine = routines[i]

    mrt = ManagedRuntime(routine)

    while True:
        try:
            idle_time = mrt.next_time() - time.time()
            print(f"\33[F\33[2K[{datetime.datetime.now()}] idle {idle_time:.2f}s")
            await asyncio.sleep(min(idle_time, 0.02))
            await mrt.run()
        except BaseException as e:
            print(e)
            return 1


if __name__ == "__main__":
    asyncio.run(main())
