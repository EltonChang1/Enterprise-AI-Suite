import { useEffect, useState } from "react";

const headers = {
  "x-tenant-id": "acme-corp",
  "x-user-id": "admin@acme.com",
  "x-user-role": "admin"
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...headers,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [dash, crm, agents] = await Promise.all([
        fetchJson("/api/analytics/dashboard"),
        fetchJson("/api/crm/contacts"),
        fetchJson("/api/agents/tasks")
      ]);
      setDashboard(dash.data);
      setContacts(crm.data);
      setTasks(agents.data);
    } catch (loadError) {
      setError(loadError.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function seedDemoData() {
    setError("");
    await fetchJson("/api/crm/contacts", {
      method: "POST",
      body: JSON.stringify({
        name: "Taylor Morgan",
        email: `taylor+${Date.now()}@acme.com`,
        company: "Acme Corp",
        stage: "qualified"
      })
    });
    await fetchJson("/api/agents/tasks", {
      method: "POST",
      body: JSON.stringify({
        objective: "Generate renewal-risk summary for top 10 accounts",
        riskScore: 0.65,
        requestedByModule: "analytics"
      })
    });
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="app">
      <header>
        <h1>Enterprise AI Suite</h1>
        <p>Multi-tenant CRM + Analytics + Agents + Workflow + Billing + Governance</p>
      </header>

      <section className="actions">
        <button onClick={seedDemoData}>Seed Demo Activity</button>
        <button onClick={load}>Refresh</button>
      </section>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p>Loading...</p> : null}

      {!loading && dashboard ? (
        <section className="grid">
          <article>
            <h2>CRM</h2>
            <p>Total Contacts: {dashboard.crm.totalContacts}</p>
            <p>Customers: {dashboard.crm.stageCounts.customer}</p>
          </article>
          <article>
            <h2>Operations</h2>
            <p>Workflow Runs: {dashboard.operations.workflowRuns}</p>
            <p>Agent Tasks: {dashboard.operations.agentTasks}</p>
          </article>
          <article>
            <h2>Governance</h2>
            <p>Pending Approvals: {dashboard.governance.pendingApprovals}</p>
            <p>Audit Events: {dashboard.governance.auditEvents}</p>
          </article>
          <article>
            <h2>Recent Contacts</h2>
            <ul>
              {contacts.slice(0, 5).map((contact) => (
                <li key={contact.id}>{contact.name} — {contact.stage}</li>
              ))}
            </ul>
          </article>
          <article>
            <h2>Recent Agent Tasks</h2>
            <ul>
              {tasks.slice(0, 5).map((task) => (
                <li key={task.id}>{task.status} — {task.objective}</li>
              ))}
            </ul>
          </article>
        </section>
      ) : null}
    </main>
  );
}
