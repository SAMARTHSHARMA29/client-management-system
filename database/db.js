const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'cms.db'));

// Enable WAL mode for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    company     TEXT,
    email       TEXT,
    phone       TEXT,
    address     TEXT,
    status      TEXT DEFAULT 'active' CHECK(status IN ('active','inactive','prospect')),
    tags        TEXT DEFAULT '[]',
    avatar_color TEXT DEFAULT '#6366f1',
    notes_count INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    status      TEXT DEFAULT 'planning' CHECK(status IN ('planning','active','completed','on-hold')),
    budget      REAL DEFAULT 0,
    spent       REAL DEFAULT 0,
    deadline    TEXT,
    progress    INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    invoice_no  TEXT NOT NULL UNIQUE,
    status      TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','paid','overdue')),
    items       TEXT DEFAULT '[]',
    subtotal    REAL DEFAULT 0,
    tax         REAL DEFAULT 0,
    total       REAL DEFAULT 0,
    due_date    TEXT,
    paid_date   TEXT,
    notes       TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS client_notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    entity_type TEXT,
    entity_id   INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Seed Data ────────────────────────────────────────────────────────────────

const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients').get().c;

if (clientCount === 0) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

  const insertClient = db.prepare(`
    INSERT INTO clients (name, company, email, phone, address, status, tags, avatar_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProject = db.prepare(`
    INSERT INTO projects (client_id, name, description, status, budget, spent, deadline, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertInvoice = db.prepare(`
    INSERT INTO invoices (client_id, project_id, invoice_no, status, items, subtotal, tax, total, due_date, paid_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertNote = db.prepare(`
    INSERT INTO client_notes (client_id, content) VALUES (?, ?)
  `);
  const insertActivity = db.prepare(`
    INSERT INTO activity_log (type, title, description, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)
  `);

  const seedClients = [
    ['Aisha Rahman', 'Nexus Digital', 'aisha@nexusdigital.com', '+1 (555) 201-3847', '12 Innovation Ave, San Francisco, CA', 'active', '["design","web","premium"]', colors[0]],
    ['Marcus Chen', 'TechFlow Inc', 'marcus@techflow.io', '+1 (555) 334-9021', '88 Silicon Blvd, Austin, TX', 'active', '["development","saas"]', colors[1]],
    ['Sofia Reyes', 'GreenLeaf Co', 'sofia@greenleaf.co', '+1 (555) 480-6712', '45 Eco Park, Portland, OR', 'prospect', '["branding","sustainability"]', colors[2]],
    ['James Whitfield', 'Apex Analytics', 'james@apexanalytics.com', '+1 (555) 129-5534', '300 Data Drive, Chicago, IL', 'active', '["analytics","enterprise"]', colors[3]],
    ['Priya Kapoor', 'Luminary Labs', 'priya@luminarylabs.dev', '+1 (555) 667-8823', '7 Startup Row, New York, NY', 'active', '["mobile","ai"]', colors[4]],
    ['Ethan Brooks', 'BrightPath Media', 'ethan@brightpath.media', '+1 (555) 774-2290', '22 Creative St, Los Angeles, CA', 'inactive', '["marketing","content"]', colors[5]],
    ['Lena Fischer', 'Quantum Studios', 'lena@quantum.studio', '+49 89 12345678', 'Maximilianstr. 15, Munich, Germany', 'active', '["design","gaming"]', colors[6]],
    ['Omar Hassan', 'Starlight Ventures', 'omar@starlightvc.com', '+1 (555) 990-4401', '100 Venture Way, Seattle, WA', 'prospect', '["consulting","finance"]', colors[7]],
  ];

  const clientIds = [];
  for (const c of seedClients) {
    const r = insertClient.run(...c);
    clientIds.push(r.lastInsertRowid);
  }

  // Projects
  const projects = [
    [clientIds[0], 'Brand Redesign 2024', 'Complete visual identity overhaul', 'active', 18000, 10500, '2024-03-15', 62],
    [clientIds[0], 'E-commerce Platform', 'Full-stack store with payment integration', 'completed', 45000, 45000, '2023-12-01', 100],
    [clientIds[1], 'SaaS Dashboard', 'Analytics dashboard for TechFlow platform', 'active', 32000, 14200, '2024-04-30', 44],
    [clientIds[1], 'API Integration', 'Third-party API connectors module', 'planning', 12000, 0, '2024-06-01', 5],
    [clientIds[2], 'Website Redesign', 'Eco-friendly brand website', 'planning', 9500, 0, '2024-05-20', 10],
    [clientIds[3], 'Data Visualization Tool', 'Interactive BI reporting suite', 'active', 55000, 38000, '2024-03-28', 70],
    [clientIds[4], 'AI Chatbot MVP', 'Customer support AI assistant', 'active', 28000, 11000, '2024-04-15', 40],
    [clientIds[6], 'Game UI Framework', 'Reusable UI kit for mobile games', 'on-hold', 22000, 8000, '2024-07-01', 35],
  ];

  const projectIds = [];
  for (const p of projects) {
    const r = insertProject.run(...p);
    projectIds.push(r.lastInsertRowid);
  }

  // Invoices
  const invoices = [
    [clientIds[0], projectIds[0], 'INV-2024-001', 'paid', JSON.stringify([{desc:'Brand Strategy',qty:1,rate:3500},{desc:'Logo Design',qty:1,rate:2500},{desc:'Style Guide',qty:1,rate:1500}]), 7500, 750, 8250, '2024-01-15', '2024-01-10'],
    [clientIds[0], projectIds[1], 'INV-2024-002', 'paid', JSON.stringify([{desc:'E-commerce Development',qty:1,rate:25000},{desc:'Payment Integration',qty:1,rate:5000}]), 30000, 3000, 33000, '2023-11-30', '2023-11-25'],
    [clientIds[1], projectIds[2], 'INV-2024-003', 'sent', JSON.stringify([{desc:'Dashboard UI/UX',qty:1,rate:8000},{desc:'Frontend Development',qty:80,rate:75}]), 14000, 1400, 15400, '2024-02-28', null],
    [clientIds[3], projectIds[5], 'INV-2024-004', 'overdue', JSON.stringify([{desc:'BI Module Development',qty:1,rate:20000},{desc:'Data Modeling',qty:40,rate:125}]), 25000, 2500, 27500, '2024-01-31', null],
    [clientIds[4], projectIds[6], 'INV-2024-005', 'draft', JSON.stringify([{desc:'AI Model Training',qty:1,rate:8000},{desc:'Integration',qty:30,rate:100}]), 11000, 1100, 12100, '2024-03-31', null],
    [clientIds[1], projectIds[3], 'INV-2024-006', 'paid', JSON.stringify([{desc:'API Architecture',qty:1,rate:4000},{desc:'Documentation',qty:1,rate:1500}]), 5500, 550, 6050, '2024-01-20', '2024-01-18'],
    [clientIds[6], projectIds[7], 'INV-2024-007', 'sent', JSON.stringify([{desc:'UI Framework Design',qty:1,rate:6000},{desc:'Component Library',qty:1,rate:4000}]), 10000, 1000, 11000, '2024-02-15', null],
    [clientIds[0], projectIds[0], 'INV-2024-008', 'paid', JSON.stringify([{desc:'Motion Design',qty:1,rate:3500},{desc:'Asset Export',qty:1,rate:500}]), 4000, 400, 4400, '2024-02-10', '2024-02-08'],
  ];

  for (const inv of invoices) {
    insertInvoice.run(...inv);
  }

  // Notes
  const notes = [
    [clientIds[0], 'Client prefers morning meetings (PST). Very detail-oriented, always reviews mockups thoroughly before approval.'],
    [clientIds[0], 'Approved the revised color palette for the brand redesign. Moving forward with indigo + gold combination.'],
    [clientIds[1], 'Technical team lead is David Kim. All technical decisions go through him first.'],
    [clientIds[1], 'Prefers Slack for day-to-day communication. Send weekly progress reports every Friday.'],
    [clientIds[3], 'Enterprise contract — net 30 payment terms. Legal review required for all amendments.'],
    [clientIds[4], 'Startup with aggressive growth targets. Flexible on scope but deadline is firm.'],
    [clientIds[6], 'Time zone: CET. Best to schedule calls between 10am-12pm CET.'],
  ];

  for (const n of notes) {
    insertNote.run(...n);
  }

  // Update notes counts
  db.exec(`
    UPDATE clients SET notes_count = (
      SELECT COUNT(*) FROM client_notes WHERE client_notes.client_id = clients.id
    )
  `);

  // Activity log
  const activities = [
    ['client_created', 'New client added', 'Aisha Rahman from Nexus Digital joined', 'client', clientIds[0]],
    ['invoice_paid', 'Invoice paid', 'INV-2024-008 paid by Nexus Digital — $4,400', 'invoice', 8],
    ['project_updated', 'Project milestone', 'Brand Redesign 2024 reached 62% completion', 'project', projectIds[0]],
    ['invoice_overdue', 'Invoice overdue', 'INV-2024-004 from Apex Analytics is overdue', 'invoice', 4],
    ['client_created', 'New prospect', 'Omar Hassan from Starlight Ventures added as prospect', 'client', clientIds[7]],
    ['project_completed', 'Project completed', 'E-commerce Platform delivered to Nexus Digital', 'project', projectIds[1]],
    ['invoice_sent', 'Invoice sent', 'INV-2024-007 sent to Quantum Studios — $11,000', 'invoice', 7],
    ['note_added', 'Note added', 'New note added for TechFlow Inc', 'client', clientIds[1]],
  ];

  for (const a of activities) {
    insertActivity.run(...a);
  }
}

module.exports = db;
