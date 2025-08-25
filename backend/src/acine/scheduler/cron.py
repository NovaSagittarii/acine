import bisect
import calendar
from datetime import datetime, timedelta, timezone

from acine_proto_dist.routine_pb2 import Routine

Period = Routine.SchedulingGroup.Period
TZ = timezone(timedelta(), name="UTC")


def next(ts: float, s: Routine.SchedulingGroup) -> float:
    """
    Gets the next scheduled time for a SchedulingGroup given the last scheduled time.
    """

    s.dispatch_times.sort()
    if not s.dispatch_times:
        s.dispatch_times.append(0)
    if len(set(s.dispatch_times)) != len(s.dispatch_times):
        raise ValueError("cannot have duplicate times")

    ct = datetime.fromtimestamp(ts, tz=TZ)  # current time (datetime)
    pt = ct  # start of current period (datetime)
    psz = timedelta()  # period size

    if s.period_preset == Period.PERIOD_UNSPECIFIED:
        if not s.period:
            raise ValueError("expected nonzero s.period when period_preset is unset")
        t = ct.timestamp()
        pt = datetime.fromtimestamp(t - (t % s.period), tz=TZ)
        psz = timedelta(seconds=s.period)
    else:
        period = s.period_preset
        pt = pt.replace(hour=0, minute=0, second=0, microsecond=0)
        match period:
            case Period.PERIOD_DAILY:
                psz = timedelta(days=1)
            case Period.PERIOD_WEEKLY:
                psz = timedelta(days=7)
                weekday = (pt.weekday() + 1) % 7  # convert to sunday==0
                pt -= timedelta(days=weekday)
            case Period.PERIOD_BIWEEKLY:
                psz = timedelta(days=14)
                mt = pt.replace(day=1)  # first day of month
                mt += timedelta(days=6 - mt.weekday())  # go to first Sunday
                if pt.day - mt.day >= 14:  # go to the 3rd Sunday
                    mt += timedelta(days=14)
                pt = pt.replace(day=mt.day)
            case Period.PERIOD_MONTHLY:
                _, days_in_month = calendar.monthrange(pt.year, pt.month)
                psz = timedelta(days=days_in_month)
                pt = pt.replace(day=1)
            case _:
                raise ValueError("unhandled preset period", period)

    for t in s.dispatch_times:
        if t < 0 or t >= psz.total_seconds():
            raise ValueError(f"invalid dispatch time {t} (T={psz.total_seconds()})")

    xts = (ct - pt).total_seconds()
    i = bisect.bisect_right(s.dispatch_times, xts)
    if i == len(s.dispatch_times):
        return (pt + psz).timestamp() + s.dispatch_times[0]
    else:
        return (pt + timedelta(seconds=s.dispatch_times[i])).timestamp()
