"""
functions for checking conditions
"""

from enum import Enum
from typing import Any, Callable, Coroutine

import cv2
from acine_proto_dist.routine_pb2 import Routine

from .check_image import check_image
from .util import now, sleep

GetImageCallableType = Callable[[], Coroutine[Any, Any, cv2.typing.MatLike]]


class CheckResult(Enum):
    ERROR = 0
    PASS = 1
    TIMEOUT = 2


async def check(
    condition: Routine.Condition,
    get_img: GetImageCallableType,
    *,
    no_delay: bool = False,
) -> CheckResult:
    """
    Implements runtime for Routine.Condition checks

    Makes multiple calls to get_img() until either
    the check passes or until timing out.
    """

    if not no_delay:
        await sleep(condition.delay)
    # if condition.WhichOneof("condition") is None:
    #     await sleep(100)
    timeout_duration = condition.timeout or 30000  # float('inf')
    timeout = now() + timeout_duration

    ct = 0
    while True:
        print("[?] check", ct, end="\r")
        ct += 1

        next = now() + condition.interval
        if now() > timeout:
            return CheckResult.TIMEOUT

        if check_once(condition, await get_img()):
            print("[== OK ==]", ct)
            return CheckResult.PASS

        # schedule for next check
        if next > timeout:
            await sleep(timeout - now())
            return CheckResult.TIMEOUT
        await sleep(next - now())


def check_once(condition: Routine.Condition, img: cv2.typing.MatLike) -> bool:
    """
    Runs a check once, returns True if pass
    """

    match condition.WhichOneof("condition"):
        case None:
            return True
        case "image":
            if check_image(condition.image, img):
                return True
        case "text":
            raise NotImplementedError()
        case _:
            raise NotImplementedError()
    return False
