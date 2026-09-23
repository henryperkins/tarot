/** In-memory KV namespace that records put options (for expiry assertions). */
export class MemoryKV {
  constructor() {
    this.store = new Map();
    this.puts = [];
  }

  async get(key, options) {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key);
    const type = typeof options === 'string' ? options : options?.type;
    return type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value, options = {}) {
    this.puts.push({ key, options });
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor } = {}) {
    const names = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: next >= names.length,
      cursor: next >= names.length ? undefined : String(next)
    };
  }
}
