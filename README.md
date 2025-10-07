# To create the Invoice ROI Simulator, the most efficient solution is to use a Flask backend, MongoDB for scenario storage, and a simple React frontend for the SPA. This stack enables rapid development with full CRUD and API support.

High-Level Architecture
Frontend: React.js SPA

Backend: Flask REST API (Python)

Database: MongoDB (local or cloud, e.g., Atlas or localhost)

PDF/HTML Report: Python library (xhtml2pdf, WeasyPrint, or HTML template download in frontend)

Hosting: Local (with option for ngrok demo)

STRUCTURE:
invoice-roi-simulator/
  backend/
    app.py         # Flask API
    models.py      # MongoDB models
    utils.py       # Calculation logic
    requirements.txt
  frontend/
    src/
      App.js       # Main React SPA
      api.js       # API helpers
      components/  # Form, Results, Scenario List, Email Modal
    package.json
  README.md


#Backend (Flask API)
Key Endpoints:

POST /simulate — Receives scenario input, returns simulation results (no DB save)

POST /scenarios — Save scenario

GET /scenarios — List scenario names/ids

GET /scenarios/<id> — Get scenario detail

DELETE /scenarios/<id> — Delete scenario

POST /report/generate — Email-gated report generation (takes scenario data + email, returns download link or file)

Calculation Logic (in utils.py):

Uses internal constants only in backend

Implements the PRD math formulas exactly, including the built-in bias factor to favor automation

MongoDB Model:

Stores scenario inputs + computed results

Indexed by unique name or ID

#Frontend (React SPA)
Feature Flow:

User enters scenario data in a form

See live results (/simulate API)

Can save with a scenario name

Can load/delete scenarios

Download report button triggers an email gate modal; enters email to get PDF/HTML
