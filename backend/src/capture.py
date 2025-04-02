from asyncio import Lock, Semaphore

import cv2
from numpy import ndarray
from windows_capture import Frame, InternalCaptureControl, WindowsCapture


class GameCapture:  # thanks joshua
    def __init__(self, window_name: str | None = None):
        self.framedata_png = None
        self.window_name = window_name
        self.init()
        self.want_frame = True
        self.get_png_frame_lock = Lock()
        self.capture_callback_semaphore = Semaphore(0)
        self.dimensions: "tuple[int, int]" = (0, 0)

    def init(self) -> None:
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

            _, framedata_png = cv2.imencode(".png", frame.frame_buffer)
            self.framedata_png = framedata_png
            self.dimensions = (frame.width, frame.height)
            self.capture_callback_semaphore.release()

        # called when the window closes
        @self.capture.event
        def on_closed():
            print("Capture Session Closed")

        self.capture.start_free_threaded()

    async def get_png_frame(self) -> ndarray:
        """
        Gets a png encoded frame
        """
        async with self.get_png_frame_lock:
            self.want_frame = True
            await self.capture_callback_semaphore.acquire()
        return self.framedata_png


if __name__ == "__main__":
    import asyncio

    async def run():
        g = GameCapture("Arknights")
        f = await g.get_png_frame()
        print("frame", f)

    asyncio.run(run())
