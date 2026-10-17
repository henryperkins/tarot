/** Bounded SQLite-to-MySQL compiler for Tableu's application statements.
 * Tokens retain parameter identities, so rewrites never interpolate values or
 * accidentally rewrite literal text. Unsupported SQLite syntax fails closed.
 */
export class UnsupportedSpacefastSql extends Error {
  constructor(message) {
    super(`Unsupported Spacefast SQL: ${message}`);
    this.name = 'UnsupportedSpacefastSql';
  }
}

export function tokenize(sql) {
  const tokens = [];
  let index = 0;
  let parameter = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { index += whitespace[0].length; continue; }
    if (rest.startsWith('--')) { const end = rest.indexOf('\n'); index += end < 0 ? rest.length : end; continue; }
    if (rest.startsWith('/*')) { const end = rest.indexOf('*/', 2); if (end < 0) throw new UnsupportedSpacefastSql('unterminated comment'); index += end + 2; continue; }
    const quote = rest[0];
    if (quote === "'" || quote === '"' || quote === '`') {
      let end = 1;
      for (; end < rest.length; end++) {
        if (rest[end] !== quote) continue;
        if (rest[end + 1] === quote) { end++; continue; }
        break;
      }
      if (end === rest.length) throw new UnsupportedSpacefastSql('unterminated quoted value');
      const value = rest.slice(0, end + 1);
      tokens.push({ value: quote === '"' ? '`' + value.slice(1, -1) + '`' : value, type: quote === "'" ? 'literal' : 'identifier' });
      index += end + 1;
      continue;
    }
    const match = rest.match(/^(?:\?\d*|[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|<=>|<=|>=|<>|!=|\|\||[-+*/%=<>.,();])/);
    if (!match) throw new UnsupportedSpacefastSql('unrecognized token');
    const rawValue = match[0];
    const value = rawValue.startsWith('?') ? '?' : rawValue;
    const parameterIndex = rawValue.length > 1 && rawValue[0] === '?' ? Number(rawValue.slice(1)) - 1 : parameter;
    if (rawValue[0] === '?') {
      if (parameterIndex < 0) throw new UnsupportedSpacefastSql('numbered parameter');
      parameter = Math.max(parameter, parameterIndex + 1);
    }
    tokens.push({ value, type: /^[A-Za-z_]/.test(value) ? 'word' : 'symbol', ...(value === '?' ? { parameter: parameterIndex } : {}) });
    index += rawValue.length;
  }
  if (tokens.at(-1)?.value === ';') tokens.pop();
  if (tokens.some(t => t.value === ';')) throw new UnsupportedSpacefastSql('multiple statements');
  return tokens;
}

