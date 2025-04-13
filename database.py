from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Define the database URL for SQLite
# This will create a file named 'meetings.db' in the current directory
SQLALCHEMY_DATABASE_URL = "sqlite:///./meetings.db"

# Create the SQLAlchemy engine
# connect_args is needed only for SQLite to allow multithreading
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a SessionLocal class
# Each instance of SessionLocal will be a database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our models (already defined in models.py, but often included here too for context)
# We will import Base from models.py when creating tables
Base = declarative_base()

# Function to create database tables
def create_db_tables():
    # Import Base from models and create all tables
    from models import Base
    Base.metadata.create_all(bind=engine)

# Dependency to get DB session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
