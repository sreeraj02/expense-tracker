# Expense Tracker

A clean, responsive, and minimal personal expense tracker web application built with Python (Flask) and vanilla frontend technologies.

---

## Tech Stack Choices

- **Backend:** Python (Flask)
- **Database & ORM:** PostgreSQL / SQLite via SQLAlchemy & psycopg2 (with automatic table initialization on first run)
- **Frontend:** Vanilla HTML5, CSS3 (responsive dark theme design system), Vanilla JavaScript (Fetch API, no frameworks)
- **Charts & Visualizations:** Chart.js (via CDN)
- **Authentication & Security:** Session-based authentication with Werkzeug password hashing (`pbkdf2:sha256`)
- **Configuration:** Environment-driven via `.env` (`DATABASE_URL`, `SECRET_KEY`) using `python-dotenv`

---

## What's Done & Features

1. **User Authentication & Scoping**
   - User registration with unique username and email validation.
   - Secure login and logout with session cookies.
   - All expense and category endpoints are strictly protected and scoped to the logged-in user.

2. **Expense Management (CRUD)**
   - Add new expenses with title, amount (₹ in INR), category, payment method, date, and optional notes.
   - Pre-filled date picker defaulting to today's date.
   - Edit existing expenses inline via dedicated modal.
   - Delete expenses with immediate confirmation and balance refresh.
   - Expenses listed newest first with formatted dates and amounts (`₹xx.xx`).

3. **Search, Filtering & Pagination**
   - Instant search across expense titles and notes.
   - Filter by category, payment method (`UPI`, `Card`, `Cash`, `Other`), and date range (`start_date` to `end_date`).
   - One-click "Clear Filters" reset button.
   - Client and server-side pagination with next/previous controls.

4. **Analytics & Dashboard**
   - Real-time metric cards: Current Month Total, All-Time Total, and Transaction Count.
   - **Category Distribution Chart:** Interactive doughnut chart visualizing spending by category.
   - **Monthly Summary Chart:** Bar chart showing spending trends across recent months.

5. **Category Management**
   - Auto-seeded default categories on registration: *Food, Transport, Bills, Shopping, Health, Entertainment, Other*.
   - Add custom categories with duplicate name prevention per user.
   - Delete custom categories safely (expenses automatically reassigned to Uncategorized).

6. **CSV Export**
   - One-click export of filtered or all expenses into a `.csv` file with headers: `ID, Date, Title, Category, Payment Method, Amount (INR), Note`.

7. **Validation & UX**
   - Server-side and client-side validation ensuring `amount > 0` and non-empty titles.
   - Real-time toast notifications for errors, confirmations, and success feedback.

---

## Setup

1. **Clone the repository:**
```bash
git clone https://github.com/sreeraj02/expense-tracker.git
cd expense-tracker
```

2. **Create and activate a virtual environment:**
```bash
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# Windows (Command Prompt):
venv\Scripts\activate.bat

# Linux / macOS:
source venv/bin/activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables:**
```bash
copy .env.example .env
```
Update `.env` with your PostgreSQL database URL or use SQLite:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expense_tracker
SECRET_KEY=change-this-to-a-secure-random-secret-key-in-production
```
*(If left unset or set to SQLite, it will automatically use local `expense_tracker.db`)*

---

## Run

Start the application:
```bash
python app.py
```

Open **http://localhost:5000** in your web browser.
