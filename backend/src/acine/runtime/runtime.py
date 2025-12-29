"""
Top level module that implements the acine routine runtime.

TODO: Possible improvements:
- Use python recursion (see note under Routine.Call) -- simplifies logic
- Remove the interface in favor of an interactive style class. goto becomes
  a generator that requests what actions to happen (how to deal with subroutine?)
  -- might simplify interface code? but this would clean up dependency issues
  and make mocks simpler.
"""

from __future__ import annotations

import asyncio
import io
from types import TracebackType
from typing import Callable, Final, List, Optional, Type, TypeAlias, Union

import cv2
import networkx as nx
from acine_proto_dist.input_event_pb2 import InputReplay
from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import Action, RuntimeData, RuntimeState
from uuid_utils import uuid7

from acine.instance_manager import get_pfs
from acine.logging import (
    ActionLogger,
    NavigationLogger,
    is_edge_ready,
    mark_failure,
    mark_success,
)
from acine.runtime.check import ActionResult, check, check_once
from acine.runtime.check_image import ImageBmpType, check_similarity
from acine.runtime.exceptions import (
    AcineInterrupt,
    AcineNavigationError,
    AcineNoPath,
    AcineRuntimeError,
    ExecutionError,
    PostconditionTimeoutError,
    PreconditionTimeoutError,
    SubroutineExecutionError,
    SubroutinePostconditionTimeoutError,
)
from acine.runtime.util import get_frame, now, sleep
from acine.scheduler.typing import ExecResult

ExcInfo: TypeAlias = tuple[Type[BaseException], BaseException, TracebackType]
OptExcInfo: TypeAlias = Union[ExcInfo, tuple[None, None, None]]

# timeout in milliseconds that overrides when the timeout is unset
DEFAULT_TIMEOUT: Final[int] = 30000
THREADING_EVENT_TIMEOUT: Final[float] = 0.01  # in seconds


class IController:
    """
    interface for i/o, you need to implement get_frame and mouse movements
    """

    async def get_frame(self) -> ImageBmpType:
        """
        method for getting the current frame
        """
        raise NotImplementedError()

    async def mouse_move(self, x: int, y: int) -> None:
        """
        method for moving mouse to (x, y)
        """
        raise NotImplementedError()

    async def mouse_down(self) -> None:
        """
        method for pressing mouse down
        """
        raise NotImplementedError()

    async def mouse_up(self) -> None:
        """
        method for release mouse
        """
        raise NotImplementedError()


