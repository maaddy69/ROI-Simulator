import React, { useState, useEffect } from 'react';

const initialForm = {
  scenario_name: '',
  monthly_invoice_volume: 2000,
  num_ap_staff: 3,
  avg_hours_per_invoice: 0.17,
  hourly_wage: 30,
  error_rate_manual: 0.005,
  error_cost: 100,
  time_horizon_months: 36,
  one_time_implementation_cost: 50000
};

function App() {
  const [form, setForm] = useState(initialForm);
  const [results, setResults] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [email, setEmail] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    fetch('http://localhost:5000/scenarios')
      .then(res => res.json())
      .then(setScenarios)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch('http://localhost:5000/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(res => res.json()).then(setResults).catch(console.error);
  }, [form]);

  function saveScenario() {
    fetch('http://localhost:5000/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(() => alert('Scenario saved!')).catch(console.error);
  }

  function loadScenario(id) {
    if (!id) return;
    fetch(`http://localhost:5000/scenarios/${id}`)
      .then(res => res.json())
      .then(data => setForm(data))
      .catch(console.error);
  }

  function generateReport() {
    if (!email) return alert('Please enter an email.');
    setLoadingReport(true);
    fetch('http://localhost:5000/report/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, scenario: form }),
    })
    .then(async res => {
      if (!res.ok) throw new Error('Failed to generate report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${form.scenario_name || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    })
    .catch(alert)
    .finally(() => setLoadingReport(false));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === 'scenario_name' ? value : Number(value) }));
  }

  return (
    <div style={{ maxWidth: 600, margin: 'auto', padding: 20 }}>
      <h1>Invoicing ROI Simulator</h1>
      <input
        type="text"
        name="scenario_name"
        placeholder="Scenario Name"
        value={form.scenario_name}
        onChange={handleChange}
      />
      {[
        'monthly_invoice_volume',
        'num_ap_staff',
        'avg_hours_per_invoice',
        'hourly_wage',
        'error_rate_manual',
        'error_cost',
        'time_horizon_months',
        'one_time_implementation_cost'
      ].map(field => (
        <div key={field} style={{ marginTop: 10 }}>
          <label>{field.replace(/_/g, ' ')}</label><br />
          <input
            type="number"
            step={field === 'error_rate_manual' ? "0.001" : "any"}
            name={field}
            value={form[field]}
            onChange={handleChange}
          />
        </div>
      ))}
      <button onClick={saveScenario} style={{ marginTop: 10 }}>Save Scenario</button>

      <select onChange={e => loadScenario(e.target.value)} style={{ marginLeft: 10 }}>
        <option value="">Load Scenario</option>
        {scenarios.map(s => (
          <option key={s.id} value={s.id}>{s.scenario_name}</option>
        ))}
      </select>

      {results && (
        <div style={{ background: '#eee', marginTop: 20, padding: 10 }}>
          <h3>Results</h3>
          {Object.entries(results).map(([k, v]) => (
            <div key={k}>{k.replace(/_/g, ' ')}: ${v}</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <input
          type="email"
          placeholder="Email for report"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button onClick={generateReport} disabled={loadingReport}>
          {loadingReport ? 'Generating...' : 'Download Report'}
        </button>
      </div>
    </div>
  );
}

export default App;


