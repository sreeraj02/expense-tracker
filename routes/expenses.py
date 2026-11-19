import csv
import io
from datetime import datetime, date
from flask import Blueprint, request, jsonify, session, Response
from sqlalchemy import desc
from db import get_db, Expense, Category
from routes.auth import login_required

expenses_bp = Blueprint("expenses", __name__, url_prefix="/api/expenses")

ALLOWED_PAYMENT_METHODS = {"Cash", "Card", "UPI", "Other"}

def parse_date(date_str):
    if not date_str:
        return date.today()
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None

def validate_expense_payload(data, db, user_id):
    title = (data.get("title") or "").strip()
    if not title:
        return None, "Title is required."
    if len(title) > 200:
        return None, "Title must be 200 characters or fewer."

    try:
        amount = float(data.get("amount", 0))
        if amount <= 0:
            return None, "Amount must be greater than ₹0."
    except (ValueError, TypeError):
        return None, "Please enter a valid numeric amount."

    payment_method = data.get("payment_method") or "Other"
    if payment_method not in ALLOWED_PAYMENT_METHODS:
        payment_method = "Other"

    expense_date_val = data.get("expense_date")
    parsed_date = parse_date(expense_date_val)
    if not parsed_date:
        return None, "Invalid date format. Use YYYY-MM-DD."

    category_id = data.get("category_id")
    if category_id:
        try:
            category_id = int(category_id)
            cat = db.query(Category).filter_by(id=category_id, user_id=user_id).first()
            if not cat:
                return None, "Selected category was not found."
        except (ValueError, TypeError):
            category_id = None
    else:
        category_id = None

    note = (data.get("note") or "").strip()

    return {
        "title": title,
        "amount": round(amount, 2),
        "payment_method": payment_method,
        "expense_date": parsed_date,
        "category_id": category_id,
        "note": note
    }, None

@expenses_bp.route("", methods=["GET"])
@login_required
def list_expenses():
    user_id = session["user_id"]
    search = (request.args.get("search") or "").strip()
    category_id = request.args.get("category_id")
    payment_method = request.args.get("payment_method")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    try:
        page = max(1, int(request.args.get("page", 1)))
        limit = min(100, max(1, int(request.args.get("limit", 10))))
    except ValueError:
        page, limit = 1, 10

    with get_db() as db:
        query = db.query(Expense).filter(Expense.user_id == user_id)

        if search:
            query = query.filter(
                (Expense.title.ilike(f"%{search}%")) | (Expense.note.ilike(f"%{search}%"))
            )

        if category_id and category_id.isdigit():
            query = query.filter(Expense.category_id == int(category_id))

        if payment_method and payment_method in ALLOWED_PAYMENT_METHODS:
            query = query.filter(Expense.payment_method == payment_method)

        if start_date:
            parsed_start = parse_date(start_date)
            if parsed_start:
                query = query.filter(Expense.expense_date >= parsed_start)

        if end_date:
            parsed_end = parse_date(end_date)
            if parsed_end:
                query = query.filter(Expense.expense_date <= parsed_end)

        total_count = query.count()
        total_pages = max(1, (total_count + limit - 1) // limit)
        offset = (page - 1) * limit

        expenses = query.order_by(
            desc(Expense.expense_date), desc(Expense.created_at)
        ).offset(offset).limit(limit).all()

        return jsonify({
            "expenses": [e.to_dict() for e in expenses],
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }), 200

@expenses_bp.route("", methods=["POST"])
@login_required
def create_expense():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}

    with get_db() as db:
        validated, error = validate_expense_payload(data, db, user_id)
        if error:
            return jsonify({"error": error}), 400

        expense = Expense(user_id=user_id, **validated)
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return jsonify({"expense": expense.to_dict()}), 201

@expenses_bp.route("/<int:expense_id>", methods=["GET"])
@login_required
def get_expense(expense_id):
    user_id = session["user_id"]
    with get_db() as db:
        expense = db.query(Expense).filter_by(id=expense_id, user_id=user_id).first()
        if not expense:
            return jsonify({"error": "Expense not found."}), 404
        return jsonify({"expense": expense.to_dict()}), 200

