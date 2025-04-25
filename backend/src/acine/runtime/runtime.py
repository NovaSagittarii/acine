"""
Top level module that implements the acine routine runtime.
"""

import cv2
import networkx as nx
from acine_proto_dist.input_event_pb2 import InputReplay
from acine_proto_dist.routine_pb2 import Routine

from .check import CheckResult, check, check_once
from .util import now, sleep


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

    def __init__(self, routine: Routine, controller: IController):
        self.routine = routine
        self.controller = controller

        self.nodes = {}
        self.edges = {}
        self.G = nx.DiGraph()
        self.curr = routine.nodes[0]
        self.return_stack: list[Routine.Node] = [None]
        """ the call stack but only the return nodes "addresses" """

        for n in self.routine.nodes:
            self.G.add_node(n.id)
            self.nodes[n.id] = n
            for e in n.edges:
                self.G.add_edge(n.id, e.to, data=e)
                e.u = n.id
                self.edges[e.id] = e

    async def goto(self, id: str):
        while self.curr.id != id:
            print(f"{self.curr.name} => {self.nodes[id].name}")

            # handle pop stack (return nodes)
            # note: type=RETURN nodes have no fixed edges!
            if self.curr.type & Routine.Node.NODE_TYPE_RETURN:
                self.curr = self.return_stack.pop()
                print("POP")
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
            for u in self.routine.nodes:
                for e in u.edges:
                    if e.WhichOneof("action") == "subroutine":
                        H.add_edge(u.id, e.subroutine, data=e)
                        # print("ADD FUNC EDGE", u.id, e.subroutine)
                # this method only works for subroutine depth 1
                # ret = self.return_stack[-1]
                # if ret and (u.type & Routine.Node.NODE_TYPE_RETURN):
                #     H.add_edge(u.id, ret.id, data=None)
                #     # print("ADD RET EDGE", u.id, ret.id)
            # BFS/reachability based way for subroutine depth 2+
            # TODO: improve efficiency
            # method: you can precompute a RET-reachability for each node
            curr = self.curr
            # print("CURR", curr.id, "STACK", [x.id for x in self.return_stack if x])
            for i in range(1, len(self.return_stack)):
                ret = self.return_stack[-i]
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

            path = nx.shortest_path(H, self.curr.id, id)
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

    async def queue_edge(self, id: str):
        """
        goes to the edge start node and then runs the action on the edge
        """
        e = self.edges[id]
        await self.goto(e.u)
        await self.__run_action(e)

    def __process_condition(self, edge: Routine.Edge, condition: Routine.Condition):
        """
        handles substitution in case of auto
        (references the destination node's default condition)
        """
        if condition.WhichOneof("condition") == "auto":
            condition = self.nodes[edge.to].default_condition
        return condition

    def __check(
        self,
        edge: Routine.Edge,
        condition: Routine.Condition,
        *,
        no_delay: bool = False,
    ) -> CheckResult:
        """
        processes condition before calling `check`
        """
        condition = self.__process_condition(edge, condition)
        return check(condition, self.controller.get_frame, no_delay=no_delay)

    def __check_once(
        self,
        edge: Routine.Edge,
        condition: Routine.Condition,
        img: cv2.typing.MatLike,
    ) -> CheckResult:
        """
        processes condition before calling `check_once`
        """
        condition = self.__process_condition(edge, condition)
        return check_once(condition, img)

    def __precheck_action(self, action: Routine.Edge, img: cv2.typing.MatLike):
        """
        Runs precheck once.
        """
        return self.__check_once(action, action.precondition, img)

    async def __run_action(self, action: Routine.Edge):
        """
        Runs the precheck/action/postcheck of an action
        """
        res = await self.__check(action, action.precondition)
        if res != CheckResult.PASS:
            print("X ? ? precheck fail")
            return

        match action.WhichOneof("action"):
            case None:
                pass
            case "replay":
                await self.run_replay(action.replay)
                print("REPLAY DONE")
            case "subroutine":
                print("EXEC SUBROUTINE", action.description)
                self.return_stack.append(self.nodes[action.to])
                self.curr = self.nodes[action.subroutine]
            case _:
                raise NotImplementedError()

        res = await self.__check(action, action.postcondition)
        if res != CheckResult.PASS:
            print("! ! X postcheck fail")
            return

        if action.WhichOneof("action") != "subroutine":
            # need to skip when subroutine runs
            # the next shouldn't get set immediately, but stored on stack
            # until after the subroutine completes
            self.curr = self.nodes[action.to]

    async def run_replay(self, replay: InputReplay):
        """
        simulate a replay in terms of controller calls
        """
        t0 = now()
        for e in replay.events:
            t1 = t0 + e.timestamp
            await sleep(t1 - now())
            match e.WhichOneof("type"):
                case "move":
                    await self.controller.mouse_move(e.move.x, e.move.y)
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
