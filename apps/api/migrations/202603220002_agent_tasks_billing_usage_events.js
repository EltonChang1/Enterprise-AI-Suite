/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.createTable("agent_tasks", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("objective").notNullable();
    table.decimal("risk_score", 4, 3).notNullable().defaultTo(0);
    table.text("requested_by_module").notNullable();
    table.text("status").notNullable();
    table.decimal("confidence", 4, 3).nullable();
    table.text("outcome").nullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("billing_usage_events", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("category").notNullable();
    table.decimal("units", 14, 4).notNullable();
    table.timestamp("recorded_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("billing_usage_events");
  await knex.schema.dropTableIfExists("agent_tasks");
}
