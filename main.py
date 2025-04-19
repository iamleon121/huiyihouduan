from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import sys
import asyncio
from datetime import datetime

# 导入数据库相关模块
import models, crud
from database import SessionLocal, engine

# 导入文件服务
from services.file_service import FileService

# 定义应用生命周期管理器
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    应用生命周期管理器

    在FastAPI应用启动时创建两个后台任务，并在应用关闭时清理资源。
    1. FileService.background_cleanup_task: 定期清理临时文件
    2. FileService.background_cleanup_meetings_task: 定期清理孤立的会议文件夹

    同时初始化会议变更状态识别码，确保系统正常运行。
    """
    # 启动时执行的代码
    print(f"[{datetime.now()}] 临时文件自动清理服务已启动")

    # 创建任务并保存引用，以便在应用关闭时取消
    cleanup_task = asyncio.create_task(FileService.background_cleanup_task())
    meetings_cleanup_task = asyncio.create_task(FileService.background_cleanup_meetings_task())

    # 初始化会议变更状态识别码
    with SessionLocal() as db:
        crud.get_meeting_change_status_token(db)  # 确保存在初始识别码

    # 将控制权返回给应用
    yield

    # 应用关闭时执行的代码
    print(f"[{datetime.now()}] 应用正在关闭，正在清理资源...")

    # 取消后台任务
    cleanup_task.cancel()
    meetings_cleanup_task.cancel()

    # 等待任务取消完成
    try:
        await asyncio.gather(cleanup_task, meetings_cleanup_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass

    print(f"[{datetime.now()}] 应用已安全关闭")

# 导入路由模块
from routes.meetings import router as meetings_router
from routes.documents import router as documents_router
from routes.users import router as users_router
from routes.maintenance import router as maintenance_router
from routes.pdf_conversion import router as pdf_conversion_router

# 获取项目根目录
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = current_dir
sys.path.append(project_root)

# 创建FastAPI应用
app = FastAPI(lifespan=lifespan)

# 添加静态文件支持
app.mount("/static", StaticFiles(directory=os.path.join(project_root, "static")), name="static")

# 注册路由器
app.include_router(meetings_router)
app.include_router(documents_router)
app.include_router(users_router)
app.include_router(maintenance_router)
app.include_router(pdf_conversion_router)

# 确保文件上传目录存在
UPLOAD_DIR = os.path.join(project_root, "uploads")
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
    # 创建临时文件目录
    os.makedirs(os.path.join(UPLOAD_DIR, "temp"), exist_ok=True)

# 创建数据库表（如果不存在）
models.Base.metadata.create_all(bind=engine)

# 初始化系统用户
from seed_users import seed_users
seed_users()

# 获取数据库会话的依赖函数
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 挂载上传目录以提供文件访问
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 页面路由
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    提供系统首页

    返回static/index.html文件的内容作为HTML响应。
    如果文件不存在，则返回404错误。
    """
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: index.html not found</h1>", status_code=404)

@app.get("/pdf2jpg", response_class=HTMLResponse)
async def pdf_to_jpg_page(request: Request):
    """提供PDF转JPG的页面"""
    try:
        with open("static/pdf2jpg.html", "r", encoding="utf-8") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content, status_code=200)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Error: pdf2jpg.html not found</h1>", status_code=404)

@app.get("/huiyi", response_class=HTMLResponse)
async def serve_huiyi_page(request: Request):
    """提供会议系统主页面 - 重定向到新的会议管理页面"""
    # 重定向到新的会议管理页面
    return HTMLResponse(
        content='<html><head><meta http-equiv="refresh" content="0;URL=\'static/huiyi-meeting.html\'"></head></html>',
        status_code=200
    )

# 注意：所有API路由已移动到routes目录下的相应模块中
# - 会议相关路由：routes/meetings.py
# - 文档相关路由：routes/documents.py
# - 用户相关路由：routes/users.py
# - 维护相关路由：routes/maintenance.py
# - PDF转换相关路由：routes/pdf_conversion.py

# 注意：所有服务函数已移动到services目录下的相应模块中
# - 文件服务：services/file_service.py
# - 会议服务：services/meeting_service.py

# 注意：工具函数已移动到utils.py中
