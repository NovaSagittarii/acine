"""
Helper functions to deal with multiple routine instances.

When run as main, creates `test-routine` and prints ids of stored routines.
"""

import os
from uuid import uuid4

from acine.persist import fs_read_sync, fs_write_sync, mkdir, resolve
from acine_proto_dist.routine_pb2 import Routine


def create_routine(routine: Routine, id=str(uuid4())) -> Routine:
    """creates files for new routine in /data, returns the newly created routine"""

    assert (
        routine.window_name
    ), "Window name should exist. Desktop currently not supported."
    assert routine.name, "Name should exist. Otherwise cannot differentiate."

    r = Routine(
        id=id,
        name=routine.name,
        description=routine.description,
        start_command=routine.start_command,
        window_name=routine.window_name,
        nodes=[
            Routine.Node(id="init", name="start", type=Routine.Node.NODE_TYPE_STANDARD)
        ],
    )
    mkdir([id])
    fs_write_sync([id, "rt.pb"], r.SerializeToString())
    mkdir([id, "img"])
    return r


def get_routines(full=False) -> list[Routine]:
    """lists all routines available with minimal metadata (name,id,description)"""

    out = []
    for f in os.listdir(resolve()):
        if "-" not in f:  # not a uuidv4
            continue
        if os.path.isfile(resolve(f)):
            continue
        r = Routine.FromString(fs_read_sync([f, "rt.pb"]))
        if not full:
            r = Routine(
                id=r.id,
                name=r.name,
                description=r.description,
                start_command=r.start_command,
                window_name=r.window_name,
            )
        out.append(r)
    return sorted(out, key=lambda x: x.name)


def validate_routine(routine: Routine) -> bool:
    """returns True if the routine is valid (exists in filesystem)"""
    try:
        assert os.path.exists(resolve(routine.id, "rt.pb"))
        assert os.path.exists(resolve(routine.id, "img"))
    except AssertionError:
        return False
    return True


def get_routine(routine: Routine) -> Routine:
    """gets full routine metadata from filesystem"""
    assert validate_routine(routine)
    return Routine.FromString(fs_read_sync([routine.id, "rt.pb"]))


if __name__ == "__main__":
    r = Routine(name="Test Routine", window_name="TestEnv")
    create_routine(r, "00000000-0000-1000-a727-000000000000")
    print(get_routines())
    assert validate_routine(r)
