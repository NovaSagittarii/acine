import asyncio
import datetime
import time

import inquirer

from acine.instance_manager import get_routines
from acine.power.win32 import sleep
from acine.scheduler.managed_runtime import ManagedRuntime


async def main():
    routines = get_routines(full=True)
    questions = [
        inquirer.List(
            "routine",
            message="Which routine to run?",
            choices=[
                f"{i} {r.name} [exec: {r.start_command}]"
                for i, r in enumerate(routines)
            ],
            carousel=True,
        ),
    ]
    i = int(inquirer.prompt(questions)["routine"].split()[0])

    assert routines[i]
    routine = routines[i]
    print(f"using [{routine.name}]\n")

    mrt = ManagedRuntime(routine)
    questions = [
        inquirer.List(
            "mode",
            message="What to run?",
            choices=[
                f"0 run {mrt.next_groups(mrt.next_time())} once",
                f"1 run specific once",
                f"2 run background",
            ],
            carousel=True,
        )
    ]
    mode = int(inquirer.prompt(questions)["mode"].split()[0])
    if mode == 0:
        await mrt.run(mrt.next_time())
        return
    elif mode == 1:
        questions = [
            inquirer.List(
                "sg",
                message="Which scheduling group?",
                choices=[f"{i} {sg.group.name}" for i, sg in enumerate(mrt.S.values())],
                carousel=True,
            )
        ]
        sgi = mode = int(inquirer.prompt(questions)["sg"].split()[0])
        sg = list(mrt.S.values())[sgi]
        sg.next_time = 0
        await mrt.run(1)
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
