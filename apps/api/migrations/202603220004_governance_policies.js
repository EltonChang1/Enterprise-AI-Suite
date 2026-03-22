/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.createTable("governance_policies", (table) => {
    table.text("tenant_id").notNullable().index();
    table.text("policy_id").notNullable();
    table.text("name").notNullable();
    table.boolean("enabled").notNullable().defaultTo(true);
    table.text("condition_expr").notNullable();
    table.text("action").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["tenant_id", "policy_id"]);
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("governance_policies");
}
