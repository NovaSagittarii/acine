import tkinter
from tkinter import ttk

root = tkinter.Tk()
root.title("TestEnv")
w = int(1315 / 1.25)
h = int((776 - 36) / 1.25)
w //= 2
h //= 2
root.wm_maxsize(w, h)
root.geometry(f"{w}x{h}")

f = None


def redraw():
    global f
    if f:
        f.destroy()
    f = ttk.Frame(root)
    f.grid()
    ttk.Label(f, text="Hello World!").grid(column=0, row=0)
    ttk.Button(f, text="RESET", command=redraw).grid(column=1, row=0)

    a = ttk.Label(f, text="ASDF", background="yellow")
    a.grid(column=3, row=0)

    def btn():
        a.destroy()

    ttk.Button(f, text="Del", command=btn).grid(column=4, row=0)

    # canvas https://stackoverflow.com/a/70403541
    line_id = None
    line_points = []
    line_options = {}

    def draw_line(event):
        nonlocal line_id
        line_points.extend((event.x, event.y))
        if line_id is not None:
            canvas.delete(line_id)
        if len(line_points) >= 4:
            line_id = canvas.create_line(line_points, **line_options)

    def set_start(event):
        canvas.create_oval(event.x - 5, event.y - 5, event.x + 5, event.y + 5)
        line_points.extend((event.x, event.y))

    def end_line(event=None):
        nonlocal line_id
        line_points.clear()
        line_id = None
        canvas.create_oval(event.x - 2, event.y - 2, event.x + 2, event.y + 2)

    canvas = tkinter.Canvas(f, background="white")
    canvas.grid(columnspan=5)
    canvas.create_rectangle(0, 0, 1000, 1000)

    canvas.bind("<Button-1>", set_start)
    canvas.bind("<B1-Motion>", draw_line)
    canvas.bind("<ButtonRelease-1>", end_line)

    f2 = ttk.Frame(f)
    f2.grid(column=6, row=0, rowspan=3)
    ttk.Checkbutton(f2, text="Checkbutton").grid()
    ttk.Label(f2, text="Label").grid()
    ttk.Menubutton(f2, text="HELLO")

    nb = ttk.Notebook(f2)
    X = tkinter.IntVar()
    Y = tkinter.IntVar()
    nb.add(ttk.Spinbox(from_=0, to=3, textvariable=X), text="Spinbox")
    nb.add(ttk.LabeledScale(from_=0, to=3, variable=Y), text="LabeledScale")
    nb.grid()

    ttk.Progressbar(f2, variable=X, maximum=3).grid()
    ttk.Progressbar(f2, variable=Y, maximum=3).grid()


redraw()
root.mainloop()