const word = (token, value) => token?.value.toUpperCase() === value;
const literal = value => ({ value, type: 'literal' });
const token = value => ({ value, type: 'word' });
const pieces = (...groups) => groups.flat(Infinity);
function closeParen(tokens, start) {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].value === '(') depth++;
    if (tokens[i].value === ')' && --depth === 0) return i;
  }
  throw new UnsupportedSpacefastSql('unbalanced parentheses');
}
function splitExpressions(tokens) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].value === '(') depth++;
    if (tokens[i].value === ')') depth--;
    if (tokens[i].value === ',' && depth === 0) { result.push(tokens.slice(start, i)); start = i + 1; }
  }
  result.push(tokens.slice(start));
  return result;
}
function topLevel(tokens, value, start = 0) {
  let depth = 0;
  for (let i = start; i < tokens.length; i++) {
    if (tokens[i].value === '(') depth++;
    if (tokens[i].value === ')') depth--;
    if (depth === 0 && word(tokens[i], value)) return i;
  }
  return -1;
}
function expression(tokens) {
  const output = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    if (word(current, 'EXCLUDED') && tokens[i + 1]?.value === '.' && tokens[i + 2]) {
      output.push(token('VALUES'), token('('), tokens[i + 2], token(')'));
      i += 2;
      continue;
    }
    if (tokens[i + 1]?.value === '(' && current.type === 'word') {
      const end = closeParen(tokens, i + 1);
      const args = splitExpressions(tokens.slice(i + 2, end)).map(expression);
      if (word(current, 'DATETIME')) {
        if (args.length === 1 && args[0].length === 1 && args[0][0].value === "'now'") output.push(token('UTC_TIMESTAMP'), token('('), token(')'));
        else if (args.length === 2 && args[1].length === 1 && args[1][0].value === "'unixepoch'") output.push(...pieces(token("DATE_ADD ( '1970-01-01 00:00:00' , INTERVAL"), args[0], token('SECOND )')));
        else throw new UnsupportedSpacefastSql('datetime arguments');
      } else if (word(current, 'DATE') && args.length === 2) {
        const date = args[0].length === 1 && args[0][0].value === "'now'" ? [token('UTC_DATE ( )')] : pieces(token('DATE ('), args[0], token(')'));
        const modifier = args[1];
        let days;
        if (modifier.length === 1 && modifier[0].value === '?') {
          days = pieces(token('CAST ( SUBSTRING_INDEX ('), modifier, literal("' '"), token(', 1 ) AS SIGNED )'));
          // Separate the modifier and separator arguments explicitly.
          days.splice(2, 0, token(','));
        } else {
          const match = modifier.length === 1 && modifier[0].value.match(/^'([+-]?\d+) days'$/);
          if (!match) throw new UnsupportedSpacefastSql('date modifier');
          days = [token(match[1])];
        }
        output.push(...pieces(token('DATE_ADD ('), date, token(', INTERVAL'), days, token('DAY )')));
      } else if (word(current, 'JSON_EXTRACT')) {
        if (args.length !== 2) throw new UnsupportedSpacefastSql('json_extract arguments');
        const call = pieces(token('JSON_EXTRACT'), token('('), args[0], token(','), args[1], token(')'));
        // SQLite returns scalars and SQL NULL; MySQL returns JSON values.
        output.push(...pieces(token('CASE WHEN JSON_TYPE ('), call, token(") = 'NULL' THEN NULL ELSE JSON_UNQUOTE ("), call, token(') END')));
      } else {
        output.push(word(current, 'JSON_ARRAY_LENGTH') ? token('JSON_LENGTH') : word(current, 'MAX') && args.length > 1 ? token('GREATEST') : word(current, 'MIN') && args.length > 1 ? token('LEAST') : current, token('('));
        args.forEach((arg, n) => { if (n) output.push(token(',')); output.push(...arg); });
        output.push(token(')'));
      }
      i = end;
    } else output.push(current);
  }
  return output;
}

const CONFLICT_TARGETS = {
  usage_tracking: ['user_id,month'],
  eval_metrics: ['request_id'],
  inference_attempts: ['id'],
  card_appearances: ['user_id,card_name,year_month'],
  user_analytics_prefs: ['user_id'],
  _request_rate_limits: ['bucket_key'],
  narration_request_limits: ['identity,scope,window_key'],
  oauth_registration_counters: ['client_key,window_start_hour']
};
const IGNORE_KEYS = {
  processed_webhook_events: 'event_id', users: 'id', user_memories: 'id',
  journal_followups: 'id', narration_monthly_usage: 'identity', inference_attempts: 'id'
};

