/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.createTable("tenants", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.text("status").notNullable().defaultTo("active");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("crm_contacts", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("name").notNullable();
    table.text("email").notNullable();
    table.text("company").notNullable();
    table.text("stage").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("workflow_definitions", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("name").notNullable();
    table.text("trigger").notNullable();
    table.jsonb("steps").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("workflow_runs", (table) => {
    table.text("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("workflow_id").notNullable().index();
    table.text("status").notNullable();
    table.integer("steps_executed").notNullable().defaultTo(0);
    table.timestamp("started_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("finished_at", { useTz: true }).nullable();
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("workflow_runs");
  await knex.schema.dropTableIfExists("workflow_definitions");
  await knex.schema.dropTableIfExists("crm_contacts");
  await knex.schema.dropTableIfExists("tenants");
}
