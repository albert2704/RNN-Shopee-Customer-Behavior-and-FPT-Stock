"""Manually manage the local website/API for this macOS login session.

Run from models/: python -m chat.local_site start|status|stop
Jobs are loaded from the ignored daily/runtime/services directory, never from
LaunchAgents. They do not start at login/boot or restart automatically. Logs stay
in that directory; credentials continue to be read by the API from models/.env.
"""

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import stat
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "models"
RUNTIME = MODELS / "daily/runtime/services"
DOMAIN = f"gui/{os.getuid()}"
PREFIX = "local.assignment6." + hashlib.sha256(str(ROOT).encode()).hexdigest()[:12]
LAUNCHCTL = "/bin/launchctl"
LSOF = "/usr/sbin/lsof"
PS = "/bin/ps"
STATUS_KEYS = ("ready", "api_key_configured", "graph_connected", "data_available")


class ServiceError(Exception):
    """A deliberately credential-free operational message."""


@dataclass(frozen=True)
class Service:
    name: str
    port: int
    cwd: Path
    arguments: tuple[str, ...]

    @property
    def label(self):
        return f"{PREFIX}.{self.name}"

    @property
    def target(self):
        return f"{DOMAIN}/{self.label}"

    @property
    def plist_path(self):
        return RUNTIME / f"{self.name}.plist"

    def definition(self):
        return {
            "Label": self.label,
            "ProgramArguments": list(self.arguments),
            "WorkingDirectory": str(self.cwd),
            "RunAtLoad": False,
            "KeepAlive": False,
            "StandardOutPath": str(RUNTIME / f"{self.name}.stdout.log"),
            "StandardErrorPath": str(RUNTIME / f"{self.name}.stderr.log"),
            "Umask": 0o077,
        }


def services():
    node = shutil.which("node")
    if not node:
        raise ServiceError("Node.js is not available on PATH.")
    # Do not resolve the Python symlink: its venv path selects the dependencies.
    return (
        Service(
            "api",
            8006,
            MODELS,
            (str(MODELS / ".venv/bin/python"), "-u", "-m", "daily.api"),
        ),
        Service(
            "website",
            4173,
            ROOT / "website",
            (
                node,
                str(ROOT / "website/node_modules/vite/bin/vite.js"),
                "preview",
                "--host",
                "127.0.0.1",
                "--port",
                "4173",
                "--strictPort",
            ),
        ),
    )