function compileInsert(input) {
  const tokens = [...input];
  let ignore = false;
  if (word(tokens[1], 'OR')) {
    if (word(tokens[2], 'REPLACE')) { tokens.splice(0, 3, token('REPLACE')); }
    else if (word(tokens[2], 'IGNORE')) { ignore = true; tokens.splice(1, 2); }
    else throw new UnsupportedSpacefastSql('INSERT OR modifier');
  }
  const into = tokens.findIndex(t => word(t, 'INTO'));
  const table = tokens[into + 1]?.value.toLowerCase();
  if (!table || tokens[into + 2]?.value !== '(') throw new UnsupportedSpacefastSql('INSERT requires an explicit column list');
  const columnsEnd = closeParen(tokens, into + 2);
  const columns = splitExpressions(tokens.slice(into + 3, columnsEnd)).map(c => c[0]?.value);
  const values = topLevel(tokens, 'VALUES', columnsEnd + 1);
  const conflict = topLevel(tokens, 'ON', columnsEnd + 1);
  const returning = topLevel(tokens, 'RETURNING', columnsEnd + 1);
  let returnColumn = null;
  if (returning >= 0) {
    if (tokens.length !== returning + 2 || !['attempts', 'count', 'request_count'].includes(tokens[returning + 1].value)) throw new UnsupportedSpacefastSql('RETURNING projection');
    returnColumn = tokens[returning + 1].value;
  }
  let baseEnd = conflict >= 0 ? conflict : returning >= 0 ? returning : tokens.length;
  let assignments = [];
  let condition = null;
  let admissionColumn = null;
  if (conflict >= 0) {
    if (!word(tokens[conflict + 1], 'CONFLICT') || tokens[conflict + 2]?.value !== '(') throw new UnsupportedSpacefastSql('ON clause');
    const targetEnd = closeParen(tokens, conflict + 2);
    const target = tokens.slice(conflict + 3, targetEnd).map(t => t.value.toLowerCase()).join('');
    if (!CONFLICT_TARGETS[table]?.includes(target)) throw new UnsupportedSpacefastSql(`unreviewed conflict target for ${table}`);
    if (!word(tokens[targetEnd + 1], 'DO')) throw new UnsupportedSpacefastSql('conflict action');
    if (word(tokens[targetEnd + 2], 'NOTHING')) ignore = true;
    else {
      if (!word(tokens[targetEnd + 2], 'UPDATE') || !word(tokens[targetEnd + 3], 'SET')) throw new UnsupportedSpacefastSql('conflict action');
      const end = returning >= 0 ? returning : tokens.length;
      const where = topLevel(tokens, 'WHERE', targetEnd + 4);
      assignments = splitExpressions(tokens.slice(targetEnd + 4, where >= 0 ? where : end));
      if (where >= 0) {
        condition = tokens.slice(where + 1, end);
        // Conditional quotas are a single positive counter compared to a cap.
        if (condition.length !== 3 || condition[1].value !== '<' || condition[2].value !== '?') throw new UnsupportedSpacefastSql('conditional UPSERT predicate');
        admissionColumn = condition[0].value;
        const first = assignments[0];
        if (first.length !== 5 || first[0].value !== admissionColumn || first[1].value !== '=' || first[2].value !== admissionColumn || first[3].value !== '+' || first[4].value !== '1') throw new UnsupportedSpacefastSql('conditional UPSERT counter');
      }
    }
  }
  if (ignore) {
    const key = IGNORE_KEYS[table];
    if (!key || values < 0) throw new UnsupportedSpacefastSql(`unreviewed INSERT IGNORE for ${table}`);
    assignments = [pieces(token(key), token('='), token('IF ( LAST_INSERT_ID ( 0 ) = 0 ,'), token(key), token(','), token(key), token(')'))];
  }
  if (returnColumn || admissionColumn || ignore) {
    if (values < 0 || tokens[values + 1]?.value !== '(') throw new UnsupportedSpacefastSql('counter/ignore INSERT requires VALUES');
    const valuesEnd = closeParen(tokens, values + 1);
    if (valuesEnd !== baseEnd - 1) throw new UnsupportedSpacefastSql('multiple VALUES rows');
    const args = splitExpressions(tokens.slice(values + 2, valuesEnd));
    const index = returnColumn ? columns.indexOf(returnColumn) : admissionColumn ? columns.indexOf(admissionColumn) : 0;
    if (index < 0) throw new UnsupportedSpacefastSql('counter insert column');
    if (returnColumn || admissionColumn) args[index] = pieces(token('LAST_INSERT_ID ('), args[index], token(')'));
    else args[index] = pieces(token('IF ( LAST_INSERT_ID ( 1 ) ,'), args[index], token(','), args[index], token(')'));
    const valuesTokens = [token('(')];
    args.forEach((arg, n) => { if (n) valuesTokens.push(token(',')); valuesTokens.push(...arg); });
    valuesTokens.push(token(')'));
    tokens.splice(values + 1, valuesEnd - values, ...valuesTokens);
    baseEnd += valuesTokens.length - (valuesEnd - values);
  }
  const output = tokens.slice(0, baseEnd);
  if (assignments.length) {
    output.push(token('ON DUPLICATE KEY UPDATE'));
    assignments.forEach((assignment, i) => {
      if (i) output.push(token(','));
      if (condition && i === 0) output.push(...pieces(assignment.slice(0, 2), token('IF ('), condition, token(', LAST_INSERT_ID ('), assignment.slice(2), token(') ,'), token(admissionColumn), token('+ LAST_INSERT_ID ( 0 ) * 0 )')));
      else if (condition) output.push(...pieces(assignment.slice(0, 2), token('IF ( LAST_INSERT_ID ( ) > 0 ,'), assignment.slice(2), token(','), assignment[0], token(')')));
      else if (returnColumn && assignment[0].value === returnColumn) output.push(...pieces(assignment.slice(0, 2), token('LAST_INSERT_ID ('), assignment.slice(2), token(')')));
      else output.push(...assignment);
    });
  }
  const lock = values < 0 && table === 'feature_usage' ? { kind: 'feature', identityParameter: 1, featureParameter: 2 }
    : values < 0 && table === 'follow_up_usage' ? { kind: 'followup', userParameter: 0 } : null;
  return { tokens: output, returnColumn, marker: Boolean(condition || ignore), normalizeChanges: assignments.length > 0 || word(input[0], 'REPLACE'), mutation: true, lock };
}

