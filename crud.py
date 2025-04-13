from sqlalchemy.orm import Session
import models, schemas

# --- Meeting CRUD ---

def get_meeting(db: Session, meeting_id: str):
    """获取单个会议（包括议程项）"""
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    """获取会议列表（不包括议程项，用于列表显示）"""
    # Eager load agenda_items if needed for list view, but usually not
    # return db.query(models.Meeting).options(joinedload(models.Meeting.agenda_items)).offset(skip).limit(limit).all()
    return db.query(models.Meeting).offset(skip).limit(limit).all()

def create_meeting(db: Session, meeting: schemas.MeetingCreate):
    """创建新会议"""
    # Create Meeting object first
    db_meeting = models.Meeting(
        id=meeting.id,
        title=meeting.title,
        intro=meeting.intro,
        time=meeting.time,
        status=meeting.status or "未开始"
    )
    db.add(db_meeting)
    db.flush() # Flush to ensure meeting exists before adding items if needed, or commit later

    # Create associated AgendaItem objects
    for item_data in meeting.part:
        db_item = models.AgendaItem(
            title=item_data.title,
            files=item_data.files,
            pages=item_data.pages,
            meeting_id=db_meeting.id
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_meeting) # Refresh to get updated state like auto-generated IDs if any
    return db_meeting

def update_meeting_status(db: Session, meeting_id: str, status: str):
    """更新会议状态"""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting:
        db_meeting.status = status
        db.commit()
        db.refresh(db_meeting)
    return db_meeting

def update_meeting(db: Session, meeting_id: str, meeting_update: schemas.MeetingUpdate):
    """更新会议信息，包括其议程项（采用删除旧项，添加新项的策略）"""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting:
        # 1. Update basic meeting attributes
        update_data = meeting_update.dict(exclude_unset=True)

        # Separate agenda_items from other fields
        agenda_items_data = update_data.pop('agenda_items', None) # Use pop to remove it

        for key, value in update_data.items():
            setattr(db_meeting, key, value)

        # 2. Handle agenda items update if provided
        if agenda_items_data is not None: # Check if agenda_items key was present in the request
            # Delete existing agenda items for this meeting
            db.query(models.AgendaItem).filter(models.AgendaItem.meeting_id == meeting_id).delete()
            db.flush() # Ensure deletes happen before adds in this transaction

            # Create new agenda items from the provided data
            for item_data_dict in agenda_items_data:
                # Convert dict back to Pydantic model for potential validation/defaults
                item_data = schemas.AgendaItemUpdate(**item_data_dict)
                db_item = models.AgendaItem(
                    title=item_data.title,
                    reporter=item_data.reporter,
                    duration_minutes=item_data.duration_minutes,
                    files=item_data.files,
                    pages=item_data.pages,
                    meeting_id=meeting_id # Associate with the current meeting
                    # Note: We are ignoring item_data.id here as we delete and recreate
                )
                db.add(db_item)

        # 3. Commit changes and refresh
        db.commit()
        db.refresh(db_meeting) # Refresh to load the newly added agenda items

    return db_meeting

def delete_meeting(db: Session, meeting_id: str):
    """删除会议（包括其所有议程项）"""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting:
        # SQLAlchemy cascade delete should handle AgendaItems if relationship is configured correctly
        # Otherwise, delete items manually first:
        # db.query(models.AgendaItem).filter(models.AgendaItem.meeting_id == meeting_id).delete()
        db.delete(db_meeting)
        db.commit()
        return True
    return False

# --- Agenda Item CRUD (if needed separately) ---

# def create_meeting_agenda_item(db: Session, item: schemas.AgendaItemCreate, meeting_id: str):
#     db_item = models.AgendaItem(**item.dict(), meeting_id=meeting_id)
#     db.add(db_item)
#     db.commit()
#     db.refresh(db_item)
#     return db_item
