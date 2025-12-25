"""
RuntimeData / Logging related utilities

TODO: maybe turn into a wrapper class? not sure about code style
"""

from random import random

from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import ExecutionInfo, RuntimeData

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
