from ahk import AHK

ahk = AHK()


class InputHandler:
    def __init__(self, title: str):
        self.title = title
        self.win = ahk.win_wait(
            title=title, timeout=30, detect_hidden_windows=True
        )
        print(self.win.title, self.win)
        print(self.win.get_position())

        self.is_mouse_down = False
        self.x = 0
        self.y = 0

    def mouse_move(self, x: int, y: int):
        # shadow offset in windows
        self.x = x + 8
        self.y = y + 8
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
