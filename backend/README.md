Installing protobuf from the proto folder (no idea if this is a good practice or not)
```sh
pip install -r requirements.txt # real packages
pip install -r requirements.pb.txt # passes flags to do a local install
pip install -e . # install self; makes main.py / runtime.py runnable
```
