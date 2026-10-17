/** Native MySQL test driver. Never used by a deployed Worker. */
export async function createMySqlD1({ port = Number(process.env.TABLEU_TEST_MYSQL_PORT), database = process.env.TABLEU_TEST_MYSQL_DATABASE || 'tableu_test' } = {}) {
  if (!port) throw new Error('Set TABLEU_TEST_MYSQL_PORT to an isolated local MySQL instance');
  const { default: mysql } = await import(process.env.TABLEU_MYSQL_DRIVER || 'mysql2/promise');
  const pool = mysql.createPool({ host: '127.0.0.1', port, user: 'root', password: '', database, connectionLimit: 20, multipleStatements: false, flags: '-FOUND_ROWS', timezone: 'Z', dateStrings: true, decimalNumbers: true });
  function prepare(sql, values = []) {
    return {
      sql, values,
      bind(...bound) { return prepare(sql, bound); },
      async all() { const connection = await pool.getConnection(); try { return await execute(connection, this); } finally { connection.release(); } },
      async run() { return this.all(); },
      async first(column) { const row = (await this.all()).results[0] || null; return column === undefined || row === null ? row : row[column]; }
    };
  }
  async function execute(connection, statement) {
    const [rows] = await connection.query(statement.sql, statement.values);
    return { success: true, results: Array.isArray(rows) ? rows : [], meta: { changes: rows.affectedRows || 0, last_row_id: rows.insertId || 0 } };
  }
  return {
    pool, prepare,
    async batch(statements) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const results = [];
        for (const statement of statements) results.push(await execute(connection, statement));
        await connection.commit();
        return results;
      } catch (error) { await connection.rollback(); throw error; }
      finally { connection.release(); }
    },
    async close() { await pool.end(); }
  };
}
