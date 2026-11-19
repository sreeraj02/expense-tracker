import re
from functools import wraps
from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from db import get_db, User, seed_default_categories

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not username or len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username must be between 3 and 50 characters."}), 400

    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email):
        return jsonify({"error": "Please provide a valid email address."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters long."}), 400

    with get_db() as db:
        if db.query(User).filter(User.username.ilike(username)).first():
            return jsonify({"error": "Username is already taken."}), 409
        if db.query(User).filter(User.email.ilike(email)).first():
            return jsonify({"error": "Email is already registered."}), 409

        user = User(
            username=username,
            email=email,
            password_hash=generate_password_hash(password)
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_default_categories(db, user.id)

        session["user_id"] = user.id
        session["username"] = user.username
        return jsonify({"user": user.to_dict()}), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("username_or_email") or "").strip()
    password = data.get("password") or ""

    if not identifier or not password:
        return jsonify({"error": "Username/email and password are required."}), 400

    with get_db() as db:
        user = db.query(User).filter(
            (User.username.ilike(identifier)) | (User.email.ilike(identifier))
        ).first()

        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid credentials."}), 401

        session["user_id"] = user.id
        session["username"] = user.username
        return jsonify({"user": user.to_dict()}), 200

@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."}), 200

@auth_bp.route("/me", methods=["GET"])
def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    with get_db() as db:
        user = db.query(User).filter_by(id=user_id).first()
        if not user:
            session.clear()
            return jsonify({"error": "User not found."}), 401
        return jsonify({"user": user.to_dict()}), 200
