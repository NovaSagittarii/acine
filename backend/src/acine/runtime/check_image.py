"""
Implements image similarity checks
"""

import cv2
import numpy as np
from acine_proto_dist.routine_pb2 import Routine
from skimage.metrics import structural_similarity

from ..persist import resolve


class SimilarityResult:
    score: float
    position: tuple[int, int]

    def __init__(self, score, position):
        self.score = score
        self.position = position

    def __repr__(self):
        i, j = self.position
        if isinstance(self.score, float):
            return f"{self.score:.3f} @ ({i}, {j})"
        else:
            # might be given pytest.approx element
            return f"{self.score} @ ({i}, {j})"

    def __eq__(self, value):
        return self.score == value.score and self.position == value.position


def check_similarity(
    condition: Routine.Condition.Image,
    ref_img: cv2.typing.MatLike,
    img: cv2.typing.MatLike,
) -> list[SimilarityResult]:
    """
    Finds areas of sufficiently similar areas using cv2.matchTemplate.
    TODO: optimizations for single-region conditions

    TODO: configurable pattern
    TM_CCOEFF is really bad on small gray squares for some reason
    TM_CCORR is less broken
    """
    if not condition.regions or condition.match_limit <= 0:
        return []
    if not condition.allow_regions:
        condition.allow_regions.extend(condition.regions)
    allowed = np.random.randint(0, 255, size=img.shape, dtype=img.dtype)
    for region in condition.allow_regions:
        x0, x1, y0, y1 = region.left, region.right + 1, region.top, region.bottom + 1
        allowed[y0:y1, x0:x1] = img[y0:y1, x0:x1]
    img = allowed

    mask = np.zeros(ref_img.shape, dtype=ref_img.dtype)
    xlo, xhi, ylo, yhi = mask.shape[1], 0, mask.shape[0], 0
    for region in condition.regions:
        x0, x1, y0, y1 = region.left, region.right + 1, region.top, region.bottom + 1
        mask[y0:y1, x0:x1, :] = 255
        xlo, xhi = min(xlo, x0), max(xhi, x1)
        ylo, yhi = min(ylo, y0), max(yhi, y1)
    ref_img = ref_img[ylo:yhi, xlo:xhi]
    mask = mask[ylo:yhi, xlo:xhi]

    res = cv2.matchTemplate(img, ref_img, cv2.TM_CCORR_NORMED, mask=mask)
    res[np.isnan(res)] = 0
    res[np.isinf(res)] = 0
    # nan/inf bugged for matchTemplate + mask
    # see https://github.com/opencv/opencv/issues/23257

    result = []

    pts = sorted(np.ndenumerate(res), key=lambda x: x[1], reverse=True)
    vis = np.zeros(img.shape[:-1])
    n, m = res.shape
    tn, tm = yhi - ylo, xhi - xlo
    pn, pm = max(0, tn + condition.padding), max(0, tm + condition.padding)
    for coord, score in pts:
        if score < condition.threshold:
            break

        i, j = coord
        if vis[i][j]:
            continue

        li, ri = max(0, i - pn), min(n, i + pn)
        lj, rj = max(0, j - pm), min(m, j + pm)
        vis[li : ri + 1, lj : rj + 1] = 1
        result.append(SimilarityResult(score, (i, j)))

        if len(result) >= condition.match_limit:
            break

    return result


def check_image(
    condition: Routine.Condition.Image,
    img: cv2.typing.MatLike,
) -> bool:
    """
    checks condition "image" type

    returns `True` if passes
    """
    path = resolve("img", f"{condition.frame_id}.png")  # RGB
    ref_img = cv2.imread(path)

    scores: list[tuple[float, int]] = []
    """[score, area], need to be converted to weighted score"""
    for region in condition.regions:
        x0, x1, y0, y1 = region.left, region.right, region.top, region.bottom
        # print(len(img), len(img[0]), len(img[0][0]))
        # print(len(ref_img), len(ref_img[0]), len(ref_img[0][0]))
        # RGBA ???
        observe = img[y0:y1, x0:x1, :3]  # discard alpha channel
        expect = ref_img[y0:y1, x0:x1, :3]
        score = structural_similarity(observe, expect, channel_axis=2)
        # cv2.imwrite(resolve("res", "got.png"), observe)
        # cv2.imwrite(resolve("res", "want.png"), expect)
        scores.append((score, (y1 - y0) * (x1 - x0)))

    tot = sum(w for _, w in scores)
    wscore = sum(x * w for x, w in scores) / tot
    # print("sim=", wscore)

    return wscore > 0.7
