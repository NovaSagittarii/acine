"""
functions for checking conditions
"""

from enum import Enum
from typing import Awaitable, Callable

import cv2
from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import Event

from .check_image import check_image
from .util import now, sleep

GetImageCallableType = Callable[[], Awaitable[cv2.typing.MatLike]]


# TODO: replace with runtime.Event.Result
class CheckResult(Enum):
    ERROR = 0
    PASS = 1
    TIMEOUT = 2


async def check(
    condition: Routine.Condition,
    get_img: GetImageCallableType,
    ref_img: cv2.typing.MatLike | None = None,
    *,
    no_delay: bool = False,
) -> tuple[Event.Result, cv2.typing.MatLike | None]:
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
        timeout_info = f"{(timeout - now()) / 1000:.1f}s left"
        print("[?] check", ct, timeout_info, end="\r")
        ct += 1

        next = now() + condition.interval
        img = await get_img()

        if check_once(condition, img, ref_img):
            print("[== OK ==]", ct)
            return (Event.RESULT_PASS, img)

        # allow at least one check before timeout
        if now() > timeout or next > timeout:
            print(f"[X] check timeout after {timeout_duration / 1000:.1f}s")
            return (Event.RESULT_TIMEOUT, img)

        await sleep(next - now())


def check_once(
    condition: Routine.Condition,
    img: cv2.typing.MatLike,
    ref_img: cv2.typing.MatLike | None = None,
) -> bool:
    """
    Runs a check once, returns True if pass
    """

    match condition.WhichOneof("condition"):
        case None:
            return True
        case "image":
            assert ref_img is not None, "Reference image required for image"
            if check_image(condition.image, img, ref_img):
                return True
        case "text":
            raise NotImplementedError()
        case _:
            raise NotImplementedError()
    return False
