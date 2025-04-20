from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Boolean, UniqueConstraint
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
    package_path = Column(String, nullable=True) # 存储预生成的ZIP包路径

    agenda_items = relationship(
        "AgendaItem",
        back_populates="meeting",
        cascade="all, delete-orphan",  # 添加级联删除选项
        passive_deletes=True  # 使用数据库级别的级联删除
    )

class AgendaItem(Base):
    __tablename__ = "agenda_items"

    # 使用复合主键：会议ID和位置索引
    meeting_id = Column(String, ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    position = Column(Integer, primary_key=True)  # 议程项在会议中的位置

    title = Column(String, index=True)

    # 添加唯一约束，确保同一会议下议程项标题唯一
    __table_args__ = (
        UniqueConstraint('meeting_id', 'title', name='uix_meeting_agenda_title'),
    )
    # Store file and page lists as JSON strings
    # For more complex queries or relationships, consider separate tables
    files = Column(JSON, nullable=True)
    reporter = Column(String, nullable=True)  # 添加报告人字段
    duration_minutes = Column(Integer, nullable=True)  # 添加时长字段（分钟）
    pages = Column(JSON, nullable=True)

    meeting = relationship("Meeting", back_populates="agenda_items")

class SystemSetting(Base):
    """系统设置表，用于存储全局配置如会议变更识别码"""
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
