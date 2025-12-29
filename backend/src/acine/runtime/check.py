"""
functions for checking conditions
"""

from typing import Awaitable, Callable, Optional, Tuple, TypeAlias

from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import Action

from acine.runtime.check_image import ImageBmpType, check_image
from acine.runtime.util import now, sleep

GetImageCallableType: TypeAlias = Callable[[], Awaitable[ImageBmpType]]
ActionResult: TypeAlias = Action.Result


async def check(
    condition: Routine.Condition,
    get_img: GetImageCallableType,
    ref_img: Optional[ImageBmpType] = None,
    *,
    no_delay: bool = False,
) -> Tuple[ActionResult.ValueType, ImageBmpType]:
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
        # timeout_info = f"{(timeout - now()) / 1000:.1f}s left"
        # print("[?] check", ct, timeout_info, end="\r")
        ct += 1

        next = now() + condition.interval
        img = await get_img()

        if check_once(condition, img, ref_img):
            print("[== OK ==]", ct)
            return (ActionResult.RESULT_PASS, img)

        # allow at least one check before timeout
        if now() > timeout or next > timeout:
            print(f"[X] check timeout after {timeout_duration / 1000:.1f}s")
            return (ActionResult.RESULT_TIMEOUT, img)

        await sleep(next - now())


def check_once(
    condition: Routine.Condition,
    img: Optional[ImageBmpType] = None,
    ref_img: Optional[ImageBmpType] = None,
) -> bool:
    """
    Runs a check once, returns True if pass
    """

    match condition.WhichOneof("condition"):
        case None:
            return True
        case "image":
            assert img is not None, "Input image required for image condition"
            assert ref_img is not None, "Reference image required for image condition"
            if check_image(condition.image, img, ref_img):
                return True
        case "text":
            raise NotImplementedError()
        case _:
            raise NotImplementedError()
    return False
