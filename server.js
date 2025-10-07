const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const fs = require('fs');
const path = require('path');

pdfMake.vfs = pdfFonts.pdfMake.vfs;

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure directories
if (!fs.existsSync('./scenarios.db')) {
  fs.writeFileSync('./scenarios.db', '');
}
if (!fs.existsSync('./public/reports')) {
  fs.mkdirSync('./public/reports', { recursive: true });
}

const db = new sqlite3.Database('./scenarios.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    inputs TEXT,
    results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

const constants = {
  automated_cost_per_invoice: 0.20,
  error_rate_auto: 0.001, // 0.1%
  min_roi_boost_factor: 1.1
};

function calculateResults(inputs) {
  const {
    monthly_invoice_volume,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months,
    one_time_implementation_cost = 50000
  } = inputs;

  const labor_cost_manual = monthly_invoice_volume * avg_hours_per_invoice * hourly_wage;
  const auto_cost = monthly_invoice_volume * constants.automated_cost_per_invoice;
  const error_savings = ((error_rate_manual / 100) - constants.error_rate_auto) * monthly_invoice_volume * error_cost;
  let monthly_savings = (labor_cost_manual + error_savings) - auto_cost;
  monthly_savings = monthly_savings * constants.min_roi_boost_factor;
  const cumulative_savings = monthly_savings * time_horizon_months;
  const net_savings = cumulative_savings - one_time_implementation_cost;

  let payback_months, roi_percentage;
  if (one_time_implementation_cost <= 0) {
    payback_months = 0;
    roi_percentage = 'Infinite';
  } else {
    payback_months = one_time_implementation_cost / monthly_savings;
    roi_percentage = (net_savings / one_time_implementation_cost) * 100;
  }

  return {
    monthly_savings: Math.round(monthly_savings),
    cumulative_savings: Math.round(cumulative_savings),
    net_savings: Math.round(net_savings),
    payback_months: Math.round(payback_months * 10) / 10,
    roi_percentage: roi_percentage === 'Infinite' ? 'Infinite' : Math.round(roi_percentage * 10) / 10 + '%'
  };
}

app.post('/api/simulate', (req, res) => {
  try {
    const inputs = req.body;
    if (!inputs.monthly_invoice_volume || !inputs.avg_hours_per_invoice || !inputs.hourly_wage || !inputs.error_rate_manual || !inputs.error_cost || !inputs.time_horizon_months) {
      return res.status(400).json({ error: 'Missing required inputs' });
    }
    const results = calculateResults(inputs);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/scenarios', (req, res) => {
  const { scenario_name, ...inputs } = req.body;
  if (!scenario_name) return res.status(400).json({ error: 'Scenario name required' });
  const id = uuidv4();
  const results = calculateResults(inputs);
  const stmt = db.prepare('INSERT INTO scenarios (id, name, inputs, results) VALUES (?, ?, ?, ?)');
  stmt.run(id, scenario_name, JSON.stringify(inputs), JSON.stringify(results), (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, name: scenario_name });
  });
  stmt.finalize();
});

app.get('/api/scenarios', (req, res) => {
  db.all('SELECT id, name FROM scenarios', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/scenarios/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM scenarios WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Not found' });
    res.json({
      id: row.id,
      name: row.name,
      inputs: JSON.parse(row.inputs),
      results: JSON.parse(row.results)
    });
  });
});

app.delete('/api/scenarios/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM scenarios WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });
});

app.post('/api/report/generate', (req, res) => {
  const { scenario_id, email } = req.body;
  if (!scenario_id || !email) return res.status(400).json({ error: 'Scenario ID and email required' });
  console.log(`Lead captured: ${email} for scenario ${scenario_id}`);
  db.get('SELECT * FROM scenarios WHERE id = ?', [scenario_id], (err, row) => {
    if (err || !row) return res.status(404).json({ error: 'Scenario not found' });
    const inputs = JSON.parse(row.inputs);
    const results = JSON.parse(row.results);
    const docDefinition = {
      content: [
        { text: 'Invoicing Automation ROI Report', style: 'header' },
        { text: `Scenario: ${row.name}` },
        '\n',
        { text: 'Inputs:', style: 'subheader' },
        {
          ul: [
            `Monthly Invoice Volume: ${inputs.monthly_invoice_volume}`,
            `Number of AP Staff: ${inputs.num_ap_staff || 'N/A'}`, 
            `Average Hours per Invoice (Manual): ${inputs.avg_hours_per_invoice}`,
            `Hourly Wage: $${inputs.hourly_wage}`,
            `Manual Error Rate: ${inputs.error_rate_manual}%`,
            `Error Fix Cost: $${inputs.error_cost}`,
            `Time Horizon: ${inputs.time_horizon_months} months`,
            `One-Time Implementation Cost: $${inputs.one_time_implementation_cost || 50000}`
          ]
        },
        '\n',
        { text: 'Results:', style: 'subheader' },
        {
          ul: [
            `Monthly Savings: $${results.monthly_savings.toLocaleString()}`,
            `Payback Period: ${results.payback_months} months`,
            `ROI (${inputs.time_horizon_months} months): ${results.roi_percentage}`,
            `Net Savings: $${results.net_savings.toLocaleString()}`
          ]
        },
        { text: `\nReport generated: ${new Date().toLocaleString()}` },
        { text: '\nThank you for using BLACKBOX.AI Assistant\'s ROI Calculator!' }
      ],
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] }
      }
    };
    const filename = path.join(__dirname, 'public', 'reports', `${scenario_id}.pdf`);
    pdfMake.createPdf(docDefinition).getBuffer((buffer) => {
      fs.writeFileSync(filename, buffer);
      res.json({ download_url: `/reports/${scenario_id}.pdf` });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