class Runtime:
    """
    Routine runtime, handles navgraph actions.
    """

    class Call:
        """
        Routine subroutine call (goes on call_stack)

        It's a bit strange to reimplement the call stack though. I think it
        is reasonable to use Python's recursion, but I feel that debugging
        the stack trace (when it fails) is going to be worse (?).

        Oh if you use recursion, it's harder to queue an edge within a subroutine.
        It would involve stack save/restore (maybe that's fine though).

        Queue within-subroutine edge rarely happens during scheduling, but this
        is very common during editing. There's context interrupt on re-upload.
        And just testing a subroutine (queue edges from inside the subroutine).
        """

        def __init__(self, edge: Routine.Edge) -> None:
            self.id: str = edge.id
            self.to: str = edge.to
            self.edge: Routine.Edge = edge
            self.finish_count: int = 0

    class Context:
        """
        Routine runtime state
        """

        def __init__(self) -> None:
            self.curr: Routine.Node = Routine.Node()
            self.call_stack: List[Runtime.Call] = [Runtime.Call(Routine.Edge())]

    context: Context

    def __init__(
        self,
        routine: Routine,
        controller: IController,
        data: Optional[RuntimeData] = None,
        *,
        on_change_curr: Optional[Callable[[Routine.Node], None]] = None,
        on_change_return: Optional[Callable[[List[Call]], None]] = None,
        on_change_edge: Optional[Callable[[Optional[Routine.Edge]], None]] = None,
        enable_logs: bool = False,
    ):
        if routine.nodes:
            assert "start" in routine.nodes, "Node with id=start should exist."

        self.routine = routine
        self.controller = controller
        self.data = data or RuntimeData()
        # i can't believe default parameter is a reference ...
        self.enable_logs = enable_logs
        self.pfs = None
        if self.enable_logs:
            self.pfs = get_pfs(routine)

        self.nodes: dict[str, Routine.Node] = {}  # === routine.nodes
        self.edges: dict[str, Routine.Edge] = {}
        self.G: nx.DiGraph = nx.DiGraph()
        self.context = Runtime.Context()
        self.context.curr = routine.nodes["start"] if routine.nodes else Routine.Node()
        self.context.call_stack = [Runtime.Call(Routine.Edge())]
        self.target_node: Optional[Routine.Node] = None
        self.on_change_curr = on_change_curr
        self.on_change_return = on_change_return
        self.on_change_edge = on_change_edge
        """ the call stack but only the return nodes "addresses" """

        for n in self.routine.nodes.values():
            self.G.add_node(n.id)
            self.nodes[n.id] = n
            for e in n.edges:
                if e.trigger & Routine.Edge.EDGE_TRIGGER_TYPE_STANDARD:
                    # scheduled don't exist, interrupts don't happen
                    self.G.add_edge(n.id, e.to, data=e)
                e.u = n.id
                self.edges[e.id] = e

        self.set_curr(self.context.curr)  # pushes update on init

        # Runtime worker -- another thread whose call stack represents the
        # current state of the navigator on the recursive navgraph.
        self.worker_has_work = asyncio.Event()
        self.worker_busy = asyncio.Event()
        """`await` on this.acquire() if waiting until worker settles."""
        self.worker_queued_edge: Optional[Routine.Edge] = None
        """force exec an edge from MainThread self.queue_edge() call"""
        self.worker_result: Optional[AcineRuntimeError] = None
        """Read from this after awaiting worker_busy to see any errors."""
        self.worker_terminate = False
        """Flag for whether the worker should terminate."""

        self.exc_info: OptExcInfo = (None, None, None)

        async def run_worker() -> None:
            try:
                await self.exec_subroutine(self.nodes["start"])
            except AcineInterrupt:
                # normal exit
                pass
            except Exception as exception:  # https://stackoverflow.com/a/1854263
                import sys

                self.exc_info = sys.exc_info()
                raise exception

        # self.worker = threading.Thread(target=run_worker)
        # """worker thread for the navigator"""
        # self.worker.start()

        loop = asyncio.get_event_loop()
        self.task = loop.create_task(run_worker())

    def __del__(self) -> None:
        if hasattr(self, "worker"):
            self.worker_terminate = True
            # self.worker.join()
            coro = self.task.get_coro()
            if coro:
                asyncio.run(coro)  # run until exits
        if hasattr(self, "exc_info") and self.exc_info[1]:
            raise self.exc_info[1].with_traceback(self.exc_info[2])

    # __enter__/__exit is for test usage (auto-cleanup)
    # since __del__ only gets invoked at program exit
    # and pytest somehow just hangs (never calls __del__ afterwards)
    def __enter__(self) -> Runtime:
        return self

    def __exit__(self, *_: object) -> None:
        self.__del__()

    async def exec_subroutine(self, entry: Routine.Node) -> None:
        """
        Executes a subroutine starting from a specific entry node and then
        continuously routing towards target_node. After reaching a RETURN node,
        the subroutine ends.

        If resolving the the subroutine (reach RETURN node) is required,
        then it'll route towards the RETURN node, eventually ending the
        subroutine.

        NOTE: Maybe extract out into a RuntimeWorker class? Not sure if
        necessary because I think the single-threaded (simulate stack yourself)
        is more consistent language-wise to implement so a single-threaded
        implementation would end up being re-merged into Runtime.

        :param entry: Navigate on a subgraph starting from here.
        :type entry: Routine.Node
        """

        async def resolve(result: Optional[AcineRuntimeError] = None) -> None:
            """
            Signal that the worker has settled for some reason.

            :param result: Result of work. None if successful, otherwise the error.
            :type result: Optional[AcineRuntimeError]
            """
            self.target_node = None
            self.worker_result = result
            self.worker_has_work.clear()
            self.worker_busy.set()
            await self.worker_has_work.wait()
            if self.worker_terminate:
                raise AcineInterrupt()
            self.worker_busy.clear()

        self.set_curr(entry)
        while not self.context.curr.type & Routine.Node.NODE_TYPE_RETURN:
            # used for easier breakpoint reading when debugging
            # _1 = self.context.curr.id
            # _2 = self.target_node and self.target_node.id
            while self.context.curr == self.target_node:
                # Wake up anything waiting while we're at destination.
                # Worker staying idling (settled) until a `self.goto()` call
                # updates `self.target_node` to something else.
                await resolve()
                if self.worker_terminate:
                    return await resolve(AcineInterrupt())
            if self.worker_terminate:
                return await resolve(AcineInterrupt())
            if self.worker_queued_edge:
                assert self.worker_queued_edge.u
                if self.context.curr.id == self.worker_queued_edge.u:
                    # will fall through first time before waiting for
                    # MainThread to call goto
                    try:
                        with NavigationLogger(
                            self.data, self.get_runtime_state(), comment="queue_edge"
                        ) as logger:
                            await self.__run_action(self.worker_queued_edge, logger)
                        await resolve()
                    except AcineRuntimeError as e:
                        await resolve(e)
                    continue
            if self.target_node is None:  # nowhere to route to... :moyai:
                await resolve()
                continue

            with NavigationLogger(self.data, self.get_runtime_state()) as logger:
                # --- Build graph with current state of return stack.
                # NOTE: currently not optimized
                # TODO: benchmark to see if precompute is necessary
                H = self.G.copy()
                """
                modified graph with extra edges to handle subroutines

                for any edge `e` with subroutine (u -> v) that goes to node `s`
                - add an edge (u -> s) linked to edge `e`
                - to handle triggering subroutines

                for any return nodes `r` with some node `k` on the call stack
                - add an edge (r -> k)
                - to handle ending subroutines

                otherwise you are forced to take the subroutine so you can leave
                the subroutine edge in there.
                """
                # NOTE: the DiGraph doesn't have multiedge so need to
                # explicitly add these edges again later
                for u in self.routine.nodes.values():
                    for edge in u.edges:
                        if edge.WhichOneof("action") == "subroutine":
                            H.add_edge(u.id, edge.subroutine, data=edge)
                # BFS/reachability based way for subroutine depth 2+
                # NOTE: you **could** precompute a RET-reachability for each node
                curr = self.context.curr
                for i in range(1, len(self.context.call_stack)):
                    ret = self.nodes[self.context.call_stack[-i].to]
                    reachable = list(nx.descendants(self.G, curr.id))
                    # might be the case that the RET from stack is itself a return node
                    # ^ why ???
                    reachable.append(curr.id)
                    for uid in reachable:
                        u = self.nodes[uid]
                        if u.type & Routine.Node.NODE_TYPE_RETURN:
                            H.add_edge(u.id, ret.id)
                    curr = ret

                # --- Determine the ranking for which next nodes are closer to target.
                ranking: list[Routine.Node] = []
                s: str = self.context.curr.id  # source
                t: str = self.target_node.id  # target
                while len(H.adj[self.context.curr.id]):
                    try:
                        path = nx.shortest_path(H, s, t)
                        assert len(path) >= 2, "Path should go somewhere."
                        ranking.append(self.nodes[path[1]])
                        H.remove_edge(*path[:2])
                    except nx.NetworkXNoPath:
                        break
                if not ranking:
                    logger.set_exception(logger.Exception.EXCEPTION_NO_PATH)
                    await resolve(AcineNoPath(s, t))
                    continue

                # --- Determine the ranking for edges to take.
                def index_of(node: Routine.Node) -> int:  # .index with js behavior
                    try:
                        return ranking.index(node)
                    except ValueError:
                        return -1

                def calc_dist(e: Routine.Edge) -> int:
                    check = [e.to]
                    if e.WhichOneof("action") == "subroutine":
                        check.append(e.subroutine)
                    res = [index_of(self.nodes[eid]) for eid in check]
                    res = [x for x in res if x != -1]
                    return min(res) if res else -1

                sorted_edge_tuples = sorted(
                    [  # lower is better (treat as cost/penalty)
                        (
                            e.trigger != e.EDGE_TRIGGER_TYPE_INTERRUPT,  # interrupt
                            calc_dist(e),  # estimated remaining distance
                            e,
                        )
                        for e in self.nodes[self.context.curr.id].edges
                        if is_edge_ready(self.data, e)
                        or e.trigger == e.EDGE_TRIGGER_TYPE_INTERRUPT  # interrupt
                    ]
                )
                # remove useless edges... though navigation should be fully connected?
                sorted_edges = [
                    e
                    for not_interrupt, priority, e in sorted_edge_tuples
                    if priority >= 0 or not not_interrupt
                ]
                if not sorted_edges:
                    logger.set_exception(logger.Exception.EXCEPTION_NO_PATH)
                    await resolve(AcineNoPath(s, t))
                    continue

                # --- Knowing the edge priority, start checking.
                # keep looking at preconditions until one passes all but higher
                # priority ones have timed out
                # or if any interrupts become active
                start_time = now()
                is_complete = False
                while not self.worker_terminate and not is_complete:
                    img = await self.controller.get_frame()
                    for edge in sorted_edges:
                        if not is_edge_ready(self.data, edge):
                            continue  # skip unready edges
                        condition = self.__resolve_condition(
                            edge, edge.precondition, False
                        )
                        # ok = self.__check_once(edge, condition, img=img)
                        ok = self.__precheck_action(edge, img)
                        if not ok:
                            if now() > start_time + (
                                condition.timeout or DEFAULT_TIMEOUT
                            ):
                                # timed out
                                mark_failure(self.data.edges.get_or_create(edge.id))
                                pass
                            elif edge.trigger != edge.EDGE_TRIGGER_TYPE_INTERRUPT:
                                # need to wait for higher priority non-interrupt
                                # to time out before attempting lower priority
                                break  # quit loop to try again from 1st check
                        else:
                            # found something to take
                            mark_success(self.data.edges.get_or_create(edge.id))
                            is_complete = True
                            try:
                                await self.__run_action(edge, logger)
                            except PostconditionTimeoutError:
                                pass
                            break
                    else:
                        # if managed to get through all edges, as in they ALL timed out
                        # then there is no path from this node.
                        logger.set_exception(logger.Exception.EXCEPTION_NO_PATH)
                        await resolve(AcineNoPath(s, t))
                        break
                    await asyncio.sleep(0)

    def set_curr(self, node: Routine.Node) -> None:
        assert isinstance(node, Routine.Node), "ACCEPT NODE ONLY"
        self.context.curr = self.nodes[node.id]
        if self.on_change_curr:
            self.on_change_curr(self.context.curr)

    def push(self, edge: Routine.Edge) -> None:
        assert isinstance(edge, Routine.Edge), "ACCEPT EDGE ONLY"
        self.context.call_stack.append(Runtime.Call(edge))
        if self.on_change_return:
            self.on_change_return(self.context.call_stack)

    def pop(self) -> Runtime.Call:
        u = self.context.call_stack.pop()
        if self.on_change_return:
            self.on_change_return(self.context.call_stack)
        return u

    def peek(self) -> Runtime.Call:
        return self.context.call_stack[-1]

    def get_runtime_state(self) -> RuntimeState:
        return RuntimeState(
            current_node=Routine.Node(id=self.context.curr.id),
            target_node=self.target_node and Routine.Node(id=self.target_node.id),
            stack_edges=[Routine.Edge(id=c.edge.id) for c in self.context.call_stack],
        )

    def get_context(self) -> Context:
        return self.context

    def restore_context(self, context: Context) -> None:
        """
        restore past state; ignores if nodes for the context are missing
        possibly due to loading a new revision of the routine with deleted nodes

        NOTE: might be complicated with the separate thread worker??
        """
        valid = True
        if context.curr.id not in self.nodes:
            valid = False
        for e in context.call_stack:
            if e and e.id and e.id not in self.edges:
                valid = False
        if valid:
            self.set_curr(context.curr)
            self.context.call_stack = context.call_stack
            if self.on_change_return:
                self.on_change_return(self.context.call_stack)

    async def goto(self, id: str) -> None:
        if id not in self.nodes:
            raise ValueError(id, "target does not exist in loaded routine")
        self.target_node = self.nodes[id]
        self.worker_busy.clear()
        self.worker_has_work.set()
        await self.worker_busy.wait()
        # TODO: if python runtime exception, it won't get caught. instead
        #       you need to run in debugger to find it. (fix this later)
        if self.worker_result:
            raise self.worker_result
        return

    async def queue_edge(self, id: str) -> ExecResult.ValueType:
        """
        goes to the edge start node and then runs the action on the edge
        """
        if id not in self.edges:
            raise ValueError("Edge does not exist.")
        # s = self.context.curr  # source
        e = self.edges[id]
        try:
            await self.goto(e.u)
        except AcineNavigationError:
            return ExecResult.REQUIREMENT_TYPE_ATTEMPT
        try:
            # await self.__run_action(e)
            self.worker_busy.clear()
            self.worker_queued_edge = e
            self.worker_has_work.set()
            await self.worker_busy.wait()
            if self.worker_result:
                raise self.worker_result
        except PreconditionTimeoutError:
            return ExecResult.REQUIREMENT_TYPE_CHECK
        except PostconditionTimeoutError:
            return ExecResult.REQUIREMENT_TYPE_EXECUTE

        if e.WhichOneof("action") == "subroutine":
            # current impl cannot support subroutine errors

            # subroutine doesn't complete until it resolves
            try:
                await self.goto(e.to)
            except SubroutinePostconditionTimeoutError:
                if self.context.call_stack[-1].edge == e:
                    # timeout during target subroutine postcondition
                    raise PostconditionTimeoutError(e)
                else:
                    # timeout during a child subroutine postcondition
                    raise SubroutineExecutionError(e)
            except (ExecutionError, AcineNavigationError):
                raise SubroutineExecutionError(e)

        return ExecResult.REQUIREMENT_TYPE_COMPLETION

    def __resolve_condition(
        self, edge: Routine.Edge, condition: Routine.Condition, use_dest: bool = True
    ) -> Routine.Condition:
        """
        handles substitution in case of auto
        if use_dest: references the destination node's default condition
        else: references the source node's default condition
        """
        if condition.WhichOneof("condition") == "auto":
            condition = self.nodes[edge.to if use_dest else edge.u].default_condition
        if condition.WhichOneof("condition") == "target":
            condition = self.nodes[edge.to].default_condition
        return condition

    async def __check(
        self,
        edge: Routine.Edge,
        phase: Action.Phase.ValueType,
        logger: ActionLogger,
        *,
        no_delay: bool = False,
        critical: bool = False,
    ) -> ActionResult.ValueType:
        """
        resolves condition and then calls `check`
        """

        use_dest = phase == Action.PHASE_POSTCONDITION
        if phase == Action.PHASE_PRECONDITION:
            condition = edge.precondition
        elif phase == Action.PHASE_POSTCONDITION:
            condition = edge.postcondition
        else:
            assert False, "Invalid __check(phase) parameter."
        condition = self.__resolve_condition(edge, condition, use_dest=use_dest)
        ref_img: Optional[ImageBmpType] = None
        if condition.WhichOneof("condition") == "image":
            ref_img = get_frame(self.routine.id, condition.image.frame_id)
        res, img = await check(
            condition, self.controller.get_frame, ref_img, no_delay=no_delay
        )
        await self.__log(
            logger,
            img,
            phase=phase,
        )
        return res

    def __check_once(
        self,
        edge: Routine.Edge,
        condition: Routine.Condition,
        img: ImageBmpType,
        use_dest: bool = True,
    ) -> bool:
        """
        processes condition before calling `check_once`
        """
        condition = self.__resolve_condition(edge, condition, use_dest=use_dest)
        ref_img: Optional[ImageBmpType] = None
        if condition.WhichOneof("condition") == "image":
            ref_img = get_frame(self.routine.id, condition.image.frame_id)
        return check_once(condition, img, ref_img)

    def __precheck_action(self, action: Routine.Edge, img: ImageBmpType) -> bool:
        """
        Runs precheck once.
        """
        return self.__check_once(action, action.precondition, img, use_dest=False)

    async def __log(
        self,
        logger: ActionLogger,
        img: ImageBmpType,
        phase: Action.Phase.ValueType = Action.PHASE_UNSPECIFIED,
    ) -> None:
        if not self.enable_logs or not self.pfs:
            return
        _, data = cv2.imencode(".bmp", img)
        buffer = io.BytesIO(data)
        id = str(uuid7())
        await self.pfs.write_archive([f"{id}.bmp"], buffer.getvalue())

        logger.log(phase, id)

    async def __run_action(
        self, action: Routine.Edge, navgiation_logger: NavigationLogger
    ) -> None:
        """
        Runs the precheck/action/postcheck of an action
        """

        if self.on_change_edge:
            self.on_change_edge(action)

        with navgiation_logger.action(action) as logger:
            res = await self.__check(action, Action.PHASE_PRECONDITION, logger)
            if res != ActionResult.RESULT_PASS:
                if self.on_change_edge:
                    self.on_change_edge(None)
                logger.finalize(logger.Result.RESULT_TIMEOUT)
                raise PreconditionTimeoutError(action)

            if action.repeat_upper < action.repeat_lower:  # overrides (see frontend)
                action.repeat_upper = 1000
            for i in range(max(action.repeat_lower, action.repeat_upper)):
                if i >= action.repeat_lower:
                    res = await self.__check(
                        action,
                        Action.PHASE_POSTCONDITION,
                        logger,
                        critical=action.repeat_upper == 1,
                    )
                    if res == ActionResult.RESULT_PASS:
                        break  # executed sufficient times and passed, we're done
                await self.__exec_action(action)
            else:  # final postcondition check
                res = await self.__check(
                    action, Action.PHASE_POSTCONDITION, logger, critical=True
                )
                if res != ActionResult.RESULT_PASS:
                    if self.on_change_edge:
                        self.on_change_edge(None)
                    logger.finalize(logger.Result.RESULT_TIMEOUT)
                    raise PostconditionTimeoutError(action)

            logger.finalize(logger.Result.RESULT_PASS)
            # update state after postcondition check passes
            self.set_curr(self.nodes[action.to])

    async def __exec_action(self, action: Routine.Edge) -> None:
        """
        Executes the action, utility function useful for handling repeats.

        Note: subroutine handled separately.
        """

        match action.WhichOneof("action"):
            case None:
                pass
            case "replay":
                dx, dy = 0, 0
                replay = action.replay
                if replay.relative and replay.offset:
                    offset = await self.acquire_offset(action.precondition)
                    if offset:
                        px, py = replay.offset.x, replay.offset.y
                        y, x = offset
                        dx, dy = x - px, y - py
                        print(f"o({x},{y}) po({px},{py}) d({dx},{dy})")
                await self.run_replay(replay, dx, dy)
                print("REPLAY DONE")
            case "subroutine":
                self.push(action)
                await self.exec_subroutine(self.nodes[action.subroutine])
                self.pop()
            case _:
                raise NotImplementedError()

    async def acquire_offset(
        self, condition: Routine.Condition
    ) -> Optional[tuple[int, int]]:
        if condition.WhichOneof("condition") == "image":
            c = condition.image
            ref = get_frame(self.routine.id, c.frame_id)
            img = await self.controller.get_frame()
            matches = check_similarity(c, img, ref)
            print(matches)
            if matches:
                return matches[0].position
        return None

    async def run_replay(self, replay: InputReplay, dx: int = 0, dy: int = 0) -> None:
        """
        simulate a replay in terms of controller calls
        """
        t0 = now()
        for e in replay.events:
            t1 = t0 + e.timestamp
            await sleep(t1 - now())
            match e.WhichOneof("type"):
                case "move":
                    await self.controller.mouse_move(e.move.x + dx, e.move.y + dy)
                case "mouse_down":
                    await self.controller.mouse_down()
                case "mouse_up":
                    await self.controller.mouse_up()
                case "key_down":
                    raise NotImplementedError()
                case "key_up":
                    raise NotImplementedError()
                case _:
                    raise NotImplementedError()
