"""
Implements interface for OS-level input events for specific windows.

This implementation is based on AHK (AutoHotKey) and
https://github.com/Dragonlinae/Autacha.

https://github.com/Dragonlinae/Autacha/blob/main/helpers/game_capture.py

## Note about why AHK __init__ gets called twice... (yeah it's weird)

So, calling AHK with a *different* version results in good side effects??

Otherwise, AHK mouse events (keyboard untested) until after a real event
(from mouse hardware) is sent. Specifically, input passthrough works fine
on the Web UI, but playing a replay before the initial mousepress (done by
the hardware mouse) doesn't work on the Web UI.

Let's define these events that occur before a real input as "early AHK events".

Neither did AHK python library work properly when running from Python.
I did not try to sync running the program with a mouseclick to test the
hardware activation hypothesis.

The behavior observed was "early AHK events" would get dropped unless
the version of AHK was different at initialization. When I was testing
different versions, only the FIRST program run of each code revision (as in
changing the version) had "early AHK events" work properly, subsequent runs
to reproduce the success would fail.

Also, switched to v2 since v1 seems to break (mouse events no longer work)
after some time (not sure how long) after opening a maximized window such
as Chrome browser. v2 does not have the same issues.

## Window title bar jank (a result of v2)

Anyways, AHK window (0,0) does not include the window title bar. You can either
crop out all window bars to make AHK work properly, or make AHK account for the
window bar. I'm choosing the latter option since I have some 50 screenshots
that I do not want to retake. (either should be fine in practice)

With further testing, turns out this is a result of changing to v2.
> Initially, actions were recorded in v1 and replayed fine.
> Some actions broke after switching to v2, in fact, all mouse inputs were
> offset by exactly 36 pixels (the height of the window title bar)
"""

import ctypes
from os import system
from typing import Optional

import win32gui
from ahk import AsyncAHK

ahk = AsyncAHK(version="v2")

win32user = ctypes.windll.user32
win32user.SetProcessDPIAware()
# GetClientRect will give values with Scaling applied (can be used to do offset)


def get_title_bar_height(win_title: str) -> int:
    """
    Source:
    https://github.com/NiiightmareXD/windows-capture/issues/72#issuecomment-2278956444
    """
    hwnd = win32gui.FindWindow(None, win_title)
    _, _, cx2, cy2 = win32gui.GetClientRect(hwnd)
    wx1, wy1, wx2, wy2 = win32gui.GetWindowRect(hwnd)
    wx1, wx2 = wx1 - wx1, wx2 - wx1
    wy1, wy2 = wy1 - wy1, wy2 - wy1
    bw = (wx2 - cx2) // 2  # shadow (one sided)
    return wy2 - cy2 - bw


class InputHandler:
    def __init__(self, title: Optional[str], cmd: str = ""):
        self._title = title
        self._cmd = cmd

        self.can_close = False
        self.y_offset = 0
        self._init_completed = False

        self.is_mouse_down = False
        self.x = 0
        self.y = 0
        print(f"y-offset(titlebar)={self.y_offset}")

    async def init(self):
        if self._init_completed:
            return
        self._init_completed = True
        title = self._title
        cmd = self._cmd

        if title:
            if cmd and not await ahk.list_windows(title=title):
                system(cmd)
            self.title = title
            self.win = await ahk.win_wait(
                title, timeout=600, detect_hidden_windows=True
            )
            await self.win.minimize()
            await self.win.restore()
            await self.win.activate()  # min/res/act used to ensure mouse works
            await self.win.to_bottom()  # not necessary
            print(await self.win.title, self.win)
            print(await self.win.get_position())
            self.can_close = True
            self.y_offset = get_title_bar_height(await self.win.get_title())
        else:
            # target desktop
            raise NotImplementedError("Targeting desktop is not implemented.")
            # self.title = None
            # self.win = ahk # ahk is not compatible with self.

    async def mouse_move(self, x: int, y: int) -> None:
        self.x = x
        self.y = y
        # shadow offset in windows (... ? no longer seems to be a thing)
        # self.x += 8
        # self.y += 8

        # window title bar (required in AHK v2)
        self.y -= self.y_offset

        await self.update_mouse()

    async def mouse_down(self) -> None:
        self.is_mouse_down = True
        await self.update_mouse()

    async def mouse_up(self) -> None:
        self.is_mouse_down = False
        await self.update_mouse()

    async def update_mouse(self) -> None:
        await self.init()
        flags = "D NA" if self.is_mouse_down else "U NA"
        await self.win.click(x=self.x, y=self.y, button="L", options=flags)
        # print(self.x, self.y, flags)

    async def close(self) -> None:
        await self.init()
        if self.can_close:
            await self.win.close()


if __name__ == "__main__":
    s = "TestEnv"
    print(f"looking for {s}")
    ih = InputHandler(s)
    print("found")
