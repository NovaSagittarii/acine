import math
from datetime import datetime, timedelta
from random import randint, random, seed, shuffle

import pytest
from acine.scheduler.cron import TZ, next
from acine_proto_dist.routine_pb2 import Routine

SG = Routine.SchedulingGroup


class TestNext:
    def test_invalid_period(self):
        with pytest.raises(ValueError):
            # period = 0
            # period_preset = unset
            next(0, SG())

    @pytest.mark.parametrize("t", ([-1], [1], [999], [0, 0]))
    def test_invalid_offset(self, t: list[int]):
        with pytest.raises(ValueError):
            next(0, SG(period=1, dispatch_times=t))

    def test_invalid_offset_preset(self):
        with pytest.raises(ValueError):
            next(0, SG(period_preset=SG.PERIOD_DAILY, dispatch_times=[86400]))
        with pytest.raises(ValueError):
            next(0, SG(period_preset=SG.PERIOD_BIWEEKLY, dispatch_times=[-1]))
        with pytest.raises(ValueError):
            next(0, SG(period_preset=SG.PERIOD_BIWEEKLY, dispatch_times=[0, 0]))

    @pytest.mark.parametrize(
        "max",
        (pytest.param((10, 10), id="small"), pytest.param((1000, 10000), id="medium")),
    )
    @pytest.mark.parametrize(
        "has_millis",
        (
            pytest.param(False, id="without offset"),
            pytest.param(True, id="with offset"),
        ),
    )
    def test_period_offset0(self, max: tuple[int, int], has_millis: bool):
        maxT, maxt = max
        seed(0)
        for id in range(1, 101):
            T = randint(1, maxT)
            t = randint(1, maxt) + (random() if has_millis else 0.0)
            expect = math.floor(1 + t / T) * T
            result = next(t, SG(period=T))
            assert (
                expect == result
            ), f"Test {id}: t={t}, T={T}; expect={expect}, got={result}"

    @pytest.mark.parametrize(
        "max", (3, 10, 10**3, 10**6), ids=("tiny", "small", "medium", "large")
    )
    def test_period_offsets(self, max: int):
        seed(0)
        for id in range(1, 101):
            T = randint(1, max)
            t = randint(1, 10**9)
            k = randint(1, 25)
            offsets = sorted(list(set([randint(0, T - 1) for _ in range(k)])))
            k = len(offsets)

            i = randint(0, k - 1)
            pt = (t // T) * T  # period aligned timestamp

            dt0 = offsets[i]
            dt1 = offsets[i + 1] if i + 1 < k else T + offsets[0]
            t = pt + dt0 + (dt1 - dt0) * random()

            shuffle(offsets)
            expect = pt + dt1
            result = next(t, SG(period=T, dispatch_times=offsets))
            assert (
                expect == result
            ), f"Test {id}: t={t}, T={T}, dt={offsets}; expect={expect}, got={result}"

    @pytest.mark.parametrize(
        "period,offsets,curr,expected",
        (
            pytest.param(
                SG.PERIOD_DAILY,
                [],
                datetime(2000, 4, 20, tzinfo=TZ),
                datetime(2000, 4, 21, tzinfo=TZ),
                id="daily next-day",
            ),
            pytest.param(
                SG.PERIOD_DAILY,
                [],
                datetime(2000, 1, 3, 14, tzinfo=TZ),
                datetime(2000, 1, 4, tzinfo=TZ),
                id="daily",
            ),
            pytest.param(
                SG.PERIOD_DAILY,
                [int(timedelta(hours=2).total_seconds())],
                datetime(2000, 1, 3, 14, tzinfo=TZ),
                datetime(2000, 1, 4, 2, tzinfo=TZ),
                id="daily +offset",
            ),
            pytest.param(
                SG.PERIOD_WEEKLY,
                [],
                datetime(2025, 8, 10, tzinfo=TZ),  # Sunday
                datetime(2025, 8, 17, tzinfo=TZ),  # next Sunday
                id="weekly next-week",
            ),
            pytest.param(
                SG.PERIOD_WEEKLY,
                [],
                datetime(2025, 8, 22, tzinfo=TZ),  # Friday
                datetime(2025, 8, 24, tzinfo=TZ),  # Sunday
                id="weekly",
            ),
            pytest.param(
                SG.PERIOD_WEEKLY,
                [int(timedelta(hours=2).total_seconds())],
                datetime(2025, 8, 22, tzinfo=TZ),  # Friday
                datetime(2025, 8, 24, 2, tzinfo=TZ),  # Sunday 2AM
                id="weekly +offset",
            ),
            pytest.param(
                SG.PERIOD_WEEKLY,
                [int(timedelta(days=1, hours=2).total_seconds())],
                datetime(2025, 8, 18, 1, tzinfo=TZ),  # Monday 1AM
                datetime(2025, 8, 18, 2, tzinfo=TZ),  # Monday 2AM
                id="weekly +offset same-week",
            ),
            pytest.param(
                SG.PERIOD_WEEKLY,
                [],
                datetime(2025, 8, 18, tzinfo=TZ),  # Monday
                datetime(2025, 8, 24, tzinfo=TZ),  # Sunday
                id="weekly2",
            ),
            pytest.param(
                SG.PERIOD_BIWEEKLY,
                [],
                datetime(2025, 8, 1, tzinfo=TZ),  # Monday
                datetime(2025, 8, 3, tzinfo=TZ),  # 1st Sunday
                id="biweekly 1st-sunday",
            ),
            pytest.param(
                SG.PERIOD_BIWEEKLY,
                [],
                datetime(2025, 8, 5, tzinfo=TZ),  # Monday
                datetime(2025, 8, 17, tzinfo=TZ),  # 3rd Sunday
                id="biweekly 3rd-sunday",
            ),
            pytest.param(
                SG.PERIOD_BIWEEKLY,
                [int(timedelta(days=1, hours=2).total_seconds())],
                datetime(2025, 8, 10, tzinfo=TZ),  # some date after 1st Sunday
                datetime(2025, 8, 18, 2, tzinfo=TZ),  # Monday after 3rd Sunday 2AM
                id="biweekly 3rd-sunday +offset",
            ),
            pytest.param(
                SG.PERIOD_MONTHLY,
                [],
                datetime(2025, 2, 5, tzinfo=TZ),
                datetime(2025, 3, 1, tzinfo=TZ),
                id="monthly",
            ),
            pytest.param(
                SG.PERIOD_MONTHLY,
                [],
                datetime(2025, 2, 1, tzinfo=TZ),
                datetime(2025, 3, 1, tzinfo=TZ),
                id="monthly2",
            ),
            pytest.param(
                SG.PERIOD_MONTHLY,
                [int(timedelta(days=14).total_seconds())],
                datetime(2025, 3, 12, tzinfo=TZ),
                datetime(2025, 3, 15, tzinfo=TZ),
                id="monthly +offset same-month",
            ),
            pytest.param(
                SG.PERIOD_MONTHLY,
                [int(timedelta(days=14).total_seconds())],
                datetime(2025, 3, 18, tzinfo=TZ),
                datetime(2025, 4, 15, tzinfo=TZ),
                id="monthly +offset",
            ),
        ),
    )
    def test_preset(
        self, period: SG.Period, offsets: list[int], curr: datetime, expected: datetime
    ):
        sg = SG(period_preset=period, dispatch_times=offsets)
        result = next(curr.timestamp(), sg)
        assert datetime.fromtimestamp(result, tz=TZ).__str__() == expected.__str__()
        assert result == expected.timestamp()
