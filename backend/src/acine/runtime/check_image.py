"""
Implements image similarity checks
"""

import cv2
import numpy as np
from acine.runtime.util import get_frame
from acine_proto_dist.routine_pb2 import Routine


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

    TM_CCOEFF is really bad on small gray squares for some reason
    TM_CCORR is less broken
    """
    if not condition.regions or condition.match_limit <= 0:
        return []
    if not condition.allow_regions:
        condition.allow_regions.extend(condition.regions)
    if not condition.method:
        condition.method = Routine.Condition.Image.Method.METHOD_TM_CCORR_NORMED

    rxlo, rxhi, rylo, ryhi = img.shape[1], 0, img.shape[0], 0
    allowed = np.random.randint(0, 255, size=img.shape, dtype=img.dtype)
    for region in condition.allow_regions:
        x0, x1, y0, y1 = region.left, region.right + 1, region.top, region.bottom + 1
        allowed[y0:y1, x0:x1] = img[y0:y1, x0:x1]
        rxlo, rxhi = min(rxlo, x0), max(rxhi, x1)
        rylo, ryhi = min(rylo, y0), max(ryhi, y1)
    img = allowed
    img = img[rylo:ryhi, rxlo:rxhi]

    mask = np.zeros(ref_img.shape, dtype=ref_img.dtype)
    xlo, xhi, ylo, yhi = mask.shape[1], 0, mask.shape[0], 0
    for region in condition.regions:
        x0, x1, y0, y1 = region.left, region.right + 1, region.top, region.bottom + 1
        mask[y0:y1, x0:x1, :] = 255
        xlo, xhi = min(xlo, x0), max(xhi, x1)
        ylo, yhi = min(ylo, y0), max(yhi, y1)
    ref_img = ref_img[ylo:yhi, xlo:xhi]
    mask = mask[ylo:yhi, xlo:xhi]

    # not sure if mask affects quality?
    # mask_kwarg = {"mask": mask} if len(condition.regions) >= 2 else {}

    match condition.method:
        case Routine.Condition.Image.Method.METHOD_TM_CCORR_NORMED:
            res = cv2.matchTemplate(img, ref_img, cv2.TM_CCORR_NORMED, mask=mask)
        case Routine.Condition.Image.Method.METHOD_TM_CCOEFF_NORMED:
            # CCOEFF_NORMED mask does not seem to work?
            res = cv2.matchTemplate(img, ref_img, cv2.TM_CCOEFF_NORMED)
        case Routine.Condition.Image.Method.METHOD_TM_SQDIFF_NORMED:
            res = cv2.matchTemplate(img, ref_img, cv2.TM_SQDIFF_NORMED, mask=mask)
            res = np.e**-res
        case _:
            raise NotImplementedError(f"No impl for method={condition.method}")
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
        result.append(SimilarityResult(score, (i + rylo, j + rxlo)))

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
    ref_img = get_frame(condition.frame_id)
    return len(check_similarity(condition, ref_img, img)) > 0
