# Expense Tracker

Personal expense tracker web app built with Python (Flask) and vanilla HTML/CSS/JavaScript.

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
copy .env.example .env
```
Update `.env` with your PostgreSQL database URL or use SQLite:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expense_tracker
SECRET_KEY=your-secret-key-here
```

## Run

Run the application:
```bash
python app.py
```
Open `http://localhost:5000` in your browser.
