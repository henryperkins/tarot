#!/usr/bin/env python3
"""Transparent, single-attempt qualification transport archive; no inference changes.

Usage: capture-claude.py EVIDENCE_ROOT MODE KEY [CLAUDE ARGS...]
Requires an independently authorized, frozen evidence root. Does not clear halts.
"""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import signal
import subprocess
import sys
import time

sys.dont_write_bytecode = True
from process_owner import ProcessOwner


def digest(value):
    return hashlib.sha256(value).hexdigest()


def main():
    root, mode, key, *args = sys.argv[1:]
    root = Path(root).resolve()
    config = json.loads((root / 'standard-transport.json').read_text())
    assert mode in ['standard', 'semantic']
    real = config['realClaudeExecutable']
    assert Path(real).resolve() != Path(__file__).resolve()
    if '-p' not in args:
        os.execv(real, [real, *args])

    def option(name):
        return args[args.index(name) + 1]

    assert not (root / 'manual-review-halt.json').exists(), 'Content review halted dispatch'
    assert option('--model') == config['model']
    assert option('--effort') == config['effort']
    assert os.environ.get('CLAUDE_CODE_MAX_OUTPUT_TOKENS') == str(config['maxOutputTokens'])
    assert option('--tools') == '' and '--no-session-persistence' in args
    assert all(not os.environ.get(k) for k in [
        'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN',
        'CLAUDE_CODE_GATEWAY_TOKEN', 'CLAUDE_CODE_GATEWAY_URL',
    ])
    user = sys.stdin.buffer.read()
    system = Path(option('--system-prompt-file')).read_bytes()
    if mode == 'semantic':
        assert re.fullmatch(r'[A-Z0-9_]+-(baseline|candidate)', key)
        plan = json.loads((root / 'generation-plan.json').read_text())
        assert any(p['key'] == key and p['action'] == 'generate' for p in plan['executionOrder'])
    out = root / ('standard/cli' if mode == 'standard' else 'generations/cli')
    out.mkdir(parents=True, exist_ok=True)
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    t0 = time.monotonic()
    interrupted = []
    child = owner = capture = raw_path = None
    reserved = interruptible = False
    failure = provider_code = None
    cleanup_complete = True
    code = 1

    def on_signal(signum, _frame):
        first = not interrupted
        interrupted.append(signum)
        # Before reservation is fully owned, only record. During blocking child
        # I/O, the first signal unwinds into the already-installed finalizer.
        # Repeated signals never interrupt cleanup or receipt persistence.
        if first and interruptible:
            raise InterruptedError('Capture interrupted')

    for stop_signal in [signal.SIGTERM, signal.SIGINT]:
        signal.signal(stop_signal, on_signal)
    try:
        # The cap and exclusive directory reservation are one transaction for
        # each lane, including distinct keys and simultaneous standard calls.
        # Polling the nonblocking lock allows startup interruption to terminate.
        with (out / '.attempt-reservation.lock').open('a') as lock:
            while True:
                if interrupted:
                    raise InterruptedError('Interrupted before reservation')
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    time.sleep(0.02)
            assert not (root / 'manual-review-halt.json').exists(), 'Content review halted dispatch'
            if mode == 'standard':
                previous = sorted(p for p in out.iterdir() if p.is_dir() and p.name.isdigit())
                assert len(previous) < config['standardCap'], 'Standard call cap exhausted'
                for previous_capture in previous:
                    assert json.loads((previous_capture / 'completion.json').read_text())['exitCode'] == 0, 'Prior unfinished/failed standard call; no retry'
                index = len(previous) + 1
                key = f'{index:02d}'
                expected = json.loads((root / 'standard-prompt-inventory.json').read_text())['rows'][index - 1]
            else:
                assert len([p for p in out.iterdir() if p.is_dir()]) < config['semanticCap'], 'Semantic call cap exhausted'
                expected = json.loads((root / 'prompts' / f'{key}-receipt.json').read_text())
            assert digest(system) == expected['systemSha256'], 'Actual system prompt differs from frozen inventory'
            assert digest(user) == expected['userSha256'], 'Actual user prompt differs from frozen inventory'
            capture = out / key
            capture.mkdir()  # Exclusive, including failed or interrupted attempts.
            reserved = True
        raw_path = capture / 'stdout.jsonl'
        (capture / 'user.txt').write_bytes(user)
        (capture / 'system.txt').write_bytes(system)
        request = {
            'startedAt': started, 'key': key, 'mode': mode, 'argv': args,
            'systemSha256': digest(system), 'userSha256': digest(user),
            'environmentKeys': sorted(os.environ), 'paidProviderCredentialsAbsent': True,
            'transparentCapture': True, 'captureRetries': 0,
        }
        (capture / 'request.json').write_text(json.dumps(request, indent=2) + '\n')
        if interrupted:
            raise InterruptedError('Interrupted before child startup')
        assert not (root / 'manual-review-halt.json').exists(), 'Content review halted dispatch'
        owner = ProcessOwner()
        with raw_path.open('xb') as file, selectors.DefaultSelector() as selector:
            interruptible = True
            child = owner.start([real, *args], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=sys.stderr.buffer)
            if interrupted:
                raise InterruptedError('Interrupted during child startup')
            child.stdin.write(user)
            child.stdin.close()
            selector.register(child.stdout, selectors.EVENT_READ)
            drain_deadline = None
            while True:
                owner.refresh()
                if interrupted:
                    raise InterruptedError('Interrupted during output drain')
                if child.poll() is not None and drain_deadline is None:
                    # An exited provider can leave stdout open in a detached
                    # descendant. Stop that owned family before waiting for EOF.
                    cleanup_complete = owner.stop(grace=0.8)
                    drain_deadline = time.monotonic() + 1.0
                if selector.select(timeout=0.05):
                    block = os.read(child.stdout.fileno(), 65536)
                    if not block:
                        break
                    # Preserve exact bytes before forwarding to the consumer.
                    file.write(block)
                    file.flush()
                    sys.stdout.buffer.write(block)
                    sys.stdout.buffer.flush()
                elif drain_deadline is not None and time.monotonic() >= drain_deadline:
                    failure = 'output_pipe_not_closed'
                    break
            if interrupted:
                raise InterruptedError('Interrupted before child completion')
            provider_code = child.wait()
            code = provider_code if provider_code >= 0 else 128 - provider_code
    except BrokenPipeError:
        failure = 'downstream_closed'
        fd = os.open(os.devnull, os.O_WRONLY)
        os.dup2(fd, sys.stdout.fileno())
        os.close(fd)
    except InterruptedError:
        failure = 'interrupted'
    except BaseException as error:
        failure = type(error).__name__
        if not reserved:
            print(f'No attempt started: {failure}: {error}', file=sys.stderr)
    finally:
        interruptible = False
        if owner is not None:
            cleanup_complete = owner.stop(interrupted[0] if interrupted else signal.SIGTERM,
                                          grace=0.8) and cleanup_complete
        if child is not None:
            provider_code = child.returncode
        if interrupted:
            code = 128 + interrupted[0]
        elif failure or not cleanup_complete:
            code = code or 1
        if not cleanup_complete:
            failure = failure or 'descendant_cleanup_incomplete'
        if reserved:
            completion = {
                'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'exitCode': code, 'providerExitCode': provider_code,
                'interruptedBySignals': interrupted,
                'elapsedSeconds': round(time.monotonic() - t0, 2),
                'rawOutputSha256': digest(raw_path.read_bytes()) if raw_path and raw_path.exists() else None,
                'captureRetries': 0, 'failure': failure, 'cleanupComplete': cleanup_complete,
            }
            temporary = capture / 'completion.tmp'
            with temporary.open('x') as file:
                json.dump(completion, file, indent=2)
                file.write('\n')
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, capture / 'completion.json')
    return code


if __name__ == '__main__':
    sys.exit(main())
