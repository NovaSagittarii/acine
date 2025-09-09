import asyncio
import datetime
import time

from acine.instance_manager import get_routines
from acine.power.win32 import sleep
from acine.scheduler.managed_runtime import ManagedRuntime


async def main():
    routines = get_routines(full=True)
    for i, x in enumerate(routines):
        print(i, x.name, x.start_command)
    i = int(input("which index? "))
    assert routines[i]
    routine = routines[i]
    print(f"using [{routine.name}]\n")

    mrt = ManagedRuntime(routine)
    if input(f"run {mrt.next_groups(mrt.next_time())} once? (Y/n) ") == "Y":
        await mrt.run(mrt.next_time())
        return

    while True:
        try:
            next_unix = mrt.next_time()
            idle_time = next_unix - time.time()
            now = datetime.datetime.now()
            next = datetime.datetime.fromtimestamp(next_unix)
            print(f"\33[F\33[2K[{now} => {next}] idle {idle_time:.2f}s")
            if idle_time > 60:
                await sleep(idle_time - 10)
            await asyncio.sleep(min(idle_time, 0.02))
            await mrt.run()
        except BaseException as e:
            print(e)
            return 1


if __name__ == "__main__":
    asyncio.run(main())
