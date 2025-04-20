from sqlalchemy.orm import Session
import models, schemas
from passlib.context import CryptContext
import uuid

# 创建密码哈希处理工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- User CRUD ---

def get_user(db: Session, user_id: int):
    """获取单个用户（通过ID）"""
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    """获取单个用户（通过用户名）"""
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    """获取用户列表"""
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    """创建新用户"""
    # 创建密码哈希
    hashed_password = pwd_context.hash(user.password)

    # 创建用户对象
    db_user = models.User(
        username=user.username,
        real_name=user.real_name,
        hashed_password=hashed_password,
        role=user.role
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    """更新用户信息"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        return None

    # 更新用户基本信息
    update_data = user_update.dict(exclude_unset=True)

    # 如果更新包含密码，需要创建密码哈希
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = pwd_context.hash(update_data.pop("password"))

    # 更新用户字段
    for key, value in update_data.items():
        if hasattr(db_user, key) and value is not None:
            setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int):
    """删除用户"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        return False

    db.delete(db_user)
    db.commit()
    return True

def verify_password(plain_password, hashed_password):
    """验证密码"""
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        # 如果哈希验证失败，尝试直接比较纯文本密码
        return plain_password == hashed_password

def authenticate_user(db: Session, username: str, password: str):
    """用户认证"""
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

# --- Meeting CRUD ---

def get_meeting(db: Session, meeting_id: str):
    """获取单个会议（包括议程项）"""
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()

def get_meetings(db: Session):
    """获取所有会议列表（不包括议程项，用于列表显示）"""
    # Eager load agenda_items if needed for list view, but usually not
    # return db.query(models.Meeting).options(joinedload(models.Meeting.agenda_items)).all()
    return db.query(models.Meeting).all()

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
    # 首先检查同一会议下是否有重复的议程项标题
    titles = [item.title for item in meeting.part]
    duplicate_titles = [title for title in titles if titles.count(title) > 1]
    if duplicate_titles:
        raise ValueError(f"同一会议下存在重复的议程项标题: {', '.join(set(duplicate_titles))}")

    # 检查每个议程项是否至少包含一个文件
    empty_file_items = []
    for item in meeting.part:
        if not item.files or len(item.files) == 0:
            empty_file_items.append(item.title or f"议程项 {len(empty_file_items) + 1}")

    if empty_file_items:
        raise ValueError(f"以下议程项没有文件: {', '.join(empty_file_items)}")

    for position, item_data in enumerate(meeting.part, start=1):
        db_item = models.AgendaItem(
            title=item_data.title,
            files=item_data.files,
            pages=item_data.pages,
            meeting_id=db_meeting.id,
            position=position,
            reporter=item_data.reporter,
            duration_minutes=item_data.duration_minutes
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

        # 获取议程项数据
        agenda_items_data = update_data.pop('part', None)

        for key, value in update_data.items():
            setattr(db_meeting, key, value)

        # 2. Handle agenda items update if provided
        if agenda_items_data is not None: # 检查part字段是否存在于请求中
            # Delete existing agenda items for this meeting
            db.query(models.AgendaItem).filter(models.AgendaItem.meeting_id == meeting_id).delete()
            db.flush() # Ensure deletes happen before adds in this transaction

            # 首先检查同一会议下是否有重复的议程项标题
            titles = [item.get('title') for item in agenda_items_data]
            duplicate_titles = [title for title in titles if titles.count(title) > 1]
            if duplicate_titles:
                raise ValueError(f"同一会议下存在重复的议程项标题: {', '.join(set(duplicate_titles))}")

            # 检查每个议程项是否至少包含一个文件
            empty_file_items = []
            for i, item in enumerate(agenda_items_data):
                files = item.get('files', [])
                if not files or len(files) == 0:
                    empty_file_items.append(item.get('title') or f"议程项 {i + 1}")

            if empty_file_items:
                raise ValueError(f"以下议程项没有文件: {', '.join(empty_file_items)}")

            # Create new agenda items from the provided data
            for position, item_data_dict in enumerate(agenda_items_data, start=1):
                # Convert dict back to Pydantic model for potential validation/defaults
                item_data = schemas.AgendaItemCreate(**item_data_dict)
                db_item = models.AgendaItem(
                    title=item_data.title,
                    reporter=item_data.reporter,
                    duration_minutes=item_data.duration_minutes,
                    files=item_data.files,
                    pages=item_data.pages,
                    meeting_id=meeting_id, # Associate with the current meeting
                    position=position # Set the position based on the order in the list
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
        # 先手动删除议程项，避免外键约束问题
        db.query(models.AgendaItem).filter(models.AgendaItem.meeting_id == meeting_id).delete(synchronize_session=False)
        db.flush()

        # 然后删除会议
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

def get_meeting_change_status_token(db: Session):
    """获取会议变更状态识别码"""
    token = db.query(models.SystemSetting).filter(models.SystemSetting.key == "meeting_change_status_token").first()
    if not token:
        # 如果不存在，初始化一个识别码
        new_token = models.SystemSetting(
            key="meeting_change_status_token",
            value=str(uuid.uuid4())
        )
        db.add(new_token)
        db.commit()
        return new_token.value
    return token.value

def update_meeting_change_status_token(db: Session):
    """更新会议变更状态识别码"""
    token = db.query(models.SystemSetting).filter(models.SystemSetting.key == "meeting_change_status_token").first()
    old_token_value = token.value if token else None

    # 生成新的识别码，确保与旧的不同
    new_token_value = str(uuid.uuid4())
    # 极少数情况下可能生成相同的UUID，确保生成的新值与旧值不同
    while old_token_value and new_token_value == old_token_value:
        print(f"[识别码] 新旧识别码相同，重新生成: {new_token_value}")
        new_token_value = str(uuid.uuid4())

    print(f"[识别码] 旧识别码: {old_token_value}, 新识别码: {new_token_value}")

    if token:
        # 更新现有的识别码
        token.value = new_token_value
        db.commit()
        db.refresh(token)  # 确保刷新数据库对象
        print(f"[识别码] 更新后的值: {token.value}")
        return token.value
    else:
        # 如果不存在，创建一个新的
        new_token = models.SystemSetting(
            key="meeting_change_status_token",
            value=new_token_value
        )
        db.add(new_token)
        db.commit()
        db.refresh(new_token)  # 确保刷新数据库对象
        print(f"[识别码] 新创建的值: {new_token.value}")
        return new_token.value
