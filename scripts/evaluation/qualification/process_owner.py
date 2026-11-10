"""Own one local qualification subprocess and its Linux descendants."""
import ctypes
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def process_table():
    rows = {}
    for name in os.listdir('/proc'):
        if not name.isdigit():
            continue
        try:
            fields = (Path('/proc') / name / 'stat').read_text().rsplit(') ', 1)[1].split()
            rows[int(name)] = (int(fields[1]), fields[0], fields[19])
        except InterruptedError:
            # A signal handler can interrupt /proc inspection. It is control
            # flow, not a disappearing-process read error to suppress.
            raise
        except (OSError, IndexError, ValueError):
            continue
    return rows


class ProcessOwner:
    def __init__(self):
        # Adopt detached grandchildren if an intermediate process exits.
        # Never find or stop processes by command-name substring.
        if sys.platform != 'linux':
            raise RuntimeError('Qualification process ownership requires Linux')
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
            raise OSError(ctypes.get_errno(), 'Cannot own orphaned qualification descendants')
        self.pid = os.getpid()
        self.child = None
        self.identities = {}

    def start(self, command, **options):
        self.child = subprocess.Popen(command, **options)
        self.refresh()
        return self.child

    def refresh(self):
        table = process_table()
        family = {self.pid}
        while True:
            found = {pid for pid, (parent, _, _) in table.items() if parent in family}
            if found <= family:
                break
            family.update(found)
        for pid in family - {self.pid}:
            if pid in table:
                self.identities[pid] = table[pid][2]
        # Let Popen reap its direct child so the actual return code survives.
        if self.child is not None:
            self.child.poll()
        for pid, (parent, state, start) in table.items():
            if (parent == self.pid and state == 'Z' and self.identities.get(pid) == start
                    and (self.child is None or pid != self.child.pid)):
                try:
                    os.waitpid(pid, os.WNOHANG)
                except ChildProcessError:
                    pass
        return {pid: start for pid, (_, state, start) in table.items()
                if self.identities.get(pid) == start and state != 'Z'}

    def send(self, identities, signum):
        current = process_table()
        for pid, started in identities.items():
            # Start-time identity prevents killing a reused PID.
            if pid in current and current[pid][2] == started and pid != self.pid:
                try:
                    os.kill(pid, signum)
                except ProcessLookupError:
                    pass

    def stop(self, signum=signal.SIGTERM, grace=1.0):
        signalled = set()
        deadline = time.monotonic() + grace
        while True:
            active = self.refresh()
            if not active:
                return True
            new = {pid: start for pid, start in active.items() if (pid, start) not in signalled}
            self.send(new, signum)
            signalled.update(new.items())
            if time.monotonic() >= deadline:
                break
            time.sleep(0.02)
        # Also catch descendants born during graceful shutdown.
        deadline = time.monotonic() + 1.0
        while time.monotonic() < deadline:
            active = self.refresh()
            if not active:
                return True
            self.send(active, signal.SIGKILL)
            time.sleep(0.02)
        return not self.refresh()
