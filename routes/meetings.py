"""
会议相关路由

此模块包含所有与会议管理相关的路由，包括会议的创建、查询、更新和删除。
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, File, UploadFile, Form, Path, Body
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import io
import zipfile
import shutil
import uuid
import json
from datetime import datetime
import asyncio

# 导入数据库模型、模式和CRUD操作
import models, schemas, crud
from database import SessionLocal, get_db
from utils import format_file_size, ensure_jpg_for_pdf, ensure_jpg_in_zip, convert_pdf_to_jpg_for_pad, convert_pdf_to_jpg_for_pad_sync

# 导入服务层
from services.meeting_service import MeetingService

# 创建路由器
router = APIRouter(
    prefix="/api/v1/meetings",  # 使用不同的前缀避免与main.py中的路由冲突
    tags=["meetings"],
    responses={404: {"description": "Not found"}},
)

# 获取项目根目录
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = current_dir
UPLOAD_DIR = os.path.join(project_root, "uploads")

# --- 会议基本CRUD操作 ---

@router.post("/", response_model=schemas.Meeting)
async def create_new_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    """创建新会议及其议程项"""
    db_meeting = crud.get_meeting(db, meeting_id=meeting.id)
    if db_meeting:
        raise HTTPException(status_code=400, detail="Meeting ID already registered")

    # 使用MeetingService创建会议
    db_meeting = await MeetingService.create_meeting(db=db, meeting_data=meeting)

    # 不再更新会议变更识别码
    # 只有状态变为"进行中"时才会更新识别码

    return db_meeting


@router.get("/", response_model=List[schemas.Meeting])
def read_meetings(db: Session = Depends(get_db)):
    """
    获取会议列表

    返回系统中的所有会议列表，不再支持分页。

    Args:
        db (Session): 数据库会话对象，通过依赖注入获取

    Returns:
        List[schemas.Meeting]: 会议对象列表
    """
    # 获取所有会议，不再使用分页参数
    meetings = crud.get_meetings(db)
    # Manually set agenda_items to empty list as get_meetings doesn't load them
    # Or adjust the schema/query if needed
    for meeting in meetings:
        meeting.agenda_items = [] # Ensure the response matches the schema
    return meetings


@router.get("/{meeting_id}", response_model=schemas.Meeting)
def read_meeting_details(meeting_id: str, db: Session = Depends(get_db)):
    """
    获取单个会议的详细信息

    根据会议ID返回会议的详细信息，包括所有议程项。

    Args:
        meeting_id (str): 会议ID
        db (Session): 数据库会话对象，通过依赖注入获取

    Returns:
        schemas.Meeting: 会议详细信息对象

    Raises:
        HTTPException: 当会议不存在时，返回404错误
    """
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return db_meeting


@router.put("/{meeting_id}", response_model=schemas.Meeting)
async def update_existing_meeting(meeting_id: str, meeting: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议信息，包括其议程项（采用删除旧项，添加新项的策略）"""
    # 使用MeetingService更新会议
    db_meeting = await MeetingService.update_meeting(db=db, meeting_id=meeting_id, meeting_data=meeting)

    # 不再更新会议变更识别码
    # 只有状态变为"进行中"时才会更新识别码

    # Need to reload agenda items if the response model expects them
    db.refresh(db_meeting, attribute_names=['agenda_items'])
    return db_meeting


@router.delete("/{meeting_id}", status_code=204) # Use 204 No Content for successful deletion
def delete_existing_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """
    删除会议

    根据会议ID删除会议及其相关资源，包括数据库记录和文件系统中的文件。
    成功删除后返回204状态码（无内容）。

    Args:
        meeting_id (str): 要删除的会议ID
        db (Session): 数据库会话对象，通过依赖注入获取

    Returns:
        None: 成功删除返回204状态码，无内容

    Raises:
        HTTPException: 当会议不存在时，返回404错误
    """
    # 使用MeetingService删除会议
    MeetingService.delete_meeting(db=db, meeting_id=meeting_id)

