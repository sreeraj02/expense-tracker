import os
from datetime import datetime, date
from contextlib import contextmanager
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, Numeric, 
    Date, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///expense_tracker.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

DEFAULT_CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Other"]

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(50), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_category"),)

    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name
        }

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(200), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(20), nullable=False, default="Other")
    expense_date = Column(Date, nullable=False, default=date.today)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else "Uncategorized",
            "title": self.title,
            "amount": float(self.amount) if self.amount is not None else 0.0,
            "payment_method": self.payment_method,
            "expense_date": self.expense_date.isoformat() if self.expense_date else None,
            "note": self.note or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

def init_db():
    Base.metadata.create_all(bind=engine)

def seed_default_categories(db_session, user_id):
    existing = {c.name for c in db_session.query(Category).filter_by(user_id=user_id).all()}
    for cat_name in DEFAULT_CATEGORIES:
        if cat_name not in existing:
            db_session.add(Category(user_id=user_id, name=cat_name))
    db_session.commit()

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
