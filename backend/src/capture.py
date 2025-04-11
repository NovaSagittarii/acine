from asyncio import Lock, Semaphore

import cv2
from numpy import ndarray
from windows_capture import Frame, InternalCaptureControl, WindowsCapture


class GameCapture:  # thanks joshua
    def __init__(self, window_name: str | None = None):
        self.data: cv2.typing.MatLike = None
        """cv2.MatLike frame data"""

        self.window_name = window_name
        self.init()
        self.want_frame = True
        self.get_png_frame_lock = Lock()
        self.capture_callback_semaphore = Semaphore(0)
        self.dimensions: "tuple[int, int]" = (0, 0)
        """ screen dimensions """

    def init(self) -> None:
        """set up WindowsCapture event listeners"""
        self.capture = WindowsCapture(
            cursor_capture=False,
            draw_border=False,
            monitor_index=None,
            window_name=self.window_name,
        )

        @self.capture.event
        def on_frame_arrived(frame: Frame, _: InternalCaptureControl):
            # Note: when minimized, this does not run
            if not self.want_frame:
                return  # discard frame
            self.want_frame = False

            # print("got frame")
            # frame.save_as_image("./yooo.png")
            self.data = frame.frame_buffer.copy()
            self.dimensions = (frame.width, frame.height)
            self.capture_callback_semaphore.release()

        # called when the window closes
        @self.capture.event
        def on_closed():
            print("Capture Session Closed")

        self.capture.start_free_threaded()

    async def __next_frame(self):
        """requests a frame until it gets the next frame"""
        async with self.get_png_frame_lock:
            self.want_frame = True
            await self.capture_callback_semaphore.acquire()

    async def get_frame(self) -> cv2.typing.MatLike:
        """gets a MatLike frame for cv2"""
        await self.__next_frame()
        return self.data

    async def get_png_frame(self) -> ndarray:
        """gets a png encoded frame"""
        await self.__next_frame()
        _, framedata_png = cv2.imencode(".png", self.data)
        return framedata_png


if __name__ == "__main__":
    import asyncio

    async def run():
        g = GameCapture("Arknights")
        f = await g.get_png_frame()
        print("frame", f)

    asyncio.run(run())
