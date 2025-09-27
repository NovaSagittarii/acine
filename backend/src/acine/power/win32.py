"""
Power save utilities for Windows (uses win32api)

In Windows, you can achieve S3 standby in Control Panel "Power Options" and set
'turn off the display' / 'put the computer to sleep' options.

Doesn't seem to work if both are 1 min. During testing on local desktop,
the lowest that works is display=1min, sleep=2min.

If sleep doesn't seem to occur, you can check what might be preventing it with
```
powercfg /requests
```
"""

# mypy: ignore-errors

import asyncio
import datetime

import win32api  # pyright: ignore[reportMissingModuleSource]
import win32event  # pyright: ignore[reportMissingModuleSource]


def now_utc() -> float:
    UTC = datetime.timezone(datetime.timedelta(), "UTC")
    return datetime.datetime.now(tz=UTC).timestamp()


def unix_to_filetime(t: float) -> int:
    """
    Converts a UNIX timestamp to FILETIME timestamp.

    Windows uses FILETIME for its absolute timestamps... (man)

    FILETIME is 100ns intervals since Jan1601
    """
    return int(10000000 * (t + 11644473600))


async def sleep(t: float):
    """
    Sleeps for t seconds (time spent in S3/S4 does count).
    """
    return await sleep_until(now_utc() + t)


async def sleep_until(t: float):
    """
    Sleeps until current time >= t (as UNIX timestamp).
    """
    ct = now_utc()
    if ct >= t:
        return

    try:
        handle = win32event.CreateWaitableTimer(None, True, "acine Wakeup")
        win32event.SetWaitableTimer(handle, unix_to_filetime(t), 0, None, None, True)
        while now_utc() < t:
            # Note: asyncio.sleep is paused while computer is in S3/S4
            await asyncio.sleep(0.1)
        if win32event.WaitForSingleObject(handle, 10000):
            raise TimeoutError(
                "win32 Timer took more than 10 to trigger after expected time."
            )
    finally:
        win32event.CancelWaitableTimer(handle)
        win32api.CloseHandle(handle)
