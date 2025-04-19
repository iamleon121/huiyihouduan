# 无纸化会议系统项目详情

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [项目结构](#3-项目结构)
4. [主要功能模块](#4-主要功能模块)
5. [数据模型](#5-数据模型)
6. [API接口](#6-api接口)
7. [文件管理](#7-文件管理)
8. [前端界面](#8-前端界面)
9. [部署说明](#9-部署说明)
10. [未来计划](#10-未来计划)

## 1. 项目概述

这是一个基于 FastAPI 开发的无纸化会议系统后端服务，主要功能包括：

- **会议管理**：创建、编辑、查看、删除会议，管理会议状态（未开始、进行中、已结束）
- **议程管理**：为会议添加多个议程项，包括标题、报告人、时长等信息
- **文件管理**：PDF 文件上传、查看、下载、删除，以及 PDF 转 JPG 功能
- **数据存储**：使用 SQLite 数据库（开发环境）存储会议和议程项数据

系统通过 API 与前端交互，提供完整的会议生命周期管理，从会议创建、议程设置、文件上传到会议进行和结束的全过程支持。

### 1.1 项目背景

传统会议需要大量纸质文件，不仅浪费资源，还增加了会议准备和管理的复杂性。无纸化会议系统旨在通过数字化方式管理会议全过程，提高会议效率，降低资源消耗。

### 1.2 技术栈

- **后端**：Python + FastAPI + SQLAlchemy + Pydantic
- **前端**：HTML + CSS + JavaScript (原生，未使用前端框架)
- **数据库**：SQLite (开发环境)，MySQL (生产环境)
- **文件处理**：PyMuPDF (fitz)，Pillow
- **其他**：Python 内置库 (shutil, os, uuid, tempfile)

## 2. 系统架构

### 2.1 整体架构

无纸化会议系统采用经典的三层架构：

1. **表示层**：HTML + CSS + JavaScript 构建的前端界面
2. **业务逻辑层**：FastAPI 提供的 API 接口和业务逻辑处理
3. **数据访问层**：SQLAlchemy ORM 和数据库交互

### 2.2 技术架构图

```
+------------------+     +------------------+     +------------------+
|   表示层         |     |   业务逻辑层     |     |   数据访问层     |
+------------------+     +------------------+     +------------------+
| HTML/CSS/JS      |     | FastAPI          |     | SQLAlchemy       |
| 静态文件         | --> | Pydantic         | --> | SQLite/MySQL     |
| 浏览器渲染       |     | 业务逻辑         |     | 文件系统         |
+------------------+     +------------------+     +------------------+
```

### 2.3 部署架构

**开发环境**：
- 单机部署
- SQLite 数据库
- 本地文件系统存储

**生产环境**：
- Web 服务器 + 应用服务器
- MySQL 数据库
- 本地或云存储

## 3. 项目结构

```
.
├── .git/                       # Git 版本控制目录
├── .idea/                      # PyCharm IDE 配置目录
├── .venv/                      # Python 虚拟环境目录
├── .vscode/                    # VSCode 配置目录
├── __pycache__/                # Python 编译缓存目录
├── crud.py                     # 数据库 CRUD 操作 (会议、议程项)
├── database.py                 # 数据库连接与会话设置 (SQLite, SQLAlchemy)
├── main.py                     # 主程序文件 (FastAPI 应用和路由定义)
├── meetings.db                 # SQLite 数据库文件
├── models.py                   # SQLAlchemy 数据库模型 (Meeting, AgendaItem)
├── nonuse/                     # 不再使用的旧文件
├── plan/                       # 项目计划和文档目录
│   ├── api_documentation.md              # API 接口文档
│   ├── database_design.md                # 数据库设计文档
│   ├── frontend_components.md            # 前端组件文档
│   ├── meeting_create_todo.md            # 会议创建功能待办事项
│   ├── meeting_crud_todo.md              # 会议 CRUD 功能待办事项
│   ├── meeting_development_guidelines.md # 会议系统开发指南
│   ├── project.md                        # 项目详情文档 (本文档)
│   ├── project_progress.md               # 项目进度文档
│   ├── uploads_directory_guide.md        # uploads 目录使用指南
│   └── README.md                         # 项目说明文档
├── requirements.txt            # 项目依赖
├── schemas.py                  # Pydantic 数据模型 (API 数据验证/序列化)
├── seed_db.py                  # 数据库填充脚本 (插入示例数据)
├── show_db_content.py          # 显示数据库内容的辅助脚本
├── static/                     # 静态文件目录
│   ├── converted_images/       # PDF 转换后的图片目录
│   ├── huiyi-document.html     # 文件管理页面
│   ├── huiyi-document.js       # 文件管理页面的 JavaScript
│   ├── huiyi-meeting.html      # 会议管理页面
│   ├── huiyi-meeting.js        # 会议管理页面的 JavaScript
│   ├── huiyi-system.html       # 系统管理页面
│   ├── huiyi-system.js         # 系统管理页面的 JavaScript
│   ├── huiyi.css               # 共享 CSS 样式
│   ├── huiyi.js                # 旧版 JavaScript (已归档)
│   ├── index.html              # 首页 (文件上传页面)
│   ├── index.js                # 首页的 JavaScript
│   └── pdf2jpg.html            # PDF 转 JPG 页面
├── uploads/                    # 上传文件存储目录
│   ├── temp/                   # 临时文件目录
│   └── ...                     # 按会议 ID 组织的文件目录
└── amis-huiyi.txt              # AMIS 配置文件 (参考用)
```

## 4. 主要功能模块

### 4.1 后端服务 (main.py)

- **基础框架**：基于 FastAPI 构建，提供高性能 API 服务
- **静态文件服务**：提供前端页面和静态资源访问
- **文件处理**：
  - PDF 文件上传 API 接口 (`/upload`)
  - PDF 转 JPG 功能及 API 接口 (`/convert-pdf-to-jpg`)
  - 文件验证（仅接受 PDF 格式）
  - 文件存储到 uploads 目录，按会议和议程项组织
- **会议管理**：
  - 会议 CRUD API 接口 (`/api/meetings/`)
  - 会议状态控制 API 接口 (`/api/meetings/{meeting_id}/status`)
  - 会议文件上传 API 接口 (`/api/meetings/{meeting_id}/upload`)
- **页面路由**：
  - 首页 (`/`)：文件上传页面
  - PDF 转 JPG 页面 (`/pdf2jpg`)
  - 会议系统主页 (`/huiyi`)：重定向到会议管理页面
  - 文件管理页面 (`/huiyi/documents`)

### 4.2 数据库层

#### 4.2.1 数据库模块 (database.py)
- 配置 SQLite 数据库连接 (`meetings.db`)
- 创建数据库引擎和会话 (`SessionLocal`, `engine`)
- 提供 `get_db` 依赖函数用于 FastAPI 路由
- 包含 `create_db_tables` 函数用于初始化表结构

#### 4.2.2 数据模型 (models.py)
- 定义 `Meeting` 和 `AgendaItem` 的 SQLAlchemy ORM 模型
- `Meeting` 模型：会议基本信息（ID、标题、介绍、时间、状态）
- `AgendaItem` 模型：会议议程项（标题、文件、报告人、时长、页码）
- `AgendaItem` 的 `files` 和 `pages` 字段使用 `JSON` 类型存储列表
- `User` 模型：用户信息（用户名、真实姓名、密码哈希、角色）
- `SystemSetting` 模型：系统设置（键值对形式）

#### 4.2.3 CRUD操作 (crud.py)
- 实现数据库 CRUD 操作
- 会议相关操作：创建、查询、更新、删除会议
- 议程项相关操作：作为会议的一部分进行管理
- 用户相关操作：用户创建、认证、权限检查

#### 4.2.4 数据模式 (schemas.py)
- 定义 Pydantic 数据模型
- 用于 API 请求和响应的数据验证和序列化
- 包含 `Meeting`、`MeetingCreate`、`MeetingUpdate` 等模型
- 包含 `AgendaItem`、`AgendaItemCreate`、`AgendaItemUpdate` 等模型
- 包含 `User`、`UserCreate`、`UserUpdate` 等模型

### 4.3 前端界面

#### 4.3.1 会议管理 (huiyi-meeting.html, huiyi-meeting.js)

- **会议列表**：展示所有会议，包括标题、时间、状态等信息
- **会议创建和编辑**：通过模态框实现会议信息的添加和修改
- **会议状态管理**：
  - "开始会议"按钮：将会议状态从"未开始"更改为"进行中"
  - "结束会议"按钮：将会议状态从"进行中"更改为"已结束"
  - "重新开始"按钮：将会议状态从"已结束"更改为"进行中"
- **议程项管理**：
  - 添加、编辑、删除议程项
  - 设置议程项标题、报告人、时长
  - 上传和管理议程项相关文件
  - 设置文件页码

#### 4.3.2 文件管理 (huiyi-document.html, huiyi-document.js)

文件管理页面提供以下功能：

- **文件列表与查询**：显示系统中所有文件，支持按名称筛选，实现客户端分页
- **文件操作**：提供查看、下载和删除功能
- **文件状态显示**：显示文件的状态标签（使用中、临时文件、已解绑等）
- **临时文件管理**：提供"删除可删除文件"和"强制清理临时文件"功能
- **分页导航**：支持页码导航和每页显示数量控制

> 注意：为了确保文件与会议的关联性，文件上传只能通过会议创建/编辑页面进行，
> 文件管理页面不再提供单独的上传功能。这确保了所有文件必须与会议关联。

#### 4.3.3 系统管理 (huiyi-system.html, huiyi-system.js)

- **用户管理**：管理系统用户（待实现）
- **系统设置**：配置系统参数（待实现）
- **系统日志**：查看系统操作日志（待实现）

#### 4.3.4 PDF 转换 (pdf2jpg.html)

- **PDF 上传**：上传 PDF 文件
- **转换参数设置**：
  - DPI 设置：控制输出图片质量
  - 格式选择：选择输出图片格式
  - 合并选项：是否将多页 PDF 合并为一张图片
- **转换结果**：显示转换后的图片，提供下载链接

### 4.4 文件管理模块

- **文件存储结构**：
  - `uploads/` 目录：所有上传文件的根目录
  - `uploads/{会议ID}/` 目录：按会议 ID 组织文件
  - `uploads/{会议ID}/agenda_{议程项ID}/` 目录：按议程项组织文件
  - `uploads/temp/` 目录：临时文件存储

- **文件命名规则**：
  - 文件名格式：`{UUID}_{原始文件名}.pdf`
  - 使用 UUID 前缀确保文件名唯一性

- **文件处理流程**：
  - 文件上传：首先存储在临时目录
  - 文件关联：关联到会议议程项时，移动到对应目录
  - 文件去重：检查同名文件，避免重复存储
  - 文件清理：提供未绑定文件的清理功能

## 5. 数据模型

详细的数据库设计请查看 [数据库设计文档](./database_design.md)。

### 5.1 会议模型 (Meeting)

```python
class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    intro = Column(Text, nullable=True)
    time = Column(String, nullable=True)
    status = Column(String, default="未开始")

    agenda_items = relationship("AgendaItem", back_populates="meeting")
```

### 5.2 议程项模型 (AgendaItem)

```python
class AgendaItem(Base):
    __tablename__ = "agenda_items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    files = Column(JSON, nullable=True)
    reporter = Column(String, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    pages = Column(JSON, nullable=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))

    meeting = relationship("Meeting", back_populates="agenda_items")
```

### 5.3 用户模型 (User)

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    real_name = Column(String, nullable=True)
    hashed_password = Column(String)
    role = Column(String, default="user")  # 'admin', 'user', 'guest'
    status = Column(String, default="正常")  # '正常', '禁用'
    is_active = Column(Boolean, default=True)
```

### 5.4 系统设置模型 (SystemSetting)

```python
class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)
```

## 6. API 接口

详细的API接口文档请查看 [API文档](./api_documentation.md)。

### 6.1 基础路由

- **首页 (文件上传)**
  - 路径: `/`
  - 方法: GET
  - 功能: 返回 `static/index.html`

- **PDF 转 JPG 页面**
  - 路径: `/pdf2jpg`
  - 方法: GET
  - 功能: 返回 `static/pdf2jpg.html`

- **会议系统主页**
  - 路径: `/huiyi`
  - 方法: GET
  - 功能: 重定向到会议管理页面

- **会议管理页面**
  - 路径: `/huiyi/meetings`
  - 方法: GET
  - 功能: 返回 `static/huiyi-meeting.html`

- **文件管理页面**
  - 路径: `/huiyi/documents`
  - 方法: GET
  - 功能: 返回 `static/huiyi-document.html`

- **系统管理页面**
  - 路径: `/huiyi/system`
  - 方法: GET
  - 功能: 返回 `static/huiyi-system.html`

### 6.2 会议管理 API

- **获取会议列表**
  - 路径: `/api/meetings/`
  - 方法: GET
  - 参数: `skip`, `limit`
  - 功能: 获取会议列表

- **创建会议**
  - 路径: `/api/meetings/`
  - 方法: POST
  - 功能: 创建新会议

- **获取会议详情**
  - 路径: `/api/meetings/{meeting_id}`
  - 方法: GET
  - 功能: 获取指定会议的详细信息

- **更新会议**
  - 路径: `/api/meetings/{meeting_id}`
  - 方法: PUT
  - 功能: 更新会议信息

- **删除会议**
  - 路径: `/api/meetings/{meeting_id}`
  - 方法: DELETE
  - 功能: 删除指定会议

- **更新会议状态**
  - 路径: `/api/meetings/{meeting_id}/status`
  - 方法: PUT
  - 功能: 更新会议状态 (未开始、进行中、已结束)

- **上传会议文件**
  - 路径: `/api/meetings/{meeting_id}/upload`
  - 方法: POST
  - 功能: 上传会议议程项文件

### 6.3 文件管理 API

- **上传临时文件**
  - 路径: `/api/upload-temp-files`
  - 方法: POST
  - 功能: 上传文件到临时目录

- **获取文件列表**
  - 路径: `/api/documents`
  - 方法: GET
  - 功能: 获取所有上传的文件列表

- **删除文件**
  - 路径: `/api/documents/{document_id}`
  - 方法: DELETE
  - 功能: 删除指定文件

- **清理临时文件**
  - 路径: `/api/clean-temp-files`
  - 方法: POST
  - 功能: 清理临时目录中的文件

- **强制清理临时文件**
  - 路径: `/api/force-clean-temp-files`
  - 方法: POST
  - 功能: 强制清理临时目录中的所有文件

### 6.4 PDF转换 API

- **PDF转JPG**
  - 路径: `/convert-pdf-to-jpg`
  - 方法: POST
  - 功能: 将PDF文件转换为JPG图片
  - 参数:
    - `file`: PDF文件
    - `dpi`: 分辨率
    - `format`: 输出格式
    - `merge`: 是否合并所有页面

## 7. 文件管理

### 7.1 文件存储结构

```
uploads/
├── temp/                  # 临时文件目录
│   ├── uuid_文件1.pdf
│   └── uuid_文件2.pdf
├── 会议ID1/               # 按会议ID组织的目录
│   ├── agenda_1/          # 议程项1的文件
│   │   ├── uuid_文件3.pdf
│   │   └── uuid_文件4.pdf
│   └── agenda_2/          # 议程项2的文件
│       └── uuid_文件5.pdf
└── 会议ID2/               # 另一个会议的目录
    └── ...
```

### 7.2 文件命名和管理

- **文件命名规则**：`{UUID}_{原始文件名}`
- **临时文件**：所有上传的文件首先保存在 `uploads/temp/` 目录
- **关联文件**：文件与会议议程项关联后，移动到对应的 `uploads/{会议ID}/agenda_{议程项ID}/` 目录
- **文件清理**：定期清理临时目录和孤立的会议文件夹

## 8. 前端界面

详细的前端组件文档请查看 [前端组件文档](./frontend_components.md)。

### 8.1 页面结构

所有主要页面共享相同的基本布局结构：

```html
<div class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
        <div class="sidebar-header">
            <h2>阜新市政协</h2>
        </div>
        <nav class="sidebar-nav">
            <ul>
                <li><a href="huiyi-meeting.html"><span>会议管理</span></a></li>
                <li><a href="huiyi-document.html"><span>文件管理</span></a></li>
                <li><a href="huiyi-system.html"><span>系统管理</span></a></li>
            </ul>
        </nav>
    </aside>

    <!-- 主内容区域包装器 -->
    <div class="main-content-wrapper">
        <!-- 顶部栏 -->
        <header class="top-header">
            <div class="header-title">无纸化会议系统</div>
            <div class="user-info">
                管理员
            </div>
        </header>

        <!-- 主内容区域 -->
        <main class="content-area">
            <!-- 页面特定内容 -->
        </main>
    </div>
</div>
```

### 8.2 共享组件

- 模态框
- 表格
- 分页控件
- 按钮样式

### 8.3 页面详情

- **会议管理页面**：会议列表、创建、编辑、详情查看功能
- **文件管理页面**：文件列表、查看、下载、删除功能
- **系统管理页面**：用户管理和系统设置功能 (待实现)
- **PDF转JPG页面**：PDF上传和转换功能

## 9. 部署说明

### 9.1 环境需求

- Python 3.8+
- 操作系统: Windows, Linux 或 macOS
- 依赖项: 见 requirements.txt

### 9.2 安装步骤

1. 克隆代码仓库
2. 创建虚拟环境 `python -m venv .venv`
3. 激活虚拟环境 
   - Windows: `.venv\Scripts\activate`
   - Linux/macOS: `source .venv/bin/activate`
4. 安装依赖 `pip install -r requirements.txt`
5. 初始化数据库 `python seed_db.py`
6. 启动应用 `uvicorn main:app --reload`

### 9.3 生产环境部署

- 使用 Nginx 作为前端代理
- 使用 Supervisor 或 systemd 管理进程
- 使用 MySQL 作为数据库
- 配置 HTTPS

## 10. 未来计划

### 10.1 短期计划

- 完成用户认证和权限管理系统
- 完善系统管理模块功能
- 改进移动端响应式设计
- 优化大文件处理性能

### 10.2 中期计划

- 实现会议议程时间管理功能
- 添加参会人员管理功能
- 提供会议签到功能
- 引入会议通知系统

### 10.3 长期计划

- 开发移动端应用
- 实现会议实时协作功能
- 添加多语言支持
- 提供更丰富的数据分析和报表功能