export function compileSpacefastSql(sql) {
  let tokens = tokenize(sql);
  if (!tokens.length) throw new UnsupportedSpacefastSql('empty statement');
  let plan = { tokens, mutation: ['INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE'].some(w => word(tokens[0], w)) };
  if (word(tokens[0], 'CREATE')) {
    const canonical = tokens.map(t => t.value.toLowerCase()).join(' ');
    if (!canonical.startsWith('create table if not exists _request_rate_limits (')) throw new UnsupportedSpacefastSql('runtime DDL');
    return { sql: 'CREATE TABLE IF NOT EXISTS _request_rate_limits (bucket_key VARCHAR(255) NOT NULL PRIMARY KEY, request_count BIGINT NOT NULL, expires_at_ms BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin', parameters: [], mutation: true };
  }
  if (!['SELECT', 'WITH', 'INSERT', 'UPDATE', 'DELETE', 'REPLACE'].some(w => word(tokens[0], w))) throw new UnsupportedSpacefastSql('statement kind');
  if (word(tokens[0], 'WITH')) {
    const insert = topLevel(tokens, 'INSERT');
    if (insert >= 0) {
      const select = topLevel(tokens, 'SELECT', insert);
      if (select < 0) throw new UnsupportedSpacefastSql('CTE INSERT shape');
      tokens = pieces(tokens.slice(insert, select), tokens.slice(0, insert), tokens.slice(select));
    }
  }
  if (word(tokens[0], 'INSERT') || word(tokens[0], 'REPLACE')) plan = compileInsert(tokens);
  else plan.tokens = tokens;
  tokens = expression(plan.tokens);
  // The one SQLite JSON table function used by experiment analytics.
  for (let i = 0; i < tokens.length; i++) {
    if (!word(tokens[i], 'JSON_EACH') || tokens[i + 1]?.value !== '(') continue;
    const end = closeParen(tokens, i + 1);
    const arg = tokens.slice(i + 2, end).map(t => t.value).join('');
    if (arg !== 'ab_experiments.treatment_variants') throw new UnsupportedSpacefastSql('json_each source');
    tokens.splice(i, end - i + 1, token("JSON_TABLE ( ab_experiments.treatment_variants , '$[*]' COLUMNS ( value VARCHAR(255) PATH '$' ) ) AS json_each"));
  }
  // MySQL disallows selecting directly from a DELETE target in a subquery.
  if (word(tokens[0], 'DELETE')) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].value !== '(' || !word(tokens[i + 1], 'SELECT')) continue;
      const end = closeParen(tokens, i);
      tokens.splice(i + 1, end - i - 1, token('SELECT * FROM ('), ...tokens.slice(i + 1, end), token(') AS tableu_delete_rows'));
      i = end + 2;
    }
  }
  // rank is a column in the historical cards table and a reserved MySQL word.
  tokens = tokens.map((t, index) => word(t, 'IS') && tokens[index + 1]?.value === '?' ? { ...t, value: '<=>' } : ['RANK', 'YEAR_MONTH'].some(w => word(t, w)) && t.type === 'word' ? { ...t, value: '`' + t.value + '`' } : t);
  if (tokens.some(t => t.type === 'word' && ['PRAGMA', 'AUTOINCREMENT', 'RETURNING', 'EXCLUDED', 'STRFTIME', 'JULIANDAY', 'DATETIME', 'WITHOUT'].includes(t.value.toUpperCase()))) throw new UnsupportedSpacefastSql('untranslated SQLite syntax');
  const parameters = tokens.filter(t => t.parameter !== undefined).map(t => t.parameter);
  if (word(tokens[0], 'UPDATE')) {
    const where = topLevel(tokens, 'WHERE');
    const predicate = where < 0 ? [] : tokens.slice(where);
    // SQLite counts matched rows even when their values did not change.
    // MySQL's affected-row mode varies between clients, so count under the
    // same transaction/row locks rather than guessing from changed rows.
    plan.lock = {
      kind: 'matched-update',
      sql: pieces(token('SELECT COUNT ( * ) AS tableu_matched FROM'), tokens[1], predicate, token('FOR UPDATE')).map(t => t.value).join(' '),
      parameters: predicate.filter(t => t.parameter !== undefined).map(t => t.parameter)
    };
  }
  return { sql: tokens.map(t => t.value).join(' '), parameters, mutation: plan.mutation, marker: plan.marker, normalizeChanges: plan.normalizeChanges, returnColumn: plan.returnColumn, lock: plan.lock };
}
