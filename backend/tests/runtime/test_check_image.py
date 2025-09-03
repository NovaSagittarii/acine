"""
Test image recognition
"""

import os

import cv2
import numpy as np
import pytest
from acine_proto_dist.position_pb2 import Rect
from acine_proto_dist.routine_pb2 import Routine
from pytest import approx
from pytest_mock import MockerFixture

from acine.runtime.check_image import SimilarityResult, check_similarity

dirname = os.path.dirname(__file__)
triangle_img = cv2.imread(os.path.join(dirname, "triangle.png"))


@pytest.fixture
def condition1(mocker: MockerFixture) -> Routine.Condition.Image:
    """base condition (used for testing)"""
    condition = Routine.Condition.Image(
        threshold=0.999,
        padding=45,
        regions=[Rect(left=0, right=49, top=0, bottom=49)],
        allow_regions=[Rect(left=0, right=399, top=0, bottom=399)],
        match_limit=16,
    )
    return condition


class TestCheckSimilarity:
    def test_fixture(self, condition1: Routine.Condition.Image):
        """Just make sure condition1 initialized correctly."""
        assert condition1.threshold == 0.999
        assert condition1.padding == 45

    def test_compare_identity_exact(self, condition1: Routine.Condition.Image):
        """Ensure comparsion works on identical inputs. (exact)"""
        del condition1.allow_regions[:]
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert len(a) == 1
        assert SimilarityResult(approx(1.0), (0, 0)) in a

    def test_compare_identity_template(self, condition1: Routine.Condition.Image):
        """Ensure comparsion works on identical inputs. (templated)"""
        a = check_similarity(condition1, triangle_img, triangle_img)

        expected = [SimilarityResult(approx(1.0), (100 * i, 100 * i)) for i in range(4)]
        assert a == expected

    def test_compare_identity_restrict(self, condition1: Routine.Condition.Image):
        """Ensure comparsion works on identical inputs with allowed_regions."""
        del condition1.allow_regions[:]
        condition1.allow_regions.append(Rect(top=0, left=0, right=399, bottom=199))
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert len(a) == 2, "Expect 2 after cropping bottom half."
        assert SimilarityResult(approx(1.0), (0, 0)) in a
        assert SimilarityResult(approx(1.0), (100, 100)) in a

    def test_compare_identity_restrict2(self, condition1: Routine.Condition.Image):
        """Ensure comparsion works on identical inputs with allowed_regions."""
        del condition1.allow_regions[:]
        condition1.allow_regions.append(Rect(top=200, left=0, right=399, bottom=399))
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert len(a) == 2, "Expect 2 after cropping top half."
        assert SimilarityResult(approx(1.0), (200, 200)) in a
        assert SimilarityResult(approx(1.0), (300, 300)) in a

    def test_compare_identity_none(self, condition1: Routine.Condition.Image):
        """Shouldn't break when there are no regions, just empty output."""
        del condition1.regions[:]
        del condition1.allow_regions[:]
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert a == [], "No matches expected (nothing to match)"

    def test_compare_identity_none2(self, condition1: Routine.Condition.Image):
        """
        Shouldn't break when there are no regions,
        but allow_regions exists for some reason.
        """
        del condition1.regions[:]
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert a == [], "No matches expected (nothing to match)"

    def test_compare_identity_padding(self, condition1: Routine.Condition.Image):
        """`padding` should exclude some existing matches."""
        condition1.padding = 170
        a = check_similarity(condition1, triangle_img, triangle_img)

        assert len(a) == 2, "Expect top and bottom matches"
        assert SimilarityResult(approx(1.0), (0, 0)) in a
        assert SimilarityResult(approx(1.0), (300, 300)) in a

    def test_compare_identity_limit(self, condition1: Routine.Condition.Image):
        """`match_limit` should limit the amount of matches."""
        expected = [SimilarityResult(approx(1.0), (100 * i, 100 * i)) for i in range(4)]
        for limit in range(0, 4):
            condition1.match_limit = limit
            a = check_similarity(condition1, triangle_img, triangle_img)

            assert a == expected[:limit]

    @pytest.mark.skip(reason="not implemented, necessary? (what if make validator)")
    def test_outofbounds(self, condition1: Routine.Condition.Image):
        """shouldn't break if you go out of bounds (invalid regions) ?"""
        del condition1.allow_regions[:]
        condition1.allow_regions.append(Rect(left=-1, right=5, top=0, bottom=5))
        check_similarity(condition1, triangle_img, triangle_img)

    @pytest.mark.skip(reason="slow benchmark")
    @pytest.mark.parametrize("return_one", (False, True), ids=("", "Ret1"))
    @pytest.mark.parametrize("argpartition", (False, True), ids=("", "AP"))
    @pytest.mark.parametrize("has_match", (False, True), ids=("X", "O"))
    @pytest.mark.benchmark(group="check_similarity", warmup=True, max_time=1)
    def test_performance(self, benchmark, return_one, argpartition, has_match):
        N = 1000
        condition = Routine.Condition.Image(
            threshold=0.999,
            regions=[Rect(left=10, right=39, top=10, bottom=39)],
            allow_regions=[Rect(left=0, right=N - 1, top=0, bottom=N - 1)],
            match_limit=16,
        )

        ref = np.random.randint(0, 255, size=(N, N, 3), dtype=np.uint8)

        @benchmark
        def run():
            if has_match:
                a = np.copy(ref)
            else:
                a = np.random.randint(0, 25, size=(N, N, 3), dtype=np.uint8)
            check_similarity(
                condition, a, ref, return_one=return_one, argpartition=argpartition
            )
            # jans = check_similarity(condition, a, ref)
            # assert ans == jans