def run(arguments, *, timeout=5, cwd=None):
    try:
        return subprocess.run(
            arguments,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ServiceError(
            "A local service-management command could not complete."
        ) from error


def check_session():
    if sys.platform != "darwin":
        raise ServiceError("This helper requires macOS.")
    if run([LAUNCHCTL, "print", DOMAIN]).returncode:
        raise ServiceError("Cannot access the current macOS GUI login session.")


def listeners(port):
    result = run([LSOF, "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"])
    if (
        result.returncode == 1
        and not result.stdout.strip()
        and not result.stderr.strip()
    ):
        return set()
    lines = result.stdout.splitlines()
    if result.returncode or not lines or any(not line.isdigit() for line in lines):
        raise ServiceError(f"Could not inspect listeners on port {port}.")
    return {int(line) for line in lines}


def saved_definition_matches(service):
    try:
        path = service.plist_path
        info = path.lstat()
        if (
            not stat.S_ISREG(info.st_mode)
            or info.st_uid != os.getuid()
            or info.st_mode & 0o022
        ):
            return False
        return plistlib.loads(path.read_bytes()) == service.definition()
    except (OSError, ValueError, plistlib.InvalidFileException):
        return False


def job_field(output, name):
    # launchctl print is diagnostic output, not a stable API. Parse only the
    # current top-level format and fail closed if it changes or is ambiguous.
    values = re.findall(r"^\t" + re.escape(name) + r" = (.+)$", output, re.MULTILINE)
    return values[0] if len(values) == 1 else None


def inspect(service):
    result = run([LAUNCHCTL, "print", service.target])
    if result.returncode:
        if "Could not find service" in result.stderr:
            return {"registered": False, "owned": False, "pid": None}
        raise ServiceError(f"Could not inspect the {service.name} service.")
    output = result.stdout
    pid_text = job_field(output, "pid")
    pid = int(pid_text) if pid_text and pid_text.isdigit() else None
    arguments = re.findall(
        r"^\targuments = \{\n(.*?)^\t\}", output, re.MULTILINE | re.DOTALL
    )
    actual_arguments = (
        [line.strip() for line in arguments[0].splitlines()]
        if len(arguments) == 1
        else []
    )
    owned = (
        saved_definition_matches(service)
        and job_field(output, "path") == str(service.plist_path)
        and job_field(output, "program") == service.arguments[0]
        and job_field(output, "working directory") == str(service.cwd)
        and actual_arguments == list(service.arguments)
    )
    if owned and pid:
        process = run([PS, "-p", str(pid), "-o", "command="])
        expected = {" ".join(service.arguments)}
        expected.add(
            " ".join(
                (str(Path(service.arguments[0]).resolve()), *service.arguments[1:])
            )
        )
        owned = process.returncode == 0 and process.stdout.strip() in expected
    return {"registered": True, "owned": bool(owned), "pid": pid}


def snapshot(service):
    job = inspect(service)
    pids = listeners(service.port)
    return {
        **job,
        "running": bool(job["owned"] and job["pid"]),
        "port_in_use": bool(pids),
        "listener_pids": sorted(pids),
        "port_owned": bool(job["owned"] and job["pid"] and pids == {job["pid"]}),
    }


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise HTTPError(req.full_url, code, "Redirect refused", headers, fp)


def probe(port, timeout=6):
    """Only request the status API; never fetch pages, follow redirects or proxy."""
    try:
        opener = build_opener(ProxyHandler({}), NoRedirect())
        with opener.open(
            f"http://127.0.0.1:{port}/api/chat/status", timeout=timeout
        ) as response:
            if response.status != 200:
                return None
            raw = response.read(16385)
        if len(raw) > 16384:
            return None
        body = json.loads(raw)
        if not isinstance(body, dict) or any(
            type(body.get(key)) is not bool for key in STATUS_KEYS
        ):
            return None
        return {key: body[key] for key in STATUS_KEYS}
    except (OSError, URLError, ValueError):
        return None


def status(specs, *, timeout=6):
    states = {service.name: snapshot(service) for service in specs}
    direct = probe(8006, timeout) if states["api"]["port_owned"] else None
    proxied = probe(4173, timeout) if states["website"]["port_owned"] else None
    return {
        **states,
        "api_reachable": direct is not None,
        "proxy_reachable": proxied is not None,
        "chat": direct or {key: None for key in STATUS_KEYS},
    }


def preflight(specs):
    for service in specs:
        if not Path(service.arguments[0]).is_file() or not os.access(
            service.arguments[0], os.X_OK
        ):
            raise ServiceError(f"The {service.name} executable is unavailable.")
    if not (ROOT / "website/node_modules/vite/bin/vite.js").is_file():
        raise ServiceError("Website dependencies are missing. Run npm ci in website/.")
    if not (ROOT / "website/dist/index.html").is_file():
        raise ServiceError(
            "The website build is missing. Run npm run build in website/."
        )
    dependencies = run(
        [
            specs[0].arguments[0],
            "-c",
            "import importlib.util,sys; "
            "sys.exit(any(importlib.util.find_spec(n) is None for n in "
            "['fastapi','uvicorn','neo4j','openai','dotenv','torch','numpy','pandas','vnstock','vnai']))",
        ],
        cwd=MODELS,
        timeout=15,
    )
    if dependencies.returncode:
        raise ServiceError(
            "Python dependencies are missing. Install chat/requirements.txt in models/.venv."
        )
    states = {service.name: snapshot(service) for service in specs}
    for service in specs:
        state = states[service.name]
        if state["registered"] and not state["owned"]:
            raise ServiceError(
                f"The {service.name} label is not a verified owned job; left unchanged."
            )
        if state["port_in_use"] and not state["port_owned"]:
            raise ServiceError(
                f"Port {service.port} is occupied by an unmanaged process; left unchanged."
            )
        if service.plist_path.exists() and not saved_definition_matches(service):
            raise ServiceError(
                f"The saved {service.name} job definition differs; left unchanged."
            )
    return states


def prepare_directory():
    if RUNTIME.is_symlink() or RUNTIME.resolve() != RUNTIME:
        raise ServiceError("The service runtime directory must not be a symlink.")
    RUNTIME.mkdir(mode=0o700, parents=True, exist_ok=True)
    if RUNTIME.stat().st_uid != os.getuid():
        raise ServiceError("The service runtime directory belongs to another user.")
    RUNTIME.chmod(0o700)


def write_definition(service):
    if service.plist_path.exists():
        return  # preflight already checked its exact contents and ownership.
    descriptor = os.open(
        service.plist_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600
    )
    with os.fdopen(descriptor, "wb") as handle:
        plistlib.dump(service.definition(), handle)


def unload(service):
    state = inspect(service)
    if not state["registered"]:
        return
    if not state["owned"]:
        raise ServiceError(f"Refusing to stop the unverified {service.name} job.")
    if run([LAUNCHCTL, "bootout", service.target]).returncode:
        raise ServiceError(f"Could not unload the {service.name} job.")


def start(specs):
    before = preflight(specs)  # Check both services before starting either one.
    prepare_directory()
    changed = []
    try:
        for service in specs:
            previous = before[service.name]
            if previous["running"]:
                continue
            write_definition(service)
            if not previous["registered"]:
                if run(
                    [LAUNCHCTL, "bootstrap", DOMAIN, str(service.plist_path)]
                ).returncode:
                    raise ServiceError(f"Could not register the {service.name} job.")
            changed.append(service)
            if run([LAUNCHCTL, "kickstart", "-p", service.target]).returncode:
                raise ServiceError(f"Could not start the {service.name} job.")
        deadline = time.monotonic() + 25
        while time.monotonic() < deadline:
            current = status(
                specs, timeout=min(6, max(0.1, (deadline - time.monotonic()) / 2))
            )
            if current["api_reachable"] and current["proxy_reachable"]:
                return current
            time.sleep(0.3)
        raise ServiceError("Local services did not become reachable in time.")
    except BaseException:
        # Preserve pre-existing running jobs. Only roll back jobs this call started.
        for service in reversed(changed):
            try:
                unload(service)
            except ServiceError:
                pass
        raise


def stop(specs):
    # Verify both labels before mutating either; never stop by name or port.
    for service in specs:
        state = inspect(service)
        if state["registered"] and not state["owned"]:
            raise ServiceError(f"Refusing to stop the unverified {service.name} job.")
    for service in reversed(specs):
        unload(service)
    return status(specs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("start", "status", "stop"))
    arguments = parser.parse_args()
    try:
        check_session()
        specs = services()
        result = {"start": start, "status": status, "stop": stop}[arguments.action](
            specs
        )
        print(json.dumps(result, indent=2))
    except (ServiceError, OSError, ValueError) as error:
        message = (
            str(error)
            if isinstance(error, ServiceError)
            else "Local service operation failed."
        )
        print(message + " Logs: models/daily/runtime/services/*.log", file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
