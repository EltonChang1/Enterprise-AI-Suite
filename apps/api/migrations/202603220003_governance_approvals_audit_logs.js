/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.createTable("governance_approvals", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("task_id").notNullable().index();
    table.text("type").notNullable();
    table.text("status").notNullable();
    table.timestamp("requested_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("requested_by").notNullable();
    table.timestamp("approved_at", { useTz: true }).nullable();
    table.text("approved_by").nullable();
  });

  await knex.schema.createTable("governance_audit_logs", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.timestamp("at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("actor_id").notNullable();
    table.text("actor_role").notNullable();
    table.text("action").notNullable();
    table.text("module").notNullable();
    table.text("resource_id").nullable();
    table.jsonb("payload").notNullable().defaultTo("{}");
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("governance_audit_logs");
  await knex.schema.dropTableIfExists("governance_approvals");
}
