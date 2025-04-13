from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, index=True) # Using String ID as per example
    title = Column(String, index=True)
    intro = Column(Text, nullable=True)
    time = Column(String, nullable=True) # Store time as string for simplicity, consider DateTime for real apps
    status = Column(String, default="未开始") # Add a status field

    agenda_items = relationship("AgendaItem", back_populates="meeting")

class AgendaItem(Base):
    __tablename__ = "agenda_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    # Store file and page lists as JSON strings
    # For more complex queries or relationships, consider separate tables
    files = Column(JSON, nullable=True)
    pages = Column(JSON, nullable=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))

    meeting = relationship("Meeting", back_populates="agenda_items")
