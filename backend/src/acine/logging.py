"""
RuntimeData / Logging related utilities

TODO: maybe turn into a wrapper class? not sure about code style
"""

from __future__ import annotations

import datetime
from random import random
from types import TracebackType
from typing import Optional, Sequence, TypeAlias

from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import (
    Action,
    Event,
    ExecutionInfo,
    RuntimeData,
    RuntimeState,
)

from acine.runtime.util import now


def mark_failure(info: ExecutionInfo) -> ExecutionInfo:
    """
    Updates an ExecutionInfo with a failure, updates next_time.

    :param info: What you're modifying (in-place)
    :type info: ExecutionInfo
    :return: info (after modified in-place)
    :rtype: ExecutionInfo
    """
    info.stats.total += 1
    info.stats.fails += 1
    info.stats.consecutive_fails += 1

    future = int(round(now() + random() * (2**info.stats.consecutive_fails) * 1000))
    info.stats.next_time.FromMilliseconds(future)
    return info


def mark_success(info: ExecutionInfo) -> ExecutionInfo:
    """
    Updates an ExecutionInfo with a success.

    :param info: What you're modifying (in-place)
    :type info: ExecutionInfo
    :return: info (after modified in-place)
    :rtype: ExecutionInfo
    """
    info.stats.total += 1
    info.stats.consecutive_fails = 0
    return info


def is_edge_ready(data: RuntimeData, edge: Routine.Edge) -> bool:
    """
    Returns True if a edge is ready to run, might not be if failed too recently.

    :param data: runtime data to read from
    :type data: RuntimeData
    :param edge: the edge to check
    :type edge: Routine.Edge
    :return: whether the edge does not have a recent failure, thus can be attempted
    :rtype: bool
    """
    return now() >= data.edges[edge.id].stats.next_time.ToMilliseconds()


class NavigationLogger:
    """
    Log navigation state.
    Appends to given runtime_data on __exit__.
    """

    Exception: TypeAlias = Event.Exception

    def __init__(
        self,
        runtime_data: RuntimeData,
        context: RuntimeState,
        *,
        comment: Optional[str] = None,
    ):
        self.runtime_data = runtime_data
        self.event = Event()
        self.event.context.CopyFrom(context)
        if comment:
            self.event.debug.comment = comment

    def __enter__(self) -> NavigationLogger:
        self.event.time_start.FromDatetime(datetime.datetime.now(datetime.UTC))
        return self

    def __exit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> Optional[bool]:
        self.event.time_end.FromDatetime(datetime.datetime.now(datetime.UTC))
        self.runtime_data.events.append(self.event)
        if exc_type and exc_val:
            raise exc_val
        return None

    def action(self, action: Routine.Edge) -> ActionLogger:
        """Specializes this event as an action event."""
        return ActionLogger(self.event, action)

    def set_exception(self, exception: Event.Exception.ValueType) -> None:
        """Mark event failure"""
        self.event.exception = exception

    def set_ranking(self, ranking: Sequence[str]) -> None:
        self.event.debug.ClearField("rankings")
        self.event.debug.rankings.extend(ranking)


class ActionLogger:
    Phase: TypeAlias = Action.Phase
    Result: TypeAlias = Action.Result

    def __init__(self, event: Event, action: Routine.Edge):
        self.event = event
        self.event.action.id = action.id
        self.action = self.event.action

    def __enter__(self) -> ActionLogger:
        return self

    def __exit__(
        self,
        exc_type: Optional[type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> Optional[bool]:
        if self.action.events:
            assert self.action.result is not None, "ActionLogger should be finalized."
            self.action.events.sort(key=lambda e: e.timestamp.ToDatetime())
            self.action.phase = self.action.events[-1].phase
        if exc_type and exc_val:
            raise exc_val
        return None

    def log(
        self,
        phase: Action.Phase.ValueType,
        archive_id: str,
    ) -> None:
        """Save a frame with some phase and current timestamp."""
        event = Action.Event(archive_id=archive_id, phase=phase)
        event.timestamp.FromDatetime(datetime.datetime.now(datetime.UTC))
        self.action.events.append(event)

    def finalize(self, result: Action.Result.ValueType) -> None:
        """
        Set the action result. This can be called multiple times,
        but should be called at least once.
        """
        self.action.result = result
