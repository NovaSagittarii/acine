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

import io

import cv2
import networkx as nx
from acine_proto_dist.input_event_pb2 import InputReplay
from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import Event, RuntimeData
from uuid_utils import uuid7

from acine.instance_manager import get_pfs
from acine.runtime.exceptions import (
    ExecutionError,
    NavigationError,
    NoPathError,
    PostconditionTimeoutError,
    PreconditionTimeoutError,
    SubroutineExecutionError,
    SubroutinePostconditionTimeoutError,
)
from acine.scheduler.typing import ExecResult

from .check import CheckResult, check, check_once
from .check_image import check_similarity
from .util import get_frame, now, sleep


class IController:
    """
    interface for i/o, you need to implement get_frame and mouse movements
    """

    async def get_frame(self) -> cv2.typing.MatLike:
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
    Routine runtime
    """

    routine: Routine
    curr: Routine.Node
    nodes: dict[str, Routine.Node]
    edges: dict[str, Routine.Edge]
    G: nx.DiGraph
    controller: IController

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

        def __init__(self, edge: Routine.Edge):
            self.id = edge.id
            self.to = edge.to
            self.edge = edge
            self.finish_count = 0

    class Context:
        """
        Routine runtime state
        """

        curr: Routine.Node = None
        call_stack: list[Runtime.Call] = [None]

    context: Context = Context()

    def __init__(
        self,
        routine: Routine,
        controller: IController,
        data: RuntimeData = RuntimeData(),
        *,
        on_change_curr=None,
        on_change_return=None,
        on_change_edge=None,
        enable_logs=False,
    ):
        if routine.nodes:
            assert "start" in routine.nodes, "Node with id=start should exist."

        self.routine = routine
        self.controller = controller
        self.data = data
        self.enable_logs = enable_logs
        self.pfs = None
        if self.enable_logs:
            self.pfs = get_pfs(routine)

        self.nodes = {}  # === routine.nodes
        self.edges = {}
        self.G = nx.DiGraph()
        self.context.curr = routine.nodes["start"] if routine.nodes else None
        self.context.call_stack = [None]
        self.target_node: Routine.Node | None = None
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

    def set_curr(self, node: Routine.Node):
        assert isinstance(node, Routine.Node), "ACCEPT NODE ONLY"
        self.context.curr = self.nodes[node.id]
        if self.on_change_curr:
            self.on_change_curr(self.context.curr)

    def push(self, edge: Routine.Edge):
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

    def get_context(self) -> Context:
        return self.context

    def restore_context(self, context: Context):
        """
        restore past state; ignores if nodes for the context are missing
        possibly due to loading a new revision of the routine with deleted nodes
        """
        valid = True
        if context.curr.id not in self.nodes:
            valid = False
        for e in context.call_stack:
            if e and e.id not in self.edges:
                valid = False
        if valid:
            self.set_curr(context.curr)
            self.context.call_stack = context.call_stack
            if self.on_change_return:
                self.on_change_return(self.context.call_stack)

    async def goto(self, id: str):
        if id not in self.nodes:
            raise ValueError(id, "target does not exist in loaded routine")
        self.target_node = self.nodes[id]
        while self.context.curr.id != id:
            print(f"{self.context.curr.name} => {self.nodes[id].name}")

            # handle pop stack (return nodes)
            # note: type=RETURN nodes have no fixed edges!
            if self.context.curr.type & Routine.Node.NODE_TYPE_RETURN:
                # run subroutine edge postcheck to decide where to go
                call = self.peek()
                call.finish_count += 1
                e = call.edge

                next_id = None
                if call.finish_count < e.repeat_lower:
                    # force repeat
                    next_id = e.subroutine  # retry
                else:  # try checking for action completion
                    res = await self.__check(
                        e, Event.PHASE_POSTCONDITION, use_dest=True
                    )
                    if res == CheckResult.PASS:
                        self.pop()
                        next_id = e.to  # complete
                    else:  # didn't pass
                        if e.repeat_upper < e.repeat_lower:  # overrides (see frontend)
                            e.repeat_upper = 1000
                        if call.finish_count < e.repeat_upper:  # retry
                            next_id = e.subroutine
                        else:
                            next_id = e.u  # failed ... probably won't apply?
                            raise SubroutinePostconditionTimeoutError(e)
                assert next_id, "Next node should be set after subroutine return"
                self.set_curr(self.nodes[next_id])
                continue

            # is deepcopy needed?
            # from copy import deepcopy
            # H = deepcopy(self.G)
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
            for u in self.routine.nodes.values():
                for e in u.edges:
                    if e.WhichOneof("action") == "subroutine":
                        H.add_edge(u.id, e.subroutine, data=e)
                        # print("ADD FUNC EDGE", u.id, e.subroutine)
                # this method only works for subroutine depth 1
                # ret = self.nodes[self.context.call_stack[-1].to]
                # if ret and (u.type & Routine.Node.NODE_TYPE_RETURN):
                #     H.add_edge(u.id, ret.id, data=None)
                #     # print("ADD RET EDGE", u.id, ret.id)
            # BFS/reachability based way for subroutine depth 2+
            # TODO: improve efficiency
            # method: you can precompute a RET-reachability for each node
            curr = self.context.curr
            # print(
            #     "CURR", curr.id,
            #     "STACK", [x.id for x in self.context.call_stack if x]
            # )
            for i in range(1, len(self.context.call_stack)):
                ret = self.nodes[self.context.call_stack[-i].to]
                # print(f"RET={ret.id} CURR={curr.id}")
                # print(self.G.edges)
                reachable = list(nx.descendants(self.G, curr.id))
                # might be the case that the RET from stack is itself a return node
                reachable.append(curr.id)
                # print("REACH=", reachable)
                for uid in reachable:
                    u = self.nodes[uid]
                    if u.type & Routine.Node.NODE_TYPE_RETURN:
                        H.add_edge(u.id, ret.id)
                        # print("ADD RET EDGE", u.id, ret.id)
                curr = ret

            try:
                path = nx.shortest_path(H, self.context.curr.id, id)
            except nx.NetworkXNoPath:
                raise NoPathError(self.context.curr.id, id)
            u = self.nodes[path[0]]
            v = self.nodes[path[1]]

            take_edge = None
            print()
            ct = 1
            while take_edge is None:
                print("[?] get_frame", ct, end="\r")
                ct += 1

                img = await self.controller.get_frame()
                oklist: list[Routine.Edge] = []
                for e in u.edges:
                    if self.__precheck_action(e, img):
                        oklist.append(e)
                        if e.trigger == e.EDGE_TRIGGER_TYPE_INTERRUPT:
                            # handle interrupt -- note: current order is first
                            # in the list will take effect -- maybe later can
                            # set up priorities
                            oklist.clear()
                            take_edge = e
                            break
                for e in oklist:
                    if e.to == v.id or e.subroutine == v.id:
                        take_edge = e
                        break
                else:  # did not find a suitable edge
                    if oklist and ct > 20:  # take whatever ??
                        take_edge = oklist[0]
                await sleep(200)

            print(
                f"RUN {take_edge.description}",
                f" => {self.nodes[take_edge.to].name}",
            )
            await self.__run_action(take_edge)
        self.target_node = None

    async def queue_edge(self, id: str) -> ExecResult:
        """
        goes to the edge start node and then runs the action on the edge
        """
        # s = self.context.curr  # source
        e = self.edges[id]
        for _ in range(10):  # insist you can navigate there (old behavior)
            try:
                await self.goto(e.u)
                break
            except ExecutionError:
                pass
                # return ExecResult.REQUIREMENT_TYPE_ATTEMPT
                # raise NavigationError(s.id, e.u)
        else:
            return ExecResult.REQUIREMENT_TYPE_ATTEMPT

        try:
            await self.__run_action(e)
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
            except (ExecutionError, NavigationError):
                raise SubroutineExecutionError(e)

        return ExecResult.REQUIREMENT_TYPE_COMPLETION

    def __process_condition(
        self, edge: Routine.Edge, condition: Routine.Condition, use_dest=True
    ):
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
        phase: Event.Phase,
        *,
        no_delay: bool = False,
        use_dest: bool = True,
    ) -> CheckResult:
        """
        processes condition before calling `check`
        """
        if phase == Event.PHASE_PRECONDITION:
            condition = edge.precondition
        elif phase == Event.PHASE_POSTCONDITION:
            condition = edge.postcondition
        else:
            assert False, "Invalid __check(phase) parameter."
        condition = self.__process_condition(edge, condition, use_dest=use_dest)
        ref_img: cv2.typing.MatLike | None = None
        if condition.WhichOneof("condition") == "image":
            ref_img = get_frame(self.routine.id, condition.image.frame_id)
        res, img = await check(
            condition, self.controller.get_frame, ref_img, no_delay=no_delay
        )
        await self.__log(edge, img, phase, res)
        if res == Event.RESULT_PASS:
            return CheckResult.PASS
        elif res == Event.RESULT_TIMEOUT:
            return CheckResult.TIMEOUT
        else:
            return CheckResult.ERROR

    def __check_once(
        self,
        edge: Routine.Edge,
        condition: Routine.Condition,
        img: cv2.typing.MatLike,
        use_dest: bool = True,
    ) -> CheckResult:
        """
        processes condition before calling `check_once`
        """
        condition = self.__process_condition(edge, condition, use_dest=use_dest)
        ref_img: cv2.typing.MatLike | None = None
        if condition.WhichOneof("condition") == "image":
            ref_img = get_frame(self.routine.id, condition.image.frame_id)
        return check_once(condition, img, ref_img)

    def __precheck_action(self, action: Routine.Edge, img: cv2.typing.MatLike):
        """
        Runs precheck once.
        """
        return self.__check_once(action, action.precondition, img, use_dest=False)

    async def __log(
        self,
        edge: Routine.Edge,
        img: cv2.typing.MatLike,
        phase: Event.Phase = Event.PHASE_UNSPECIFIED,
        result: Event.Result = Event.RESULT_UNSPECIFIED,
        comment: str | None = None,
    ):
        if not self.enable_logs or not self.pfs:
            return
        _, data = cv2.imencode(".bmp", img)
        buffer = io.BytesIO(data)
        id = uuid7().hex
        await self.pfs.write_archive([f"{id}.bmp"], buffer.getvalue())

        event = Event(archive_id=id, phase=phase, result=result, comment=comment)
        event.timestamp.GetCurrentTime()
        self.data.execution_info.get_or_create(edge.id).events.append(event)

    async def __run_action(self, action: Routine.Edge):
        """
        Runs the precheck/action/postcheck of an action
        """

        if self.on_change_edge:
            self.on_change_edge(action)

        res = await self.__check(action, Event.PHASE_PRECONDITION, use_dest=False)
        if res != CheckResult.PASS:
            # print("X ? ? precheck fail")
            if self.on_change_edge:
                self.on_change_edge(None)
            raise PreconditionTimeoutError(action)

        if action.WhichOneof("action") == "subroutine" and action.repeat_lower >= 1:
            print("EXEC SUBROUTINE", action.description)
            self.push(action)
            self.set_curr(self.nodes[action.subroutine])
            return True  # Need to abort early when subroutine runs.
            # The next shouldn't get set immediately, but stored on stack
            # until after the subroutine completes.
            # Post condition doesn't happen until the subroutine returns.
        else:
            if action.repeat_upper < action.repeat_lower:  # overrides (see frontend)
                action.repeat_upper = 1000
            for i in range(max(action.repeat_lower, action.repeat_upper)):
                if i >= action.repeat_lower:
                    res = await self.__check(
                        action, Event.PHASE_POSTCONDITION, use_dest=True
                    )
                    if res == CheckResult.PASS:
                        break  # can exit repeating early
                await self.__exec_action(action)
            else:  # final postcondition check
                res = await self.__check(
                    action, Event.PHASE_POSTCONDITION, use_dest=True
                )
                if res != CheckResult.PASS:
                    # print("! ! X postcheck fail")
                    if self.on_change_edge:
                        self.on_change_edge(None)
                    raise PostconditionTimeoutError(action)

        # update state after postcondition check passes
        self.set_curr(self.nodes[action.to])

    async def __exec_action(self, action: Routine.Edge) -> bool:
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
            case _:
                raise NotImplementedError()

    async def acquire_offset(self, condition: Routine.Condition):
        if condition.WhichOneof("condition") == "image":
            c = condition.image
            ref = get_frame(self.routine.id, c.frame_id)
            img = await self.controller.get_frame()
            matches = check_similarity(c, img, ref)
            print(matches)
            if matches:
                return matches[0].position
        return None

    async def run_replay(self, replay: InputReplay, dx=0, dy=0):
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