@expenses_bp.route("/<int:expense_id>", methods=["PUT"])
@login_required
def update_expense(expense_id):
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}

    with get_db() as db:
        expense = db.query(Expense).filter_by(id=expense_id, user_id=user_id).first()
        if not expense:
            return jsonify({"error": "Expense not found."}), 404

        validated, error = validate_expense_payload(data, db, user_id)
        if error:
            return jsonify({"error": error}), 400

        expense.title = validated["title"]
        expense.amount = validated["amount"]
        expense.payment_method = validated["payment_method"]
        expense.expense_date = validated["expense_date"]
        expense.category_id = validated["category_id"]
        expense.note = validated["note"]
        expense.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(expense)
        return jsonify({"expense": expense.to_dict()}), 200

@expenses_bp.route("/<int:expense_id>", methods=["DELETE"])
@login_required
def delete_expense(expense_id):
    user_id = session["user_id"]
    with get_db() as db:
        expense = db.query(Expense).filter_by(id=expense_id, user_id=user_id).first()
        if not expense:
            return jsonify({"error": "Expense not found."}), 404

        db.delete(expense)
        db.commit()
        return jsonify({"message": "Expense deleted successfully."}), 200

@expenses_bp.route("/summary", methods=["GET"])
@login_required
def get_summary():
    user_id = session["user_id"]
    today = date.today()
    current_year_month = (today.year, today.month)

    with get_db() as db:
        all_expenses = db.query(Expense).filter_by(user_id=user_id).all()
        categories = {c.id: c.name for c in db.query(Category).filter_by(user_id=user_id).all()}

        total_all_time = 0.0
        total_this_month = 0.0
        category_totals = {}
        monthly_map = {}

        for exp in all_expenses:
            amt = float(exp.amount)
            total_all_time += amt

            exp_date = exp.expense_date
            if exp_date and (exp_date.year, exp_date.month) == current_year_month:
                total_this_month += amt

            cat_name = categories.get(exp.category_id, "Uncategorized")
            category_totals[cat_name] = round(category_totals.get(cat_name, 0.0) + amt, 2)

            if exp_date:
                m_key = exp_date.strftime("%Y-%m")
                monthly_map[m_key] = round(monthly_map.get(m_key, 0.0) + amt, 2)

        sorted_months = sorted(monthly_map.keys())[-6:]
        monthly_trend = [{"month": m, "amount": monthly_map[m]} for m in sorted_months]

        category_breakdown = [
            {"category": k, "amount": v}
            for k, v in sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
        ]

        return jsonify({
            "total_this_month": round(total_this_month, 2),
            "total_all_time": round(total_all_time, 2),
            "total_count": len(all_expenses),
            "category_breakdown": category_breakdown,
            "monthly_trend": monthly_trend
        }), 200

@expenses_bp.route("/export", methods=["GET"])
@login_required
def export_csv():
    user_id = session["user_id"]
    search = (request.args.get("search") or "").strip()
    category_id = request.args.get("category_id")
    payment_method = request.args.get("payment_method")
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    with get_db() as db:
        query = db.query(Expense).filter(Expense.user_id == user_id)

        if search:
            query = query.filter(
                (Expense.title.ilike(f"%{search}%")) | (Expense.note.ilike(f"%{search}%"))
            )
        if category_id and category_id.isdigit():
            query = query.filter(Expense.category_id == int(category_id))
        if payment_method and payment_method in ALLOWED_PAYMENT_METHODS:
            query = query.filter(Expense.payment_method == payment_method)
        if start_date:
            parsed_start = parse_date(start_date)
            if parsed_start:
                query = query.filter(Expense.expense_date >= parsed_start)
        if end_date:
            parsed_end = parse_date(end_date)
            if parsed_end:
                query = query.filter(Expense.expense_date <= parsed_end)

        expenses = query.order_by(desc(Expense.expense_date), desc(Expense.created_at)).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Date", "Title", "Category", "Payment Method", "Amount (INR)", "Note"])

        for e in expenses:
            cat_name = e.category.name if e.category else "Uncategorized"
            writer.writerow([
                e.id,
                e.expense_date.isoformat() if e.expense_date else "",
                e.title,
                cat_name,
                e.payment_method,
                f"{float(e.amount):.2f}",
                e.note or ""
            ])

        csv_content = output.getvalue()
        filename = f"expenses_{date.today().isoformat()}.csv"

        return Response(
            csv_content,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
