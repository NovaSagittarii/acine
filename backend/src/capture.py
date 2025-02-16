from asyncio import Lock, Semaphore
import cv2
from windows_capture import WindowsCapture, Frame, InternalCaptureControl


class GameCapture:  # thanks joshua
    def __init__(self, window_name: str | None = None):
        self.framedata_png = None
        self.window_name = window_name

    capture_callback_flag = Semaphore(0)

    def start(self) -> None:
        """
        Starts capturing
        """
        print(f"starting capture on {self.window_name}")
        self.capture = WindowsCapture(
            cursor_capture=False,
            draw_border=False,
            monitor_index=None,
            window_name=self.window_name,
        )

        first_frame = True

        @self.capture.event
        def on_frame_arrived(
            frame: Frame, capture_control: InternalCaptureControl
        ):
            nonlocal first_frame
            if first_frame:
                first_frame = False
            else:
                return

            print("New Frame Arrived")
            # frame.save_as_image("./yooo.png")

            _, framedata_png = cv2.imencode(".png", frame.frame_buffer)
            self.framedata_png = framedata_png

            capture_control.stop()
            GameCapture.capture_callback_flag.release()

        @self.capture.event
        def on_closed():
            print("closed")
            pass

        self.capture.start()

    get_png_frame_lock = Lock()

    async def get_png_frame(self) -> None:
        """
        Gets a png encoded frame
        """
        async with GameCapture.get_png_frame_lock:
            self.start()
            await GameCapture.capture_callback_flag.acquire()
        return self.framedata_png


if __name__ == "__main__":
    import asyncio

    async def run():
        g = GameCapture("Arknights")
        f = await g.get_png_frame()
        print("frame", f)

    asyncio.run(run())
