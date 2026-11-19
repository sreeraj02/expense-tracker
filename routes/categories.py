from flask import Blueprint, request, jsonify, session
from db import get_db, Category, Expense
from routes.auth import login_required

categories_bp = Blueprint("categories", __name__, url_prefix="/api/categories")

@categories_bp.route("", methods=["GET"])
@login_required
def get_categories():
    user_id = session["user_id"]
    with get_db() as db:
        categories = db.query(Category).filter_by(user_id=user_id).order_by(Category.name.asc()).all()
        return jsonify({"categories": [c.to_dict() for c in categories]}), 200

@categories_bp.route("", methods=["POST"])
@login_required
def create_category():
    user_id = session["user_id"]
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()

    if not name or len(name) > 50:
        return jsonify({"error": "Category name must be between 1 and 50 characters."}), 400

    with get_db() as db:
        existing = db.query(Category).filter(
            Category.user_id == user_id,
            Category.name.ilike(name)
        ).first()
        if existing:
            return jsonify({"error": f"Category '{name}' already exists."}), 409

        cat = Category(user_id=user_id, name=name)
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return jsonify({"category": cat.to_dict()}), 201

@categories_bp.route("/<int:category_id>", methods=["DELETE"])
@login_required
def delete_category(category_id):
    user_id = session["user_id"]
    with get_db() as db:
        cat = db.query(Category).filter_by(id=category_id, user_id=user_id).first()
        if not cat:
            return jsonify({"error": "Category not found."}), 404

        # Nullify category references on existing expenses
        db.query(Expense).filter_by(user_id=user_id, category_id=category_id).update({"category_id": None})
        db.delete(cat)
        db.commit()
        return jsonify({"message": f"Category '{cat.name}' deleted."}), 200
