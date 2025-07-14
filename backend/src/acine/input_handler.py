"""
Implements interface for OS-level input events for specific windows.

This implementation is based on AHK (AutoHotKey) and
https://github.com/Dragonlinae/Autacha.

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

from ahk import AHK

AHK(version="v1")
ahk = AHK(version="v2")


class InputHandler:
    def __init__(self, title: str):
        self.title = title
        self.win = ahk.win_wait(title=title, timeout=30, detect_hidden_windows=True)
        print(self.win.title, self.win)
        print(self.win.get_position())

        self.is_mouse_down = False
        self.x = 0
        self.y = 0

    def mouse_move(self, x: int, y: int):
        self.x = x
        self.y = y
        # shadow offset in windows (... ? no longer seems to be a thing)
        # self.x += 8
        # self.y += 8

        # window title bar (required in AHK v2)
        self.y -= 36

        self.update_mouse()

    def mouse_down(self):
        self.is_mouse_down = True
        self.update_mouse()

    def mouse_up(self):
        self.is_mouse_down = False
        self.update_mouse()

    def update_mouse(self):
        flags = "D NA" if self.is_mouse_down else "U NA"
        self.win.click(x=self.x, y=self.y, button="L", options=flags)
        # print(self.x, self.y, flags)
