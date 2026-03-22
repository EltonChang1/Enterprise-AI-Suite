/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.schema.createTable("governance_policy_versions", (table) => {
    table.bigIncrements("id").primary();
    table.text("tenant_id").notNullable().index();
    table.text("policy_id").notNullable().index();
    table.integer("version_no").notNullable();
    table.text("name").notNullable();
    table.boolean("enabled").notNullable();
    table.text("condition_expr").notNullable();
    table.text("action").notNullable();
    table.text("changed_by").notNullable();
    table.text("change_reason").nullable();
    table.timestamp("changed_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(["tenant_id", "policy_id", "version_no"], {
      indexName: "uq_governance_policy_versions_version"
    });
  });
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists("governance_policy_versions");
}
