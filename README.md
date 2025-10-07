# ROI Calculator Prototype README

## Overview
This is a lightweight, single-page web application for calculating ROI on switching from manual to automated invoicing. It includes:
- A frontend form for inputs and live simulation results.
- Backend REST API for simulations and CRUD on named scenarios.
- SQLite database for storing scenarios.
- PDF report generation (gated by email capture, logged to console for prototype).
- Favorable calculations with built-in bias to always show positive ROI for automation.

**Tech Stack:**
- Backend: Node.js + Express
- Database: SQLite (file: `scenarios.db`)
- Frontend: Vanilla HTML/JS/CSS (no build tools)
- PDF: pdfmake (server-side)
- Other: uuid, cors, body-parser
