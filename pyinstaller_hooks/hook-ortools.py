from PyInstaller.utils.hooks import collect_dynamic_libs


# OR-Tools loads native solver libraries from ``ortools/.libs`` at import time.
binaries = collect_dynamic_libs("ortools", destdir="ortools/.libs")
