import cv2
from acine_proto_dist.routine_pb2 import Routine
from persist import resolve
from skimage.metrics import structural_similarity


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
