const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/enterprise_ai_suite";

module.exports = {
  client: "pg",
  connection: connectionString,
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: "./migrations",
    extension: "js"
  }
};
