# 无纸化会议系统数据库设计文档

本文档详细描述了无纸化会议系统的数据库设计，包括表结构、关系、索引和查询优化。

## 目录

1. [数据库概述](#1-数据库概述)
2. [表结构设计](#2-表结构设计)
3. [关系模型](#3-关系模型)
4. [索引设计](#4-索引设计)
5. [数据访问模式](#5-数据访问模式)
6. [数据迁移与升级](#6-数据迁移与升级)
7. [性能优化](#7-性能优化)

## 1. 数据库概述

### 1.1 数据库选择

无纸化会议系统使用 SQLite 作为开发环境的数据库，计划在生产环境中使用 MySQL。选择这些数据库的原因如下：

- **SQLite**：轻量级、无需服务器、易于部署和测试，适合开发环境和小型应用。
- **MySQL**：高性能、可靠性好、广泛支持，适合生产环境和多用户场景。

### 1.2 ORM 框架

系统使用 SQLAlchemy 作为 ORM（对象关系映射）框架，提供以下优势：

- 抽象数据库操作，提高代码可读性和可维护性
- 支持多种数据库后端，便于从 SQLite 迁移到 MySQL
- 提供类型安全的查询构建
- 支持关系映射和延迟加载

### 1.3 数据库文件

在开发环境中，SQLite 数据库文件位于项目根目录：

```
meetings.db
```

## 2. 表结构设计

### 2.1 会议表 (meetings)

存储会议的基本信息。

| 列名    | 数据类型 | 约束           | 说明                                 |
|---------|----------|----------------|--------------------------------------|
| id      | TEXT     | PRIMARY KEY    | 会议唯一标识                         |
| title   | TEXT     | NOT NULL       | 会议标题                             |
| intro   | TEXT     |                | 会议介绍                             |
| time    | TEXT     |                | 会议时间                             |
| status  | TEXT     | NOT NULL       | 会议状态 (未开始、进行中、已结束)    |

```sql
CREATE TABLE meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    intro TEXT,
    time TEXT,
    status TEXT NOT NULL DEFAULT '未开始'
);
```

### 2.2 议程项表 (agenda_items)

存储会议的议程项信息。

| 列名             | 数据类型 | 约束                        | 说明                       |
|------------------|----------|-----------------------------|-----------------------------|
| id               | INTEGER  | PRIMARY KEY AUTOINCREMENT   | 议程项唯一标识             |
| title            | TEXT     | NOT NULL                    | 议程项标题                 |
| files            | JSON     |                             | 关联文件列表 (JSON格式)    |
| reporter         | TEXT     |                             | 报告人                     |
| duration_minutes | INTEGER  |                             | 时长 (分钟)                |
| pages            | JSON     |                             | 页码列表 (JSON格式)        |
| meeting_id       | TEXT     | NOT NULL, FOREIGN KEY       | 关联的会议ID               |

```sql
CREATE TABLE agenda_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    files JSON,
    reporter TEXT,
    duration_minutes INTEGER,
    pages JSON,
    meeting_id TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
);
```

注意：
- `files` 和 `pages` 列使用 JSON 类型存储列表数据，这在 SQLite 和 MySQL 中都受支持。
- 使用 `ON DELETE CASCADE` 确保删除会议时自动删除相关的议程项。

## 3. 关系模型

### 3.1 实体关系图 (ERD)

```
+-------------+       +----------------+
|  meetings   |       |  agenda_items  |
+-------------+       +----------------+
| id (PK)     |       | id (PK)        |
| title       |       | title          |
| intro       |       | files (JSON)   |
| time        |       | reporter       |
| status      |       | duration_mins  |
|             |       | pages (JSON)   |
|             |       | meeting_id (FK)|
+-------------+       +----------------+
      |                      |
      |                      |
      +----------------------+
           1:N 关系
```

### 3.2 关系说明

- **会议与议程项**：一对多关系 (1:N)
  - 一个会议可以有多个议程项
  - 每个议程项只属于一个会议
  - 通过 `agenda_items.meeting_id` 外键关联到 `meetings.id`

## 4. 索引设计

### 4.1 主键索引

- `meetings.id`：会议表的主键索引
- `agenda_items.id`：议程项表的主键索引

### 4.2 外键索引

- `agenda_items.meeting_id`：议程项表的外键索引，用于加速基于会议ID的查询

### 4.3 其他索引

- `meetings.title`：会议标题索引，用于加速基于标题的搜索
- `meetings.status`：会议状态索引，用于加速基于状态的筛选

```sql
CREATE INDEX idx_meetings_title ON meetings(title);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_agenda_items_meeting_id ON agenda_items(meeting_id);
```

## 5. 数据访问模式

### 5.1 常见查询模式

#### 5.1.1 获取会议列表

```python
def get_meetings(db: Session, skip: int = 0, limit: int = 100):
    """获取会议列表（不包括议程项，用于列表显示）"""
    return db.query(models.Meeting).offset(skip).limit(limit).all()
```

#### 5.1.2 获取会议详情（包括议程项）

```python
def get_meeting(db: Session, meeting_id: str):
    """获取单个会议（包括议程项）"""
    return db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
```

#### 5.1.3 创建会议

```python
def create_meeting(db: Session, meeting: schemas.MeetingCreate):
    """创建新会议"""
    # 创建会议对象
    db_meeting = models.Meeting(
        id=meeting.id,
        title=meeting.title,
        intro=meeting.intro,
        time=meeting.time,
        status=meeting.status or "未开始"
    )
    db.add(db_meeting)
    db.flush()

    # 创建关联的议程项对象
    for item_data in meeting.part:
        db_item = models.AgendaItem(
            title=item_data.title,
            files=item_data.files,
            pages=item_data.pages,
            meeting_id=db_meeting.id
        )
        db.add(db_item)

    db.commit()
    db.refresh(db_meeting)
    return db_meeting
```

#### 5.1.4 更新会议

```python
def update_meeting(db: Session, meeting_id: str, meeting_update: schemas.MeetingUpdate):
    """更新会议信息，包括其议程项（采用删除旧项，添加新项的策略）"""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        return None

    # 更新会议基本信息
    if meeting_update.title is not None:
        db_meeting.title = meeting_update.title
    if meeting_update.intro is not None:
        db_meeting.intro = meeting_update.intro
    if meeting_update.time is not None:
        db_meeting.time = meeting_update.time
    if meeting_update.status is not None:
        db_meeting.status = meeting_update.status

    # 更新议程项（如果提供了）
    if meeting_update.agenda_items is not None:
        # 获取现有议程项的ID列表
        existing_item_ids = [item.id for item in db_meeting.agenda_items]
        
        # 跟踪要保留的议程项ID
        keep_item_ids = []
        
        # 处理更新中的每个议程项
        for item_data in meeting_update.agenda_items:
            if item_data.id is not None:
                # 更新现有议程项
                db_item = db.query(models.AgendaItem).filter(
                    models.AgendaItem.id == item_data.id,
                    models.AgendaItem.meeting_id == meeting_id
                ).first()
                
                if db_item:
                    # 更新字段
                    db_item.title = item_data.title
                    db_item.files = item_data.files
                    db_item.pages = item_data.pages
                    db_item.reporter = item_data.reporter
                    db_item.duration_minutes = item_data.duration_minutes
                    
                    # 标记为保留
                    keep_item_ids.append(db_item.id)
            else:
                # 创建新议程项
                db_item = models.AgendaItem(
                    title=item_data.title,
                    files=item_data.files,
                    pages=item_data.pages,
                    reporter=item_data.reporter,
                    duration_minutes=item_data.duration_minutes,
                    meeting_id=meeting_id
                )
                db.add(db_item)
                db.flush()  # 获取新ID
                keep_item_ids.append(db_item.id)
        
        # 删除未包含在更新中的议程项
        for item_id in existing_item_ids:
            if item_id not in keep_item_ids:
                db.query(models.AgendaItem).filter(models.AgendaItem.id == item_id).delete()

    db.commit()
    db.refresh(db_meeting)
    return db_meeting
```

#### 5.1.5 删除会议

```python
def delete_meeting(db: Session, meeting_id: str):
    """删除会议及其议程项"""
    db_meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if db_meeting is None:
        return False
    
    db.delete(db_meeting)  # 级联删除议程项
    db.commit()
    return True
```

### 5.2 事务管理

系统使用 SQLAlchemy 的会话（Session）管理事务，确保数据一致性：

```python
# 在 FastAPI 路由中使用依赖注入获取数据库会话
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/meetings/", response_model=schemas.Meeting)
def create_new_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    # 使用会话进行事务操作
    return crud.create_meeting(db=db, meeting=meeting)
```

## 6. 数据迁移与升级

### 6.1 初始化数据库

系统使用以下方法初始化数据库表结构：

```python
def create_db_tables():
    # 导入 Base 并创建所有表
    from models import Base
    Base.metadata.create_all(bind=engine)
```

### 6.2 示例数据填充

系统使用 `seed_db.py` 脚本填充示例数据：

```python
# 示例会议数据
data_string = """
{"id":"651122","title": "市政协完全大会", "intro": "会议介绍", "time": "2025年3月29日 9:00", "part": [{"title": "议题一：审议资格", "file": ["关于审议资格的通知"], "page" : ["10"]}, {"title": "议题二：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题三：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题四：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}, {"title": "议题五：全体会议", "file": ["全委会文件", "选举文件"], "page" : ["1", "1"]}]}
"""

# 解析数据并插入数据库
data = json.loads(data_string)
db = SessionLocal()

# 创建会议
meeting = Meeting(
    id=data["id"],
    title=data["title"],
    intro=data["intro"],
    time=data["time"],
    status="未开始"
)
db.add(meeting)
db.flush()

# 创建议程项
for i, item in enumerate(data["part"]):
    agenda_item = AgendaItem(
        title=item["title"],
        files=[{"name": f} for f in item.get("file", [])],
        pages=item.get("page", []),
        meeting_id=meeting.id
    )
    db.add(agenda_item)

db.commit()
db.close()
```

### 6.3 数据库升级策略

对于未来的数据库结构变更，建议采用以下策略：

1. 使用 Alembic 进行数据库迁移管理
2. 为每次结构变更创建迁移脚本
3. 在部署前测试迁移脚本
4. 在部署过程中执行迁移
5. 保留回滚机制

## 7. 性能优化

### 7.1 查询优化

1. **使用适当的索引**：为常用查询条件创建索引
2. **限制结果集大小**：使用 `limit` 和 `offset` 进行分页
3. **选择性加载关联数据**：使用 `joinedload` 或 `selectinload` 减少 N+1 查询问题
4. **延迟加载**：只在需要时加载关联数据

### 7.2 连接池配置

在生产环境中，建议配置 SQLAlchemy 连接池：

```python
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=5,               # 连接池大小
    max_overflow=10,           # 最大溢出连接数
    pool_timeout=30,           # 连接超时时间（秒）
    pool_recycle=1800,         # 连接回收时间（秒）
)
```

### 7.3 JSON 字段优化

对于 `files` 和 `pages` 等 JSON 字段，建议：

1. 限制 JSON 数据的大小和复杂性
2. 考虑对频繁查询的 JSON 属性创建函数索引（MySQL 5.7+）
3. 对于大型或复杂的 JSON 数据，考虑使用专用表而不是 JSON 字段

### 7.4 监控与调优

1. 使用数据库监控工具跟踪慢查询
2. 定期分析查询计划，优化性能瓶颈
3. 考虑使用缓存减轻数据库负载
4. 对于读多写少的数据，考虑实现读写分离
