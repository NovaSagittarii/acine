from __future__ import annotations

import asyncio
import inspect
from typing import Any, Callable, Coroutine, Optional, TypeVar

import pytest
from _pytest.config import Config
from _pytest.nodes import Item
from _pytest.reports import TestReport
from _pytest.runner import CallInfo

T = TypeVar("T")


class AsyncioTimeLimitExceeded(Exception):
    time_limit: float

    def __init__(self, time_limit: float) -> None:
        self.time_limit = time_limit
        super().__init__(f"Time limit exceeded ({time_limit}s)")


def pytest_configure(config: Config) -> None:
    config.addinivalue_line(
        "markers",
        "asyncio_time_limit(time_limit): fail test with outcome 'T' if timeout expires",
    )


# item is type Item ... but is also a Coroutine ...
# but somehow you want item.obj (not sure why)
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_call(item: Any) -> Any:
    marker = item.get_closest_marker("asyncio_time_limit")
    if marker is None:
        yield
        return

    time_limit = marker.kwargs.get("time_limit")
    if not isinstance(time_limit, (int, float)):
        raise pytest.UsageError("asyncio_time_limit marker requires numeric 'timeout='")

    test_func = item.obj

    if not inspect.iscoroutinefunction(test_func):
        raise pytest.UsageError("asyncio_time_limit can only be used on async tests")

    async_test_func: Callable[[], Coroutine[Any, Any, Any]] = test_func

    async def wrapped(*args: object, **kwargs: object) -> None:
        try:
            async with asyncio.timeout(time_limit):
                await async_test_func(*args, **kwargs)
        except asyncio.TimeoutError as exc:
            raise AsyncioTimeLimitExceeded(time_limit) from exc

    item.obj = wrapped
    yield


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(
    item: Item,
    call: CallInfo[Any],
) -> Any:
    outcome = yield
    report: pytest.TestReport = outcome.get_result()

    if call.excinfo is not None and isinstance(
        call.excinfo.value, AsyncioTimeLimitExceeded
    ):
        report.outcome = "failed"
        # report.longrepr = str(call.excinfo.value)  # no effect?
        setattr(report, "_asyncio_time_limit", True)

    return report


def pytest_report_teststatus(
    report: TestReport,
    config: Config,
) -> Optional[pytest.TestShortLogReport]:
    if getattr(report, "_asyncio_time_limit", False):
        return pytest.TestShortLogReport(
            category="timeout",
            letter="T",
            word=("TIME LIMIT EXCEEDED", {"red": True}),
        )
    return None
