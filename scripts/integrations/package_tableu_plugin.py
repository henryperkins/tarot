#!/usr/bin/env python3
"""Rebuild the preserved Tableu 1.0.1 upload from its locked source files."""

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / 'docs/integrations/openai/submission/1.0.1'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def build(source, lock):
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Source must be a regular directory, not a symlink')
    expected = lock['files']
    actual = set()
    for path in source.rglob('*'):
        if path.is_symlink():
            raise ValueError('Source contains a symlink')
        if path.is_file():
            actual.add(path.relative_to(source).as_posix())
        elif not path.is_dir():
            raise ValueError('Source contains a special file')
    if actual != set(expected):
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

    data = output.getvalue()
    if len(data) != lock['archive']['bytes'] or digest(data) != lock['archive']['sha256']:
        raise ValueError('Archive differs from the preserved 1.0.1 ZIP; check Python/zlib compatibility')
    with ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise ValueError('Archive integrity check failed')
        for relative in expected:
            if digest(archive.read(lock['name'] + '/' + relative)) != expected[relative]['sha256']:
                raise ValueError('Archive round-trip checksum failed')
    return data


def main():
    lock = json.loads((PACKAGE / 'package-lock.json').read_text())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path,
                        default=PACKAGE / lock['sourceDirectory'])
    parser.add_argument('--output', type=Path,
                        default=ROOT / 'dist/plugins' / lock['archive']['filename'])
    args = parser.parse_args()
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
