from fastapi import FastAPI, UploadFile, File, Request, Form, Depends, HTTPException, BackgroundTasks, Path, Body, status
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates # Although not strictly needed for just serving index.html, it's common for more complex frontends
import shutil
import os
import uuid
import fitz  # PyMuPDF
import tempfile
from typing import List, Optional
import time
from sqlalchemy.orm import Session
import asyncio
from datetime import datetime, timedelta
import json
from PIL import Image, ImageFile
import io
import logging
import re
import sys
import math
import zipfile

# 导入工具函数
from utils import format_file_size, ensure_jpg_for_pdf, ensure_jpg_in_zip, convert_pdf_to_jpg_for_pad, convert_pdf_to_jpg_for_pad_sync

# Import database, models, schemas, crud
import models, schemas, crud
from database import SessionLocal, engine, create_db_tables

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
app = FastAPI()

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

# 注意：static/converted_images目录已移除，因为它对会议管理模块没有用处

# Create database tables on startup (already done by calling create_db_tables directly)
# models.Base.metadata.create_all(bind=engine) # Alternative way

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Optional: Add startup event (alternative way to create tables)
# @app.on_event("startup")
# async def startup_event():
#     create_db_tables()


# Mount the uploads directory to serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Optional: Setup Jinja2 templates if you plan more complex HTML rendering later
# templates = Jinja2Templates(directory="static")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    """
    提供系统首页

    返回static/index.html文件的内容作为HTML响应。
    如果文件不存在，则返回404错误。

    Args:
        request (Request): FastAPI请求对象

    Returns:
        HTMLResponse: 包含index.html内容的HTML响应
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

# --- PDF Conversion API Endpoints ---
# 注意：PDF转换相关路由已移动到routes/pdf_conversion.py


# --- Meeting API Endpoints ---
# 注意：会议相关路由已移动到routes/meetings.py













# 会议文件上传API
# 注意：会议文件上传相关路由已移动到routes/meetings.py

# 临时文件上传API
# 注意：临时文件上传相关路由已移动到routes/pdf_conversion.py

# --- Document Management API Endpoints ---

# --- Maintenance API Endpoints ---
# 注意：维护相关路由已移动到routes/maintenance.py

# --- Documents API Endpoints ---
# 注意：文档相关路由已移动到routes/documents.py

# --- End API Endpoints ---

# 注意：清理临时文件相关函数已移动到services/file_service.py

# 导入文件服务
from services.file_service import FileService

# 启动后台任务
@app.on_event("startup")
async def startup_event():
    """
    应用启动时执行的事件处理器

    在FastAPI应用启动时自动执行，创建两个后台任务：
    1. FileService.background_cleanup_task: 定期清理临时文件
    2. FileService.background_cleanup_meetings_task: 定期清理孤立的会议文件夹

    同时初始化会议变更状态识别码，确保系统正常运行。

    注意：这个方法使用的是已弃用的on_event机制，应考虑在未来重构中替换为lifespan上下文管理器。
    """
    print(f"[{datetime.now()}] 临时文件自动清理服务已启动")
    # 在后台启动临时文件清理任务
    asyncio.create_task(FileService.background_cleanup_task())
    # 在后台启动无效会议文件夹清理任务
    asyncio.create_task(FileService.background_cleanup_meetings_task())

    # 初始化会议变更状态识别码
    with SessionLocal() as db:
        crud.get_meeting_change_status_token(db)  # 确保存在初始识别码

# --- Maintenance API Endpoints ---
# 注意：维护相关路由已移动到routes/maintenance.py
# 以下代码将在测试通过后删除



# --- User API Endpoints ---
# 注意：用户相关路由已移动到routes/users.py

# 注意：会议状态测试相关路由已移动到routes/meetings.py

# 注意：convert_pdf_to_jpg_for_pad 和 convert_pdf_to_jpg_for_pad_sync 函数已移动到 utils.py

# 注意：会议 JPG 相关路由已移动到routes/meetings.py



# 注意：会议包相关路由已移动到routes/meetings.py

# 注意：会议下载包相关路由已移动到routes/meetings.py

# 注意：format_file_size、ensure_jpg_for_pdf 和 ensure_jpg_in_zip 函数已移动到 utils.py
