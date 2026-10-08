import "server-only";

export interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export function getDatabaseConfig(env: {
  SQL_SERVER?: string;
  SQL_DATABASE?: string;
  SQL_USER?: string;
  SQL_PASSWORD?: string;
  SQL_ENCRYPT?: string;
  SQL_TRUST_SERVER_CERTIFICATE?: string;
}): DatabaseConfig {
  const required = ["SQL_SERVER", "SQL_DATABASE", "SQL_USER", "SQL_PASSWORD"] as const;
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`資料庫設定不完整：${missing.join(", ")}`);
  }

  const [server, database, user, password] = required.map((name) => env[name]);

  return {
    server: server ?? "",
    database: database ?? "",
    user: user ?? "",
    password: password ?? "",
    options: {
      encrypt: env.SQL_ENCRYPT !== "false",
      trustServerCertificate: env.SQL_TRUST_SERVER_CERTIFICATE === "true",
    },
  };
}
