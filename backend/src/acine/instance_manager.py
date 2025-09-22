"""
Helper functions to deal with multiple routine instances.

When run as main, creates `test-routine` and prints ids of stored routines.
"""

import os
from uuid import uuid4

from acine_proto_dist.routine_pb2 import Routine
from acine_proto_dist.runtime_pb2 import RuntimeData

from acine.persist import (
    PrefixedFilesystem,
    fs_read_sync,
    fs_write_sync,
    mkdir,
    resolve,
)

testenv_file = os.path.realpath(
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),  # /backend/src/acine
        "..",  # /backend/src/
        "..",  # /backend
        "..",  # /
        "testenv",  # /testenv
        "main.py",  # /testenv/main.py
    )
)
testenv_cmd = f"start pythonw {testenv_file}"


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
        start_command=testenv_cmd,
        window_name="TestEnv",
        nodes={
            "start": Routine.Node(
                id="start", name="start", type=Routine.Node.NODE_TYPE_STANDARD
            )
        },
    )
    mkdir([id])
    fs_write_sync([id, "rt.pb"], r.SerializeToString())
    fs_write_sync([id, "archive.7z"], RuntimeData(id=routine.id).SerializeToString())
    mkdir([id, "tmp"])
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


def get_runtime_data(routine: Routine) -> RuntimeData:
    """gets routine runtime_data from filesystem"""
    assert validate_routine(routine)
    if os.path.exists(resolve(routine.id, "runtimedata.pb")):
        return RuntimeData.FromString(fs_read_sync([routine.id, "runtimedata.pb"]))
    else:
        return RuntimeData(id=routine.id)


def write_runtime_data(routine: Routine, data: RuntimeData) -> None:
    assert validate_routine(routine)
    fs_write_sync([routine.id, "runtimedata.pb"], data.SerializeToString())


def get_pfs(routine: Routine) -> PrefixedFilesystem:
    assert validate_routine(routine)
    return PrefixedFilesystem([routine.id])


if __name__ == "__main__":
    r = Routine(name="Test Routine", window_name="TestEnv")
    create_routine(r, "00000000-0000-1000-a727-000000000000")
    print(get_routines())
    assert validate_routine(r)
