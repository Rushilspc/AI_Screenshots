declare module "better-sqlite3" {
  export interface Statement {
    run(params?: unknown): unknown;
    get(params?: unknown): unknown;
    all(params?: unknown): unknown[];
  }

  export interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
  }

  export default class BetterSqlite3Database implements Database {
    constructor(path: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): Statement;
  }
}
