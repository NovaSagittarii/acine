"""
TODO: this unifies capture.py and input_handler.py
TODO: include fullscreen/general screen controls for non-emulator support
"""

import ctypes

# from typing import Optional
# import win32gui
from ahk import AHK

AHK(version="v1")
ahk = AHK(version="v2")

win32user = ctypes.windll.user32
win32user.SetProcessDPIAware()


class WindowInterface:
    """
    Communicates with a specific window.

    TODO: read/mouse_move/mouse_updown/key_updown
    NOTE: if general-form, action should bring window to front momentarily

    maybe support this form?
    ```
    with WindowInterface(...) as win:
        # pass win around
    ```
    """

    def __init__(self, window):
        pass

    def get_position():
        pass
