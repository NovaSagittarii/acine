"""
Temporary scripts used to handle breaking changes when changing the protobufs.
"""

# import json

# from acine_proto_dist.routine_pb2 import Routine
# from google.protobuf.json_format import MessageToDict, ParseDict
# from persist import fs_read_sync as fs_read
# from persist import fs_write_sync as fs_write

# Step 1: convert to json (in old proto)
# routine = Routine.FromString(fs_read(["ort.pb"]))
# d = MessageToDict(routine)
# fs_write(["rtpb.json"], json.dumps(d).encode())

# Step 2: json back to pb (in new proto)
# d = json.loads(fs_read(["rtpb.json"]))
# msg = ParseDict(d, Routine())
# ctx = 0
# for n in msg.nodes:
#     for e in n.edges:
#         e.id = str(ctx)
#         ctx += 1
# print(msg)
# fs_write(["rt.pb"], msg.SerializeToString())
