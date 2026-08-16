import asyncio
import functools
import logging
import os
import signal
import sys
from concurrent.futures import ThreadPoolExecutor

import logger  # Import the logger module
import activity_stats
import diagnostics
import requests
import setup
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

# Global variables
app = FastAPI()
thread_pool = ThreadPoolExecutor(max_workers=10)
shutdown_event = asyncio.Event()
active_server = None
active_port = 8000

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_in_threadpool(func):
    """Decorator to run a function in a thread pool"""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        if shutdown_event.is_set():
            logging.warning("Server is shutting down, rejecting new requests")
            raise RuntimeError("Server is shutting down")

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            thread_pool, functools.partial(func, *args, **kwargs)
        )

    return wrapper


# Shutdown handler that properly cleans up resources
async def shutdown():
    logging.info("Initiating graceful shutdown")

    # Set shutdown event to prevent new requests
    shutdown_event.set()

    # Wait for active tasks to complete (with a timeout)
    logging.info("Waiting for active tasks to complete")
    try:
        # Give active tasks up to 5 seconds to complete
        await asyncio.wait_for(asyncio.sleep(2), timeout=5)
    except asyncio.TimeoutError:
        logging.warning("Some tasks didn't complete in time")

    # Don't wait for all tasks - faster shutdown for reloads
    thread_pool.shutdown(wait=False)

    # Force terminate the process
    import os

    logging.critical(f"Killing {os.getpid()} - process will terminate immediately")
    os.kill(os.getpid(), signal.SIGTERM)


# Register the shutdown handler
@app.on_event("shutdown")
async def app_shutdown():
    await shutdown()


# Synchronous function that will be run in a thread
def get_logs():
    # Return the logs from the shared module
    return {"logs": logger.solver_logs}


@app.get("/solver-logs")
async def get_solver_logs():
    # Run the blocking operation in a separate thread
    return await run_in_threadpool(get_logs)()


@app.get("/diagnostics")
async def get_diagnostics():
    return {
        "items": diagnostics.diagnostics_for_logs(logger.solver_logs),
        "stop_alert": diagnostics.latest_sbc_stop_alert(logger.solver_logs),
    }


@app.get("/stats")
async def get_activity_stats():
    return await run_in_threadpool(activity_stats.get_stats)()


@app.post("/stats/sbc-event")
async def record_sbc_event(request: Request):
    from fastapi import HTTPException

    try:
        event = await request.json()
        return await run_in_threadpool(activity_stats.record_event)(event)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/stats/ea-snapshot")
async def record_ea_sbc_snapshot(request: Request):
    from fastapi import HTTPException

    try:
        snapshot = await request.json()
        return await run_in_threadpool(activity_stats.record_ea_snapshot)(snapshot)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/diagnostics/client-event")
async def record_client_diagnostic(request: Request):
    from fastapi import HTTPException

    body = await request.json()
    code = str(body.get("code") or "").strip()[:80]
    message = str(body.get("message") or "").strip()[:1000]
    if not code or not message:
        raise HTTPException(status_code=400, detail="code and message are required")
    logger.add_log(f"WEB_CLIENT {code}: {message}")
    return {"accepted": True}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "fcx-backend",
        "port": active_port,
        "instance": os.getenv("FCX_GUI_INSTANCE_TOKEN", ""),
        "solver_features": {
            "strict_rating_window": 1,
            "minimum_rating_first": 2,
            "sbc_activity_stats": 1,
            "natural_diagnostics": 1,
            "offline_activity_sync": 1,
            "ea_completion_snapshot": 1,
            "sbc_stop_alert": 1,
        },
    }


@app.post("/shutdown")
async def request_shutdown(request: Request):
    """Allow only the parent GUI process to request a local shutdown."""
    expected = os.getenv("FCX_GUI_SHUTDOWN_TOKEN", "")
    supplied = request.headers.get("x-fcx-shutdown-token", "")
    client_host = request.client.host if request.client else ""
    if not expected or supplied != expected or client_host not in {"127.0.0.1", "::1"}:
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Shutdown is available only to the local GUI")
    if active_server is not None:
        active_server.should_exit = True
    return {"status": "stopping"}


# Synchronous function that will be run in a thread
def process_solve_request(request_data):
    # Use the globals module
    logger.clear_logs()  # Clear previous logs
    logger.add_log("SBC Solver started in thread")

    sbcData = request_data["sbcData"]
    clubPlayers = request_data["clubPlayers"]
    maxSolveTime = request_data["maxSolveTime"]

    # Log received data
    logger.add_log(f"Processing {len(clubPlayers)} players, max time: {maxSolveTime}s")

    try:
        result = setup.runAutoSBC(sbcData, clubPlayers, maxSolveTime)

        # Log completion
        logger.add_log("Solver thread completed successfully")

        return result
    except Exception as e:
        # Log errors
        logger.add_log(f"Error in solver thread: {str(e)}")
        raise e


@app.post("/solve")
async def get_body(request: Request):
    # Parse the request data and clear logs on new solve
    request_data = await request.json()
    logger.clear_logs()  # Clear previous logs

    # Run the CPU-intensive task in a thread pool
    result = await run_in_threadpool(process_solve_request)(request_data)
    return result


# Add endpoint to clear logs in a separate thread
def clear_logs_handler():
    logger.clear_logs()
    return {"status": "success"}


@app.post("/clear-logs")
async def clear_solver_logs():
    return await run_in_threadpool(clear_logs_handler)()


def process_relay_request(body):
    logging.info("Received relay request")
    logging.debug("Relay request data: %s", body)
    url = body.get("url")
    method = body.get("method", "GET").upper()
    headers = body.get("headers", {})
    data = body.get("data", None)
    resp = requests.request(method, url, headers=headers, data=data)
    logging.info(f"Relay request completed with {url} {resp.text}")
    return {"status": resp.status_code, "responseText": resp.text}


@app.post("/relay")
async def relay(request: Request):
    body = await request.json()
    # forward the HTTP call to threadpool so it doesn't block the event loop
    # return await run_in_threadpool(process_relay_request)(body)
    return {"data": []}  # Placeholder for relay functionality


def start(port: int = 8000):
    """Start the server using the uvicorn runner with proper signal handling"""
    global active_server, active_port
    if not 1024 <= int(port) <= 65535:
        raise ValueError("port must be between 1024 and 65535")
    active_port = int(port)
    config = uvicorn.Config(
        app, host="127.0.0.1", port=active_port, log_level="info", reload=False, workers=1
    )

    server = uvicorn.Server(config)
    active_server = server

    # Override the server's signal handlers with our own
    server.install_signal_handlers = lambda: None

    # Define our own signal handlers
    def handle_exit(signum, frame):
        logging.info(f"Received exit signal {signum}")
        # Tell the server to exit
        server.should_exit = True

    # Register our signal handlers
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Start the server
    logging.info("Starting server...")
    try:
        server.run()
        logging.info("Server stopped")
    finally:
        active_server = None


if __name__ == "__main__":
    try:
        start()
    except KeyboardInterrupt:
        logging.info("Keyboard interrupt received")
    except Exception as e:
        logging.error(f"Error starting server: {str(e)}")
    finally:
        # Ensure thread pool is always shut down
        if thread_pool:
            thread_pool.shutdown(wait=False)
        logging.info("Application terminated")
    sys.exit(0)
