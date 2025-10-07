const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const PDFDocument = require('pdfkit');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

const constants = {
  automated_cost_per_invoice: 0.2,
  error_rate_auto: 0.001,
  min_roi_boost_factor: 1.1
};

const db = new sqlite3.Database('./scenarios.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite DB.');
});

db.run(`CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_name TEXT,
  monthly_invoice_volume INTEGER,
  num_ap_staff INTEGER,
  avg_hours_per_invoice REAL,
  hourly_wage REAL,
  error_rate_manual REAL,
  error_cost REAL,
  time_horizon_months INTEGER,
  one_time_implementation_cost REAL
)`);

function runSimulation(data) {
  const {
    monthly_invoice_volume,
    num_ap_staff,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months,
    one_time_implementation_cost = 0
  } = data;

  const labor_cost_manual = num_ap_staff * hourly_wage * avg_hours_per_invoice * monthly_invoice_volume;
  const auto_cost = monthly_invoice_volume * constants.automated_cost_per_invoice;
  const error_savings = (error_rate_manual - constants.error_rate_auto) * monthly_invoice_volume * error_cost;
  let monthly_savings = (labor_cost_manual + error_savings - auto_cost) * constants.min_roi_boost_factor;
  monthly_savings = Math.max(1, monthly_savings);
  const cumulative_savings = monthly_savings * time_horizon_months;
  const net_savings = cumulative_savings - one_time_implementation_cost;
  const payback_months = one_time_implementation_cost / monthly_savings;
  const roi_percentage = (net_savings / one_time_implementation_cost) * 100 || 0;

  return {
    monthly_savings: monthly_savings.toFixed(2),
    cumulative_savings: cumulative_savings.toFixed(2),
    net_savings: net_savings.toFixed(2),
    payback_months: payback_months.toFixed(2),
    roi_percentage: roi_percentage.toFixed(2)
  };
}

// POST /simulate
app.post('/simulate', (req, res) => {
  try {
    const result = runSimulation(req.body);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /scenarios
app.post('/scenarios', (req, res) => {
  const {
    scenario_name,
    monthly_invoice_volume,
    num_ap_staff,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months,
    one_time_implementation_cost
  } = req.body;

  const sql = `INSERT INTO scenarios 
    (scenario_name, monthly_invoice_volume, num_ap_staff, avg_hours_per_invoice, hourly_wage, error_rate_manual, error_cost, time_horizon_months, one_time_implementation_cost) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    scenario_name,
    monthly_invoice_volume,
    num_ap_staff,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months,
    one_time_implementation_cost
  ];

  db.run(sql, params, function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// GET /scenarios
app.get('/scenarios', (req, res) => {
  db.all('SELECT * FROM scenarios ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(rows);
  });
});

// GET /scenarios/:id
app.get('/scenarios/:id', (req, res) => {
  db.get('SELECT * FROM scenarios WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(row);
  });
});

// POST /report/generate
app.post('/report/generate', (req, res) => {
  const { email, scenario } = req.body;
  if (!email || !scenario) return res.status(400).json({ error: "Email and scenario required" });

  const doc = new PDFDocument();
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfData = Buffer.concat(buffers);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${scenario.scenario_name || 'report'}.pdf"`
    });
    res.send(pdfData);
  });

  doc.fontSize(20).text('Invoicing ROI Simulator Report', { align: 'center' }).moveDown();
  doc.fontSize(14).text(`Scenario: ${scenario.scenario_name || 'N/A'}`);
  Object.entries(scenario).forEach(([key, val]) => {
    if (key !== 'scenario_name') doc.text(`${key.replace(/_/g, ' ')}: ${val}`);
  });
  doc.moveDown();

  const results = runSimulation(scenario);
  Object.entries(results).forEach(([key, val]) => {
    doc.text(`${key.replace(/_/g, ' ')}: $${val}`);
  });
  doc.end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
