#!/usr/bin/env python3
"""Run the original-asset fetcher independently of a terminal, with bounded resume."""

import argparse
import datetime
import fcntl
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOCK = ROOT / '.download-runner.lock'
STATE = ROOT / 'download-job.json'
PID = ROOT / 'download.pid'
LOG = ROOT / 'download-job.log'
MAX_SECONDS = 6 * 60 * 60
MAX_RUNS = 9  # Initial run plus at most eight resumptions.
STOP = False


def utc(timestamp=None):
    return datetime.datetime.fromtimestamp(timestamp or time.time(), datetime.timezone.utc).isoformat()


def read_json(path):
    try:
        return json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save(state, **changes):
    state.update(changes)
    state['updated_at'] = utc()
    state['downloaded_files'] = len(list(ROOT.glob('*.svg')))
    temporary = STATE.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(state, indent=2) + '\n')
    temporary.replace(STATE)


def active_pid():
    with LOCK.open('a+') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            handle.seek(0)
            return int(handle.read().strip() or '0')
    return None


def stop_signal(_number, _frame):
    global STOP
    STOP = True


def next_interval(interval):
    return 90 if interval < 90 else 120


def wait_until(target, deadline):
    while not STOP and time.time() < min(target, deadline):
        time.sleep(max(0, min(2, min(target, deadline) - time.time())))
    return not STOP and time.time() < deadline


def run_child(arguments, state, deadline):
    child = subprocess.Popen([sys.executable, str(ROOT / 'fetch-deck.py'), *arguments], cwd=ROOT)
    save(state, child_pid=child.pid)
    while child.poll() is None and not STOP and time.time() < deadline:
        save(state)
        time.sleep(2)
    if child.poll() is None:
        child.terminate()
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            child.kill()
    result = child.wait()
    save(state, child_pid=None, last_exit_code=result)
    return result


def run():
    global STOP
    STOP = False
    with LOCK.open('a+') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another deck download job already holds the lock.', flush=True)
            return 0
        handle.seek(0)
        handle.truncate()
        handle.write(str(os.getpid()))
        handle.flush()
        PID.write_text(str(os.getpid()) + '\n')
        previous = read_json(STATE)
        interval = max(60, min(120, previous.get('interval_seconds', 60)))
        deadline = time.time() + MAX_SECONDS
        state = {'pid': os.getpid(), 'status': 'starting', 'started_at': utc(),
                 'deadline': utc(deadline), 'max_runs': MAX_RUNS, 'runs_started': 0,
                 'interval_seconds': interval, 'expected_files': 79,
                 'log': str(LOG), 'manifest': str(ROOT / 'manifest.json')}
        signal.signal(signal.SIGTERM, stop_signal)
        signal.signal(signal.SIGINT, stop_signal)
        save(state)
        print(f'{utc()} Started asset completion job {os.getpid()}.', flush=True)
        try:
            for attempt in range(1, MAX_RUNS + 1):
                retry_at = read_json(ROOT / 'download-status.json').get('retry_at_unix', 0)
                if retry_at > time.time():
                    save(state, status='waiting-for-source', next_request_not_before=utc(retry_at + 1))
                    if not wait_until(retry_at + 1, deadline):
                        break
                if STOP or time.time() >= deadline:
                    break
                save(state, status='downloading', runs_started=attempt,
                     interval_seconds=interval, next_request_not_before=None)
                print(f'{utc()} Run {attempt}/{MAX_RUNS}; {interval}s between files.', flush=True)
                code = run_child(['--interval', str(interval)], state, deadline)
                if STOP or time.time() >= deadline:
                    break
                manifest = read_json(ROOT / 'manifest.json')
                if code == 0 and manifest.get('all_files_present'):
                    save(state, status='verifying')
                    verified = run_child(['--verify-only'], state, deadline)
                    if STOP or time.time() >= deadline:
                        break
                    manifest = read_json(ROOT / 'manifest.json')
                    if verified == 0 and manifest.get('all_safe_for_image_use'):
                        result = {key: manifest[key] for key in ('file_count', 'total_bytes', 'all_files_present', 'all_xml_parse', 'all_safe_for_image_use')}
                        save(state, status='complete', completed_at=utc(), result=result)
                        print(f'{utc()} Complete: {json.dumps(result)}', flush=True)
                        return 0
                    save(state, status='failed', error='Final offline verification failed; inspect manifest and log.')
                    return 1
                retry_at = read_json(ROOT / 'download-status.json').get('retry_at_unix', 0)
                if retry_at > time.time():
                    interval = next_interval(interval)
                    save(state, interval_seconds=interval)
                elif attempt < MAX_RUNS:
                    save(state, status='waiting-to-retry', next_request_not_before=utc(time.time() + 120))
                    if not wait_until(time.time() + 120, deadline):
                        break
            reason = 'Stopped by request.' if STOP else 'Six-hour or eight-resumption limit reached before completion.'
            save(state, status='stopped' if STOP else 'incomplete', error=reason, finished_at=utc())
            print(f'{utc()} {reason}', flush=True)
            return 1
        except Exception as error:
            save(state, status='failed', error=f'{type(error).__name__}: {error}', finished_at=utc())
            print(f'{utc()} Failed: {type(error).__name__}: {error}', flush=True)
            return 1
        finally:
            PID.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'status', 'stop', '_run'])
    args = parser.parse_args()
    if args.action == '_run':
        return run()
    pid = active_pid()
    if args.action == 'status':
        state = read_json(STATE)
        state['active_pid'] = pid
        state['downloaded_files'] = len(list(ROOT.glob('*.svg')))
        print(json.dumps(state, indent=2))
        return 0
    if args.action == 'stop':
        if pid:
            os.kill(pid, signal.SIGTERM)
            print(f'Stop requested for asset job {pid}; verified originals will remain.')
        else:
            print('No active asset download job.')
        return 0
    if pid:
        print(f'Asset download job {pid} is already running; no duplicate started.')
        return 0
    with LOG.open('a') as log:
        child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '_run'],
                                 cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                 start_new_session=True)
    for _ in range(20):
        if active_pid() or child.poll() is not None:
            break
        time.sleep(0.1)
    print(json.dumps({'pid': active_pid(), 'state': str(STATE), 'log': str(LOG)}))
    return 0 if active_pid() else 1


if __name__ == '__main__':
    raise SystemExit(main())
