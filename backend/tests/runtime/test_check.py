import pytest
from acine.runtime.check import Routine, check_once
from acine_proto_dist.position_pb2 import Rect
from numpy import random
from pytest_mock import MockerFixture


class TestCheck:
    def test_check_once_null_condition(self):
        """
        Ensure null condition passes through properly.
        """
        c = Routine.Condition()
        assert c.WhichOneof("condition") is None
        assert check_once(c, None) is True

    @pytest.mark.parametrize("ret", (True, False))
    def test_check_once_image(self, mocker: MockerFixture, ret: bool):
        """
        Ensure check_once calls check_image for image conditions.
        """
        c = Routine.Condition(
            image=Routine.Condition.Image(
                frame_id="FRAME_ID", threshold=0.5, regions=[Rect()]
            )
        )
        img = random.rand(2, 3, 4)

        p = mocker.patch("acine.runtime.check.check_image")
        p.return_value = ret
        assert check_once(c, img) == ret
        p.assert_called_once_with(c.image, img)
