#!/usr/bin/env python3
"""Compile the final Cloudflare schema to reviewed MySQL DDL, offline only.

The application migrations remain authoritative. This compiler uses SQLite's
schema introspection rather than replacing words in migration text. Generated
columns replace partial unique indexes; narration triggers are maintained
separately because locking and abort syntax differ between databases.
"""
import hashlib
import json
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / 'spacefast/migrations'

def quote(name):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z_0-9]*', name):
        raise ValueError(f'Unsupported schema identifier: {name}')
    return '`' + name + '`'

def compile_schema():
    db = sqlite3.connect(':memory:')
    sources = {}
    for source in sorted((ROOT / 'migrations').glob('*.sql')):
        raw = source.read_bytes()
        sources[source.name] = hashlib.sha256(raw).hexdigest()
        db.executescript(raw.decode())
    tables = db.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name").fetchall()
    statements, foreign_keys = [], []
    for table, original in tables:
        columns = db.execute(f'PRAGMA table_info({quote(table)})').fetchall()
        indexes = db.execute(f'PRAGMA index_list({quote(table)})').fetchall()
        indexed = set()
        for _, name, _, _, _ in indexes:
            indexed.update(row[2] for row in db.execute(f'PRAGMA index_info({quote(name)})') if row[2])
        indexed.update(c[1] for c in columns if c[5])
        fks = db.execute(f'PRAGMA foreign_key_list({quote(table)})').fetchall()
        indexed.update(row[3] for row in fks)
        lines, additions, native_indexes = [], [], []
        primary = [c[1] for c in sorted(columns, key=lambda c: c[5]) if c[5]]
        for _, name, kind, not_null, default, pk in columns:
            if kind.upper() == 'INTEGER':
                native_kind = 'BIGINT'
            elif kind.upper() in ('REAL', 'NUMERIC'):
                native_kind = 'DOUBLE'
            elif kind.upper() == 'JSON':
                native_kind = 'JSON'
            elif kind.upper() == 'TEXT':
                # Shared FK columns and identifiers have the same declaration.
                native_kind = 'VARCHAR(254)' if name == 'email' else 'VARCHAR(255)' if name == 'text' else 'VARCHAR(191)'
                if name not in indexed:
                    native_kind = 'LONGTEXT'
                # MySQL timestamps must have a native temporal default.
                if default and ('datetime' in default or default == 'CURRENT_TIMESTAMP'):
                    native_kind = 'DATETIME'
                    default = '(UTC_TIMESTAMP())'
            else:
                raise ValueError(f'Unsupported column type: {table}.{name} {kind}')
            line = f'{quote(name)} {native_kind}'
            if pk or not_null:
                line += ' NOT NULL'
            if pk and kind.upper() == 'INTEGER' and 'AUTOINCREMENT' in original:
                line += ' AUTO_INCREMENT'
            if default is not None:
                line += f' DEFAULT ({default})' if native_kind == 'LONGTEXT' else f' DEFAULT {default}'
            lines.append(line)
        if primary:
            lines.append('PRIMARY KEY (' + ', '.join(map(quote, primary)) + ')')
        for _, name, unique, origin, partial in indexes:
            if origin == 'pk':
                continue
            info = db.execute(f'PRAGMA index_info({quote(name)})').fetchall()
            column_names = [row[2] for row in info]
            index_name = name if origin == 'c' else f'{table}_unique_{len(native_indexes)}'
            raw = db.execute('SELECT sql FROM sqlite_master WHERE name = ?', (name,)).fetchone()[0]
            if any(col is None for col in column_names):
                if table != 'quality_stats' or name != 'idx_quality_stats_dimensions_unique':
                    raise ValueError(f'Unreviewed expression index: {name}')
                dimensions = ['period_type', 'period_key', 'reading_prompt_version', 'eval_prompt_version', 'variant_id', 'provider', 'spread_key', 'eval_model', 'eval_source']
                expr = 'SHA2(CAST(JSON_ARRAY(' + ', '.join(f'COALESCE({quote(col)}, \'\')' for col in dimensions) + ') AS CHAR), 256)'
                additions.append(f'`tableu_dimensions_hash` CHAR(64) CHARACTER SET ascii GENERATED ALWAYS AS (CASE WHEN eval_model IS NOT NULL AND eval_source IS NOT NULL THEN {expr} ELSE NULL END) STORED')
                native_indexes.append(f'UNIQUE KEY {quote(index_name)} (`tableu_dimensions_hash`)')
                continue
            if partial and unique:
                condition = raw[raw.upper().rfind(' WHERE ') + 7:]
                # Every current partial uniqueness predicate is explicit here.
                predicates = {"state = 'reserved'", "scope = 'global'", 'request_id IS NOT NULL', 'session_seed IS NOT NULL', 'idempotency_key IS NOT NULL'}
                if condition.strip() not in predicates:
                    raise ValueError(f'Unreviewed partial unique predicate: {name}: {condition}')
                if condition.strip().endswith(' IS NOT NULL'):
                    # Both engines allow multiple NULL values in unique keys.
                    # No generated dependency on a cascading FK is needed.
                    native_indexes.append(f'UNIQUE KEY {quote(index_name)} (' + ', '.join(map(quote, column_names)) + ')')
                    continue
                generated = []
                for col in column_names[:-1]:
                    generated.append(col)
                for col in column_names[-1:]:
                    gen = f'tableu_{index_name}_{col}'
                    # Names are deterministic and stay inside MySQL's 64 chars.
                    if len(gen) > 64:
                        gen = 'tableu_' + hashlib.sha256(gen.encode()).hexdigest()[:32]
                    kind = next(line.split(' ', 2)[1] for line in lines if line.startswith(quote(col) + ' '))
                    additions.append(f'{quote(gen)} {kind} GENERATED ALWAYS AS (CASE WHEN {condition} THEN {quote(col)} ELSE NULL END) STORED')
                    generated.append(gen)
                native_indexes.append(f'UNIQUE KEY {quote(index_name)} (' + ', '.join(map(quote, generated)) + ')')
            else:
                # A broader nonunique index changes performance only.
                native_indexes.append(('UNIQUE KEY ' if unique else 'KEY ') + quote(index_name) + ' (' + ', '.join(map(quote, column_names)) + ')')
        # Preserve the checks that govern quotas, state, and public contracts.
        checks = re.findall(r'CHECK\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)', original, re.I)
        lines.extend('CHECK (' + check + ')' for check in checks)
        lines.extend(additions)
        lines.extend(native_indexes)
        statements.append(f'CREATE TABLE IF NOT EXISTS {quote(table)} (\n  ' + ',\n  '.join(lines) + '\n) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;')
        for fk_id in sorted(set(row[0] for row in fks)):
            rows = sorted([row for row in fks if row[0] == fk_id], key=lambda row: row[1])
            ref = rows[0][2]
            foreign_keys.append(f'ALTER TABLE {quote(table)} ADD CONSTRAINT {quote(table + "_fk_" + str(fk_id))} FOREIGN KEY (' + ', '.join(quote(row[3]) for row in rows) + f') REFERENCES {quote(ref)} (' + ', '.join(quote(row[4]) for row in rows) + f') ON DELETE {rows[0][6]} ON UPDATE {rows[0][5]};')
    # These runtime-created counters also need native key and timestamp types.
    statements.append('CREATE TABLE IF NOT EXISTS _request_rate_limits (bucket_key VARCHAR(255) NOT NULL PRIMARY KEY, request_count BIGINT NOT NULL, expires_at_ms BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin;')
    statements.append('CREATE TABLE IF NOT EXISTS tableu_quota_locks (identity_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY) ENGINE=InnoDB;')
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / '0001_application_schema.sql').write_text('-- Requires MySQL 8.0.17+ (no-pad binary collation, JSON_TABLE, generated columns).\n-- Generated by scripts/spacefast-database-schema.py. Review before publish.\n' + '\n\n'.join(statements + foreign_keys) + '\n')
    (DEST / 'source-fingerprints.json').write_text(json.dumps(sources, indent=2) + '\n')

if __name__ == '__main__':
    compile_schema()
