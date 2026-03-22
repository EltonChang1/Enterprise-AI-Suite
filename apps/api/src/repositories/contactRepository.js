import { getPgPool } from "../lib/postgres.js";
import { getTenantState } from "../store.js";

export async function listContacts(tenantId) {
  const pool = getPgPool();
  if (pool) {
    const result = await pool.query(
      `SELECT id, name, email, company, stage, created_at AS "createdAt"
       FROM crm_contacts
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 500`,
      [tenantId]
    );
    return result.rows;
  }

  const tenant = getTenantState(tenantId);
  return tenant.crm.contacts;
}

export async function createContact(tenantId, contact) {
  const pool = getPgPool();
  if (pool) {
    await pool.query(
      `INSERT INTO crm_contacts (id, tenant_id, name, email, company, stage, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contact.id, tenantId, contact.name, contact.email, contact.company, contact.stage, contact.createdAt]
    );
    return contact;
  }

  const tenant = getTenantState(tenantId);
  tenant.crm.contacts.unshift(contact);
  return contact;
}
