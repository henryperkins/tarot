import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '@babel/parser';
import { compileSpacefastSql } from '../spacefast/database/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isSql = value => /^\s*(?:SELECT\b[\s\S]*?\bFROM\b|INSERT(?: OR (?:IGNORE|REPLACE))? INTO\b|UPDATE\s+[A-Za-z_]+\s+SET\b|DELETE FROM\b|WITH\b[\s\S]*?\bSELECT\b|CREATE TABLE\b)/i.test(value);
const samples = {
  column: 'readings_count', RATE_LIMIT_COUNTERS_TABLE: '_request_rate_limits',
  placeholders: '?, ?', updatePlaceholders: '?, ?', whereClause: 'user_id = ?',
  "fields.join(', ')": 'username = ?, updated_at = ?',
  "whereParts.join(' AND ' )": 'user_id = ?',
  "whereParts.join(' AND ')": 'user_id = ?'
};

function walkNode(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walkNode(child, visit));
    else if (value && typeof value === 'object') walkNode(value, visit);
  }
}

export async function collectApplicationSql() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== '__tests__') await walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }
  await walk(path.join(root, 'functions'));
  await walk(path.join(root, 'src/worker'));
  const queries = [];
  const unresolved = [];
  let preparedCalls = 0;
  for (const file of files.sort()) {
    const source = await readFile(file, 'utf8');
    const ast = parse(source, { sourceType: 'module' });
    const definitions = new Map();
    walkNode(ast, node => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
        const list = definitions.get(node.id.name) || [];
        list.push(node.init);
        definitions.set(node.id.name, list);
      }
    });
    function resolve(node, seen = new Set()) {
      if (!node) return null;
      if (node.type === 'StringLiteral') return node.value;
      if (node.type === 'TemplateLiteral') {
        let value = '';
        for (let index = 0; index < node.quasis.length; index++) {
          value += node.quasis[index].value.cooked;
          if (node.expressions[index]) {
            const fragment = resolve(node.expressions[index], seen);
            if (fragment === null) return null;
            value += fragment;
          }
        }
        return value;
      }
      if (node.type === 'ConditionalExpression') return resolve(node.consequent, seen);
      if (node.type === 'Identifier' && !seen.has(node.name)) {
        const next = new Set([...seen, node.name]);
        for (const definition of definitions.get(node.name) || []) {
          const value = resolve(definition, next);
          if (value !== null) return value;
        }
      }
      return samples[source.slice(node.start, node.end)] ?? null;
    }
    const seen = new Set();
    const add = (node, kind) => {
      const sql = resolve(node);
      if (sql !== null && isSql(sql)) {
        const key = sql.replace(/\s+/g, ' ').trim();
        if (!seen.has(key)) { queries.push({ file: path.relative(root, file), line: node.loc.start.line, kind, sql }); seen.add(key); }
        return true;
      }
      return false;
    };
    walkNode(ast, node => {
      if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression' && node.callee.property?.name === 'prepare') {
        preparedCalls++;
        if (!add(node.arguments[0], 'prepared')) {
          // This helper's complete call sites are SQL literals inventoried below.
          const genericDelete = file.endsWith('/functions/api/account/delete.js') && node.arguments[0]?.name === 'sql';
          if (!genericDelete) unresolved.push({ file: path.relative(root, file), line: node.loc.start.line, expression: source.slice(node.arguments[0]?.start, node.arguments[0]?.end) });
        }
      } else if ((node.type === 'StringLiteral' || node.type === 'TemplateLiteral') && isSql(resolve(node) || '')) {
        add(node, node.type === 'TemplateLiteral' && node.expressions.length ? 'representative-template' : 'literal');
      }
    });
  }
  return { queries, unresolved, preparedCalls };
}

export async function auditApplicationSql(native = null) {
  const inventory = await collectApplicationSql();
  const failures = [];
  for (const query of inventory.queries) {
    try {
      const plan = compileSpacefastSql(query.sql);
      if (native && !plan.sql.startsWith('CREATE ')) {
        await native.prepare(`EXPLAIN ${plan.sql}`).bind(...plan.parameters.map(() => 0)).all();
      }
    } catch (error) { failures.push({ file: query.file, line: query.line, error: error.message }); }
  }
  return { queries: inventory.queries.length, preparedCalls: inventory.preparedCalls, unresolved: inventory.unresolved, failures };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let native = null;
  if (process.env.TABLEU_TEST_MYSQL_PORT) {
    const { createMySqlD1 } = await import('../tests/spacefastDatabaseHarness.mjs');
    native = await createMySqlD1();
  }
  try {
    const result = await auditApplicationSql(native);
    console.log(JSON.stringify(result, null, 2));
    if (result.failures.length || result.unresolved.length) process.exitCode = 1;
  } finally { await native?.close(); }
}