@router.get("/status/token", response_model=schemas.MeetingChangeStatus)
def get_meeting_status_token(db: Session = Depends(get_db)):
    """
    获取会议状态变更识别码和当前进行中的会议列表

    此API用于客户端轮询检测会议状态变更。只有当会议状态变为"进行中"时，
    此识别码才会更新。客户端可通过比较前后两次请求的识别码是否相同，
    来确定是否有新会议开始进行。

    返回:
        MeetingChangeStatus: 包含id字段和meetings字段的对象
          - id: 会议状态变更识别码
          - meetings: 当前所有处于"进行中"状态的会议列表
    """
    # 获取最新的会议变更识别码
    token = crud.get_meeting_change_status_token(db)
    print(f"[识别码查询] 当前会议状态识别码: {token}")

    # 查询所有处于"进行中"状态的会议
    in_progress_meetings = db.query(models.Meeting).filter(models.Meeting.status == "进行中").all()

    # 提取会议信息
    meetings_info = []
    for meeting in in_progress_meetings:
        # 格式化时间，将T替换为空格
        meeting_time = meeting.time
        if meeting_time and 'T' in meeting_time:
            meeting_time = meeting_time.replace('T', ' ')

        meetings_info.append({
            "id": meeting.id,
            "title": meeting.title,
            "time": meeting_time
        })

    print(f"[识别码查询] 当前进行中会议数量: {len(meetings_info)}")

    # 确保数据库会话关闭，避免缓存问题
    db.close()

    return {
        "id": token,
        "meetings": meetings_info
    }


@router.put("/{meeting_id}/status", response_model=schemas.Meeting)
async def update_meeting_status_endpoint(meeting_id: str, status_update: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议状态，仅当会议转变为"进行中"状态时更新会议变更识别码"""
    # 获取要更新的新状态
    new_status = status_update.status
    if new_status is None:
        raise HTTPException(status_code=400, detail="必须提供状态字段")

    # 使用MeetingService更新会议状态
    # 在服务层中处理识别码更新逻辑
    db_meeting = await MeetingService.update_meeting(db=db, meeting_id=meeting_id, meeting_data=status_update)

    return db_meeting


@router.post("/status/token/test", response_model=dict)
def test_update_status_token(db: Session = Depends(get_db)):
    """
    测试接口：强制更新会议状态识别码并返回更新前后的值
    """
    # 获取旧识别码
    old_token = crud.get_meeting_change_status_token(db)

    # 更新识别码
    new_token = crud.update_meeting_change_status_token(db)

    return {
        "old_token": old_token,
        "new_token": new_token,
        "updated": old_token != new_token
    }

@router.post("/{meeting_id}/upload")
async def upload_meeting_files(
    meeting_id: str,
    agenda_item_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    上传会议议程项的文件
    文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件
    自动转换：PDF文件会自动转换为JPG格式，用于无线平板显示
    """
    # 使用MeetingService上传会议文件
    result = await MeetingService.upload_meeting_files(db=db, meeting_id=meeting_id, agenda_item_id=agenda_item_id, files=files)
    return result


@router.get("/{meeting_id}/jpgs", response_model=dict)
async def get_meeting_jpgs(meeting_id: str, db: Session = Depends(get_db)):
    """
    获取指定会议的所有JPG文件信息，用于平板客户端

    返回:
        dict: 包含会议所有议程项的JPG文件信息
              格式为 {"agenda_items": [{"id": 1, "files": [{"pdf_id": "xxx", "jpg_files": ["path1"]}]}]}
    """
    # 使用MeetingService获取会议JPG文件
    result = await MeetingService.get_meeting_jpgs(db=db, meeting_id=meeting_id)
    return result

@router.get("/{meeting_id}/package", response_model=dict)
async def get_meeting_package(meeting_id: str, db: Session = Depends(get_db)):
    """
    获取会议的完整信息包

    返回会议的完整信息包，用于会议开始时的数据传输。
    这个信息包仅包含会议基本信息、议程信息和JPG文件信息，不包含PDF文件信息，
    主要适用于平板客户端查看。

    这个端点会自动检查并确保所有PDF文件都有对应的JPG文件，如果没有则会自动生成。

    Args:
        meeting_id (str): 要获取信息包的会议ID
        db (Session): 数据库会话对象，通过依赖注入获取

    Returns:
        dict: 包含会议完整信息的字典，包括会议基本信息、议程项列表和JPG文件信息

    Raises:
        HTTPException: 当会议不存在或会议文件目录不存在时，返回404错误
    """
    # 使用MeetingService获取会议信息包
    result = await MeetingService.get_meeting_package(db=db, meeting_id=meeting_id)
    return result


@router.get("/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str, db: Session = Depends(get_db)):
    """
    下载会议的JPG文件包，打包为ZIP格式
    仅包含会议的JPG图片文件，不包含PDF文件
    适用于平板客户端查看

    Args:
        meeting_id: 会议ID

    Returns:
        StreamingResponse: ZIP文件流响应
    """
    # 使用MeetingService下载会议文件包
    zip_buffer = await MeetingService.download_meeting_package(db=db, meeting_id=meeting_id)

    # 获取会议信息用于文件名
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    zip_filename = f"{db_meeting.title.replace(' ', '_')}_{meeting_id}_jpgs.zip"

    # 准备响应
    headers = {
        'Content-Disposition': f'attachment; filename="{zip_filename}"'
    }

    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
