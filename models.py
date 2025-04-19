from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    real_name = Column(String, nullable=True)
    hashed_password = Column(String)
    role = Column(String, default="user")  # 'admin', 'user', 'guest'
    status = Column(String, default="正常")  # '正常', '禁用'
    is_active = Column(Boolean, default=True)
    
    # 这里可以添加与会议或其他实体的关系，如果需要的话

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
    reporter = Column(String, nullable=True)  # 添加报告人字段
    duration_minutes = Column(Integer, nullable=True)  # 添加时长字段（分钟）
    pages = Column(JSON, nullable=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))

    meeting = relationship("Meeting", back_populates="agenda_items")

class SystemSetting(Base):
    """系统设置表，用于存储全局配置如会议变更识别码"""
    __tablename__ = "system_settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
