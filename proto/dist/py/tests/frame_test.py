from acine_proto_dist.frame_pb2 import Frame


def test_frame_init():
    """
    ensure methods exist and work properly (able to build)
    """
    dat = b"1234"

    f = Frame()
    f.data = dat
    assert f.data == dat

    fd = Frame.SerializeToString(f)
    g = Frame()
    Frame.ParseFromString(g, fd)
    assert f.data == g.data
