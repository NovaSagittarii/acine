# mypy: ignore-errors

"""
Classifier code for the saved frames, used to determine which state you are in.

Motivation
---

Mainly for reliability, convenience, and compute-efficiency.

Typically, macros are linear. To decide when you start the next step, you'd
need to wait for some time for the action to complete. Sometimes, you don't
know how long it will take, you must consider the worst-case otherwise the
macro breaks. This isn't time-efficient.

You look at the window to make the macro's correctness independent of time.
There are pixel color, pixel area checks, and find image on screen,
which need to be tuned to not give false positives or negatives.
I've seen it done as something you set up as you create the macro, and then
hope it was tuned correctly.

Taking several samples of a state and then overlaying them is helpful for
knowing what variations of the state look like.

Decision trees should help automate the process in making a compute-efficient
(logarithmic depth) and reliable (given proper data) classifier for which
state you are in. It should also help with detecting failed transitions,
such as in the case of dropped inputs, which enables action restarts.

Conclusion
---

After a bit of testing, seems to work well?
- Requires a few extra samples so you don't have samples that exist only
  in validation.
- Needs to downscale a lot for a reasonable train time.
- Capture itself seems to be a bottleneck.
- Currently, code only looks at argmax so doesn't really do out-of-data frames.
Decision tree could be used to decide which pixels to read, but this would
be difficult to implement (?). If it is pixel-based, then downscaling doesn't
make sense since it involves a full capture.
"""

import os

import cv2
import numpy as np
import ydf  # type: ignore
from acine.persist import fs_read_sync as fs_read
from acine_proto_dist.frame_pb2 import Frame
from acine_proto_dist.routine_pb2 import Routine
from numpy import ndarray

DIMENSIONS = (10, 10)
rt = Routine.FromString(fs_read(["rt.pb"]))

lookup = {}
for i, s in enumerate(rt.states):
    for x in s.samples:
        lookup[rt.frames[x].id] = i


def fetch(f: Frame):
    b = fs_read(["img", f"{f.id}.png"])
    nparr = np.frombuffer(b, np.uint8)
    X = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    X = cv2.resize(X, DIMENSIONS)
    Y = lookup.get(f.id, None)
    # X.shape is (width, height, 3) ; 3 for RGB
    X = X.flatten()
    return (X, Y)


fetched = tuple(map(fetch, rt.frames))
# print("samples", len(lookup))
# print("size of first element", len(fetched[0][0]))

pngs = [x for x, y in fetched if y is not None]
labels = [y for _, y in fetched if y is not None]
dataset: dict[str, ndarray] = {
    "png": np.stack(pngs),
    "state": np.array(labels),
}

if not os.path.exists("model.ydf"):
    model = ydf.GradientBoostedTreesLearner(
        label="state",
        # max_vocab_count=100,
        num_threads=12,
        # validation_ratio=0.0,
    ).train(dataset)
    model.save("model.ydf")
else:
    model = ydf.load_model("model.ydf")


def predict(data: np.ndarray) -> str:
    """
    Make a prediction about what state you're in.
    Used in server for testing the model.
    """
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)  # 25% time spent decode
    X = cv2.resize(img, DIMENSIONS)
    X = X.flatten()
    X = {"png": np.stack([X])}
    pred = model.predict(X)[0]  # 75% time spent predict (why so slow??)
    y = np.argmax(pred)
    return rt.states[y].name


if __name__ == "__main__":
    for f in rt.frames:
        X, Y = fetch(f)
        if Y is None:
            continue
        X = {"png": np.stack([X])}
        y = np.argmax(model.predict(X)[0])
        if y != Y:
            print(y, Y, end=" ")
            print([rt.states[i].name for i in (y, Y)])

    print(model.benchmark(dataset))
