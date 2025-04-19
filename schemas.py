from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    real_name: Optional[str] = None
    role: str = "user"  # 默认为普通用户

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    real_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    status: str = "正常"
    is_active: bool = True

    class Config:
        from_attributes = True

# --- Agenda Item Schemas ---
class AgendaItemBase(BaseModel):
    title: str
    files: Optional[List[Any]] = None  # 允许任何类型的列表元素，包括字符串和字典
    pages: Optional[List[str]] = None
    reporter: Optional[str] = None
    duration_minutes: Optional[int] = None

class AgendaItemCreate(AgendaItemBase):
    pass

class AgendaItemUpdate(AgendaItemBase):
    title: Optional[str] = None

class AgendaItem(AgendaItemBase):
    id: int
    meeting_id: str

    class Config:
        from_attributes = True

# --- Meeting Schemas ---
class MeetingBase(BaseModel):
    title: str
    intro: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = "未开始"

class MeetingCreate(MeetingBase):
    id: str  # 传入id，不使用自动生成
    part: Optional[List[AgendaItemCreate]] = []  # 用于创建议程

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    intro: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    part: Optional[List[AgendaItemCreate]] = None  # 用于更新议程

class Meeting(MeetingBase):
    id: str
    agenda_items: List[AgendaItem] = []

    class Config:
        from_attributes = True

class MeetingChangeStatus(BaseModel):
    """会议变更状态响应模型"""
    id: str
    meetings: List[dict] = []
