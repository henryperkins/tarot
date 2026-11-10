#!/usr/bin/env python3
"""Run one qualification command with a reservation and terminal receipt.

Usage: run-check.py EVIDENCE_ROOT LABEL CWD COMMAND [ARG ...]
This supervisor does not authorize provider calls or replace inner gates.
"""
import datetime
import json
import os
from pathlib import Path
import re
import signal
import sys
import time

sys.dont_write_bytecode = True
from process_owner import ProcessOwner


def main():
    root, label, cwd, *command = sys.argv[1:]
    root = Path(root).resolve()
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]*', label) or not command:
        raise ValueError('A safe label and explicit command are required')
    root.mkdir(parents=True, exist_ok=True)
    # Reserve before opening logs or starting a child. An interrupted attempt
    # never becomes a retry, even if SIGKILL prevented its terminal receipt.
    if any((root / (label + suffix)).exists() for suffix in ['.json', '.log']):
        raise FileExistsError('Qualification output already exists; no automatic retry')
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    env = {k: v for k, v in os.environ.items() if k in {
        'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'TERM',
        'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME',
    }}
    env.update(OTEL_SDK_DISABLED='true', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC='1')
    interrupted = []
    owner = None
    child = None
    failure = None
    return_code = 1
    cleanup_complete = True
    reserved = False
    t0 = time.monotonic()

    def on_signal(signum, _frame):
        interrupted.append(signum)

    for sig in [signal.SIGINT, signal.SIGTERM]:
        signal.signal(sig, on_signal)
    try:
        # Handlers only record signals during the reservation transaction, so
        # a signal after open succeeds cannot skip ownership or the finalizer.
        with (root / (label + '-reservation.json')).open('x') as f:
            reserved = True
            json.dump({'pid': os.getpid(), 'startedAt': started, 'retryAllowed': False}, f)
            f.flush()
            os.fsync(f.fileno())
        owner = ProcessOwner()
        with (root / (label + '.log')).open('x') as log:
            if interrupted:
                raise InterruptedError('Interrupted before child startup')
            child = owner.start(command, cwd=cwd, env=env, stdout=log,
                                stderr=log, start_new_session=True)
            while child.poll() is None:
                owner.refresh()
                if interrupted:
                    break
                time.sleep(0.02)
            if child.returncode is not None:
                return_code = child.returncode
    except BaseException as error:
        failure = type(error).__name__
        if not reserved:
            print(f'No attempt started: {failure}: {error}', file=sys.stderr)
    finally:
        if owner is not None:
            cleanup_complete = owner.stop(interrupted[0] if interrupted else signal.SIGTERM,
                                          grace=2.0)
        if interrupted:
            return_code = 128 + interrupted[0]
        elif return_code < 0:
            return_code = 128 - return_code
        if not cleanup_complete:
            return_code = return_code or 1
            failure = failure or 'descendant_cleanup_incomplete'
        if reserved:
            receipt = {
                'label': label, 'cwd': cwd, 'command': command, 'started_at': started,
                'elapsed_seconds': round(time.monotonic() - t0, 2), 'exit_code': return_code,
                'childExitCode': child.returncode if child is not None else None,
                'log': str(root / (label + '.log')), 'interruptedBySignals': interrupted,
                'launcherFailure': failure, 'cleanupComplete': cleanup_complete,
                'environment': 'minimal shell environment without provider credentials',
                'automaticRetries': False,
            }
            temporary = root / (label + '-receipt.tmp')
            with temporary.open('x') as f:
                json.dump(receipt, f, indent=2)
                f.write('\n')
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary, root / (label + '.json'))
    if not reserved:
        return return_code
    try:
        print(json.dumps(receipt), flush=True)
    except BrokenPipeError:
        # The receipt remains durable when the outer observer goes away.
        fd = os.open(os.devnull, os.O_WRONLY)
        os.dup2(fd, sys.stdout.fileno())
        os.close(fd)
    return return_code


if __name__ == '__main__':
    sys.exit(main())
