All the persistent screenshot data goes over here.

- `/data`
  - `[routine_id]`
    - `archive.7z` compressed form of screenshots related to runtime logs
    - `rt.pb` routine proto file with metadata (no frame data)
    - `runtimedata.pb` runtime logs
    - `time` seconds spend while running
    - `img` image folder
      - `[frame_id].png` individual frame

Frames exist as separate files so filesystem cache can do its thing and easier
to view individual frames with local image viewer application.
