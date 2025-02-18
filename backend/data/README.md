All the persistent screenshot data goes over here.

ID system is based on the assumptions that:

- Application used in the years 1970 (unix epoch) through 144000.
  - Uses int64 to represent, but JS has max safe int (double).
- No two screenshots are taken in the same millisecond.
  - ID _is_ ms since epoch.
