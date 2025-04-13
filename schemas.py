from pydantic import BaseModel
from typing import List, Optional

# --- Agenda Item Schemas ---
class AgendaItemBase(BaseModel):
    title: str
    files: Optional[List[str]] = None
    pages: Optional[List[str]] = None

class AgendaItemCreate(AgendaItemBase):
    # Fields for creating a new agenda item (inherited from Base)
    reporter: Optional[str] = None # Added based on form
    duration_minutes: Optional[int] = None # Added based on form

# New schema for updating existing or creating new agenda items within a meeting update
class AgendaItemUpdate(AgendaItemBase):
    id: Optional[int] = None # ID is optional: present for update/delete, absent for create
    reporter: Optional[str] = None # Added based on form
    duration_minutes: Optional[int] = None # Added based on form

class AgendaItem(AgendaItemBase):
    id: int
    reporter: Optional[str] = None # Added based on form
    duration_minutes: Optional[int] = None # Added based on form
    meeting_id: str

    class Config:
        orm_mode = True # Changed from from_attributes=True for compatibility with older Pydantic/FastAPI if needed

# --- Meeting Schemas ---
class MeetingBase(BaseModel):
    title: str
    intro: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = "未开始"

class MeetingCreate(MeetingBase):
    id: str # Require ID on creation based on seed data example
    part: Optional[List[AgendaItemCreate]] = [] # Allow creating agenda items along with meeting

class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    intro: Optional[str] = None
    time: Optional[str] = None
    status: Optional[str] = None
    agenda_items: Optional[List[AgendaItemUpdate]] = None # Allow updating agenda items

class Meeting(MeetingBase):
    id: str
    agenda_items: List[AgendaItem] = []

    class Config:
        orm_mode = True # Changed from from_attributes=True
