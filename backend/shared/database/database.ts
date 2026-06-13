import { inject } from "injectus";
import { Pool } from "pg";
import { ConfigToken } from "../config/config.ts";

export class Database extends Pool implements AsyncDisposable {
  constructor({ db } = inject(ConfigToken)) {
    super({
      host: db.host,
      port: db.port,
      database: db.name,
      user: db.user,
      password: db.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      client_encoding: "UTF8",
    });
  }

  [Symbol.asyncDispose](): PromiseLike<void> {
    return this.end();
  }
}
