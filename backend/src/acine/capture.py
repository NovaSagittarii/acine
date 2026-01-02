"""
Window capture module

NOTE: Capture does not capture (seems to fail) when the window is visible,
but partially offscreen.
"""

from asyncio import Lock, Semaphore, sleep
from typing import Optional

import cv2
from numpy import ndarray, uint8
from windows_capture import (  # type: ignore
    Frame,
    InternalCaptureControl,
    WindowsCapture,
)

from acine.input_handler import get_title_bar_height
from acine.runtime.check_image import ImageBmpType


class GameCapture:  # thanks joshua
    """
    Window capture instance, need to call .close() afterwards.
    """

    def __init__(self, window_name: Optional[str] = None):
        self.data: ImageBmpType = ndarray((1, 1, 3), dtype=uint8)
        """cv2.MatLike frame data"""

        self.window_name = window_name or None  # prefer None over empty string ""
        self.init()
        self.title_bar_height = get_title_bar_height(window_name) if window_name else 0
        self.get_png_frame_lock = Lock()
        self.capture_callback_semaphore = Semaphore(0)
        self.dimensions: "tuple[int, int]" = (0, 0)
        """ screen dimensions """

        self.closed = False

    def close(self) -> None:
        """cleanup instance"""
        self.closed = True

    def init(self) -> None:
        """set up WindowsCapture event listeners"""
        self.capture = WindowsCapture(
            cursor_capture=False,
            draw_border=False,
            monitor_index=None,
            window_name=self.window_name,
            # if window_name=="", capture active window
            # if window_name==None, capture current screen
        )
        print("Capture Session Opened", self.window_name)

        @self.capture.event
        def on_frame_arrived(frame: Frame, control: InternalCaptureControl) -> None:
            # Note: when minimized, this callback does not run

            if self.closed:
                # This won't appear until the window is unminimized.
                print("Capture Session Closed (via control)")
                control.stop()

            if self.get_png_frame_lock.locked():
                return
            """
            Checking if the lock is locked directly to decide whether
            to do the copy or not.

            Previously, when testing subroutines, this would hang on line
            ```py
            await self.capture_callback_semaphore.acquire()
            ```
            since somehow `want_frame` didn't work properly...

            This might be related to how windows_capture is running on a
            dedicated thread (allowing multicore race conditions).
            """

            # print("got frame")
            # frame.save_as_image("./yooo.png")
            self.data = frame.frame_buffer.copy()[self.title_bar_height :, :, :3]
            # discard title bar
            #   to normalize screenshots, bar height is dependent on Resolution Scaling
            #   it doesn't seem you're able to click on the title bar anyways (?)
            # discard alpha

            self.dimensions = (frame.width, frame.height)
            self.capture_callback_semaphore.release()

        # called when the window closes
        @self.capture.event
        def on_closed() -> None:
            print("Capture Session Closed")

        self.capture.start_free_threaded()

    async def __next_frame(self) -> None:
        """waits it gets the next frame"""
        while self.data is None:
            await sleep(0.1)

        # how to handle bursty frames??
        # sometimes it stops captures (no draw update),
        # this might cause a backlog
        return
        async with self.get_png_frame_lock:
            await self.capture_callback_semaphore.acquire()

    async def get_frame(self) -> ImageBmpType:
        """gets a MatLike frame for cv2"""
        await self.__next_frame()
        return self.data

    async def get_png_frame(self) -> tuple[ndarray, int, int]:
        """gets a png encoded frame (data, width, height)"""
        await self.__next_frame()
        _, framedata_png = cv2.imencode(".png", self.data)
        return (framedata_png, *self.dimensions)


if __name__ == "__main__":
    import asyncio

    async def run() -> None:
        g = GameCapture("Arknights")
        f, *dimensions = await g.get_png_frame()
        print("frame", f, dimensions)
        # from acine.persist import fs_write_sync as write
        # write(["T.png"], f)
        g.close()

    asyncio.run(run())
