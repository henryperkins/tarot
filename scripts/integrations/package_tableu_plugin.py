#!/usr/bin/env python3
"""Build a Tableu plugin upload from its versioned, locked source files.

Each version lives in docs/integrations/openai/submission/<version>/ with a
package-lock.json that pins every member and the archive itself. 1.0.1 is
the preserved October 1 upload; later versions add their own source and lock.
"""

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[2]
SUBMISSIONS = ROOT / 'docs/integrations/openai/submission'
DEFAULT_VERSION = '1.0.1'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inventory(source):
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Source must be a regular directory, not a symlink')
    actual = set()
    for path in source.rglob('*'):
        if path.is_symlink():
            raise ValueError('Source contains a symlink')
        if path.is_file():
            actual.add(path.relative_to(source).as_posix())
        elif not path.is_dir():
            raise ValueError('Source contains a special file')
    return actual


def assemble(source, lock):
    expected = lock['files']
    if inventory(source) != set(expected):
        raise ValueError('Source inventory differs from package-lock.json')

    output = io.BytesIO()
    with ZipFile(output, 'w', compression=ZIP_DEFLATED,
                 compresslevel=lock['archive']['compressionLevel']) as archive:
        for relative in sorted(expected):
            member = PurePosixPath(relative)
            if member.is_absolute() or '..' in member.parts or '\\' in relative:
                raise ValueError('Source contains an unsafe member path')
            data = (source / relative).read_bytes()
            if len(data) != expected[relative]['bytes'] or digest(data) != expected[relative]['sha256']:
                raise ValueError('Source checksum differs: ' + relative)
            entry = ZipInfo(lock['name'] + '/' + relative,
                            tuple(lock['archive']['timestamp']))
            entry.compress_type = ZIP_DEFLATED
            entry.create_system = 3
            entry.external_attr = int(lock['archive']['unixMode'], 8) << 16
            archive.writestr(entry, data,
                             compresslevel=lock['archive']['compressionLevel'])

    return output.getvalue()


def build(source, lock):
    data = assemble(source, lock)
    expected = lock['files']
    if len(data) != lock['archive']['bytes'] or digest(data) != lock['archive']['sha256']:
        raise ValueError('Archive differs from the locked ' + lock['version']
                         + ' ZIP; check Python/zlib compatibility')
    with ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise ValueError('Archive integrity check failed')
        for relative in expected:
            if digest(archive.read(lock['name'] + '/' + relative)) != expected[relative]['sha256']:
                raise ValueError('Archive round-trip checksum failed')
    return data


def write_lock(package, name, version, timestamp):
    """Pin a new version's source: member checksums plus the archive bytes."""
    lock_path = package / 'package-lock.json'
    if lock_path.exists():
        raise ValueError('A lock already exists for ' + version + '; versions are immutable once locked')
    source = package / 'source' / name
    files = {}
    for relative in sorted(inventory(source)):
        data = (source / relative).read_bytes()
        files[relative] = {'bytes': len(data), 'sha256': digest(data)}
    lock = {
        'name': name,
        'version': version,
        'sourceDirectory': './source/' + name,
        'archive': {
            'filename': name + '-' + version + '.zip',
            'bytes': 0,
            'sha256': '',
            'compression': 'deflate',
            'compressionLevel': 6,
            'timestamp': timestamp,
            'unixMode': '100644'
        },
        'files': files
    }
    data = assemble(source, lock)
    lock['archive']['bytes'] = len(data)
    lock['archive']['sha256'] = digest(data)
    with lock_path.open('x') as handle:
        handle.write(json.dumps(lock, indent=2) + '\n')
    return lock


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default=DEFAULT_VERSION,
                        help='Submission version directory to build (default: %(default)s)')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--write-lock', metavar='NAME',
                        help='Create package-lock.json for a new version whose source is source/NAME')
    parser.add_argument('--timestamp', metavar='YYYY-MM-DD',
                        help='Fixed member timestamp for --write-lock')
    args = parser.parse_args()
    package = SUBMISSIONS / args.version
    if args.write_lock:
        if not args.timestamp:
            raise ValueError('--write-lock needs --timestamp')
        year, month, day = (int(part) for part in args.timestamp.split('-'))
        write_lock(package, args.write_lock, args.version, [year, month, day, 0, 0, 0])
    lock = json.loads((package / 'package-lock.json').read_text())
    args.source = args.source or package / lock['sourceDirectory']
    args.output = args.output or ROOT / 'dist/plugins' / lock['archive']['filename']
    source = args.source.absolute()
    output = args.output.absolute()
    if source.resolve() == output.resolve() or source.resolve() in output.resolve().parents:
        raise ValueError('Output must be outside the source directory')
    if output.is_symlink():
        raise ValueError('Output must not be a symlink')
    data = build(source, lock)
    if output.exists():
        if not output.is_file() or output.read_bytes() != data:
            raise ValueError('Refusing to overwrite a different existing output')
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('xb') as handle:
            handle.write(data)
    print(json.dumps({'archive': str(output), 'files': len(lock['files']),
                      'bytes': len(data), 'sha256': digest(data)}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print('Tableu packaging failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
