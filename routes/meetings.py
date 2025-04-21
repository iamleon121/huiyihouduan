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
from services.pdf_service import PDFService

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

@router.post("/")
async def create_new_meeting(meeting: schemas.MeetingCreate, db: Session = Depends(get_db)):
    """创建新会议及其议程项"""
    db_meeting = crud.get_meeting(db, meeting_id=meeting.id)
    if db_meeting:
        raise HTTPException(status_code=400, detail="Meeting ID already registered")

    try:
        # 使用MeetingService创建会议
        db_meeting = await MeetingService.create_meeting(db=db, meeting_data=meeting)

        # 不再更新会议变更识别码
        # 只有状态变为"进行中"时才会更新识别码

        # 手动构建响应数据
        response = {
            "id": db_meeting.id,
            "title": db_meeting.title,
            "intro": db_meeting.intro,
            "time": db_meeting.time,
            "status": db_meeting.status,
            "agenda_items": []
        }

        # 添加议程项
        if db_meeting.agenda_items:
            for item in db_meeting.agenda_items:
                agenda_item = {
                    "title": item.title,
                    "position": item.position,
                    "meeting_id": item.meeting_id,
                    "files": [],
                    "pages": item.pages,
                    "reporter": item.reporter,
                    "duration_minutes": item.duration_minutes
                }

                # 添加文件
                if item.files:
                    for file in item.files:
                        try:
                            if file is None:
                                continue

                            file_data = {
                                "id": getattr(file, 'id', None),
                                "filename": getattr(file, 'filename', None),
                                "path": getattr(file, 'path', None),
                                "size": getattr(file, 'size', None),
                                "content_type": getattr(file, 'content_type', None)
                            }
                            agenda_item["files"].append(file_data)
                        except Exception as e:
                            print(f"处理文件时出错: {str(e)}")
                            # 继续处理下一个文件

                response["agenda_items"].append(agenda_item)

        return response
    except ValueError as e:
        # 处理标题重复错误
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
def read_meetings(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取会议列表"""
    meetings = crud.get_meetings(db)

    # 手动构建响应数据
    response = []
    for meeting in meetings:
        meeting_data = {
            "id": meeting.id,
            "title": meeting.title,
            "intro": meeting.intro,
            "time": meeting.time,
            "status": meeting.status,
            "agenda_items": []
        }

        # 添加议程项
        if meeting.agenda_items:
            for item in meeting.agenda_items:
                agenda_item = {
                    "title": item.title,
                    "position": item.position,
                    "meeting_id": item.meeting_id,
                    "files": [],
                    "pages": item.pages,
                    "reporter": item.reporter,
                    "duration_minutes": item.duration_minutes
                }

                # 添加文件
                if item.files:
                    for file in item.files:
                        try:
                            if file is None:
                                continue

                            file_data = {
                                "id": getattr(file, 'id', None),
                                "filename": getattr(file, 'filename', None),
                                "path": getattr(file, 'path', None),
                                "size": getattr(file, 'size', None),
                                "content_type": getattr(file, 'content_type', None)
                            }
                            agenda_item["files"].append(file_data)
                        except Exception as e:
                            print(f"处理文件时出错: {str(e)}")
                            # 继续处理下一个文件

                meeting_data["agenda_items"].append(agenda_item)

        response.append(meeting_data)

    return response


@router.get("/{meeting_id}")
def read_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """获取单个会议详情"""
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if db_meeting is None:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # 手动构建响应数据
    response = {
        "id": db_meeting.id,
        "title": db_meeting.title,
        "intro": db_meeting.intro,  # 确保包含会议简介
        "time": db_meeting.time,
        "status": db_meeting.status,
        "agenda_items": []
    }

    # 添加议程项
    if db_meeting.agenda_items:
        for item in db_meeting.agenda_items:
            agenda_item = {
                "title": item.title,
                "position": item.position,
                "meeting_id": item.meeting_id,
                "files": [],
                "pages": item.pages,
                "reporter": item.reporter,
                "duration_minutes": item.duration_minutes
            }

            # 添加文件
            if item.files:
                # 处理文件信息，确保格式正确
                processed_files = []
                for file in item.files:
                    # 如果文件信息是字典，直接使用
                    if isinstance(file, dict):
                        processed_files.append(file)
                    # 如果文件信息是字符串，创建一个字典
                    elif isinstance(file, str):
                        processed_files.append({
                            "name": file,
                            "path": "",
                            "size": 0,
                            "url": ""
                        })
                    # 其他情况，跳过
                    else:
                        print(f"跳过无效的文件信息: {file}")

                agenda_item["files"] = processed_files
                print(f"议程项 {item.position} 的文件信息: {processed_files}")

            response["agenda_items"].append(agenda_item)

    return response


@router.get("/{meeting_id}/data")
async def get_meeting_data(meeting_id: str, db: Session = Depends(get_db)):
    """
    获取指定会议的数据和压缩包URL

    此API用于客户端获取指定会议的数据和压缩包URL。
    如果会议不存在或不是"进行中"状态，将返回404错误。

    Args:
        meeting_id: 会议ID

    返回:
        dict: 包含会议数据和压缩包URL的字典
          - id: 会议状态变更识别码
          - meeting_id: 会议ID
          - title: 会议标题
          - time: 会议时间
          - status: 会议状态
          - package_url: 会议压缩包URL（如果有）
          - agenda_items: 议程项列表，每个议程项包含标题、位置和文件列表
    """
    # 获取最新的会议变更识别码
    token = crud.get_meeting_change_status_token(db)
    print(f"[数据查询] 当前会议状态识别码: {token}")

    # 查询指定会议
    meeting = crud.get_meeting(db, meeting_id=meeting_id)

    # 如果会议不存在，返回404错误
    if not meeting:
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不存在")

    # 如果会议不是"进行中"状态，返回404错误
    if meeting.status != "进行中":
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不是进行中状态")

    # 格式化时间，将T替换为空格
    meeting_time = meeting.time
    if meeting_time and 'T' in meeting_time:
        meeting_time = meeting_time.replace('T', ' ')

    # 构建会议数据
    meeting_data = {
        "id": token,  # 使用token作为数据包的ID
        "meeting_id": meeting.id,  # 添加实际的会议ID
        "title": meeting.title,
        "intro": meeting.intro,  # 添加会议简介
        "time": meeting_time,
        "status": meeting.status,
        "agenda_items": []  # 添加议程项列表
    }

    # 添加议程项和文件信息
    if meeting.agenda_items:
        # 按position排序议程项
        sorted_agenda_items = sorted(meeting.agenda_items, key=lambda x: x.position)

        for agenda_item in sorted_agenda_items:
            item_data = {
                "position": agenda_item.position,
                "title": agenda_item.title,
                "files": []
            }

            # 添加文件信息
            if agenda_item.files:
                # 处理文件信息，确保格式正确
                processed_files = []
                for file in agenda_item.files:
                    # 如果文件信息是字典，直接使用
                    if isinstance(file, dict):
                        # 确保文件包含总页数信息
                        file_data = file.copy()  # 复制一份，避免修改原始数据

                        # 如果文件是PDF且没有总页数信息，尝试获取
                        if file_data.get('name', '').lower().endswith('.pdf') and 'total_pages' not in file_data:
                            # 如果有文件路径，尝试获取总页数
                            pdf_path = file_data.get('path')
                            if pdf_path and os.path.exists(pdf_path):
                                try:
                                    # 使用同步方式获取PDF总页数
                                    page_count = PDFService.get_pdf_page_count_sync(pdf_path)
                                    if page_count is not None:
                                        file_data['total_pages'] = page_count
                                        print(f"获取到PDF文件总页数: {page_count}")
                                    else:
                                        file_data['total_pages'] = 0
                                        print(f"无法获取PDF文件总页数: {pdf_path}")
                                except Exception as e:
                                    file_data['total_pages'] = 0
                                    print(f"获取PDF文件总页数时出错: {str(e)}")
                            else:
                                file_data['total_pages'] = 0

                        processed_files.append(file_data)
                    # 如果文件信息是字符串，创建一个字典
                    elif isinstance(file, str):
                        file_data = {
                            "name": file,
                            "path": "",
                            "size": 0,
                            "url": "",
                            "total_pages": 0  # 对于字符串类型的文件信息，默认总页数为0
                        }
                        processed_files.append(file_data)
                    # 其他情况，跳过
                    else:
                        print(f"跳过无效的文件信息: {file}")

                item_data["files"] = processed_files
                print(f"议程项 {agenda_item.position} 的文件信息: {processed_files}")

            meeting_data["agenda_items"].append(item_data)

    # 如果会议有压缩包，添加压缩包URL
    if meeting.package_path:
        # 从 package_path 中提取文件名
        package_filename = os.path.basename(meeting.package_path)
        # 构建压缩包URL
        package_url = f"/uploads/packages/{package_filename}"
        meeting_data["package_url"] = package_url
    else:
        # 如果没有压缩包，尝试生成
        try:
            success = await MeetingService.generate_meeting_package(db, meeting.id)
            if success:
                # 重新获取会议信息，因为包路径可能已更新
                db.refresh(meeting)
                if meeting.package_path:
                    # 从 package_path 中提取文件名
                    package_filename = os.path.basename(meeting.package_path)
                    # 构建压缩包URL
                    package_url = f"/uploads/packages/{package_filename}"
                    meeting_data["package_url"] = package_url
        except Exception as e:
            print(f"生成会议压缩包失败: {str(e)}")
            # 即使生成失败，也继续返回会议数据

    print(f"[数据查询] 返回会议 {meeting_id} 数据: {meeting_data}")

    return meeting_data


@router.put("/{meeting_id}")
async def update_existing_meeting(meeting_id: str, meeting: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议信息，包括其议程项（采用删除旧项，添加新项的策略）"""
    try:
        # 使用MeetingService更新会议
        db_meeting = await MeetingService.update_meeting(db=db, meeting_id=meeting_id, meeting_data=meeting)

        # 不再更新会议变更识别码
        # 只有状态变为"进行中"时才会更新识别码

        # Need to reload agenda items if the response model expects them
        db.refresh(db_meeting, attribute_names=['agenda_items'])

        # 手动构建响应数据
        response = {
            "id": db_meeting.id,
            "title": db_meeting.title,
            "intro": db_meeting.intro,
            "time": db_meeting.time,
            "status": db_meeting.status,
            "agenda_items": []
        }

        # 添加议程项
        if db_meeting.agenda_items:
            for item in db_meeting.agenda_items:
                agenda_item = {
                    "title": item.title,
                    "position": item.position,
                    "meeting_id": item.meeting_id,
                    "files": [],
                    "pages": item.pages,
                    "reporter": item.reporter,
                    "duration_minutes": item.duration_minutes
                }

                # 添加文件
                if item.files:
                    for file in item.files:
                        try:
                            if file is None:
                                continue

                            file_data = {
                                "id": getattr(file, 'id', None),
                                "filename": getattr(file, 'filename', None),
                                "path": getattr(file, 'path', None),
                                "size": getattr(file, 'size', None),
                                "content_type": getattr(file, 'content_type', None)
                            }
                            agenda_item["files"].append(file_data)
                        except Exception as e:
                            print(f"处理文件时出错: {str(e)}")
                            # 继续处理下一个文件

                response["agenda_items"].append(agenda_item)

        return response
    except ValueError as e:
        # 处理标题重复错误
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{meeting_id}", status_code=204) # Use 204 No Content for successful deletion
async def delete_existing_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """
    删除会议

    根据会议ID删除会议及其相关资源，包括数据库记录、文件系统中的文件和ZIP包。
    成功删除后返回204状态码（无内容）。

    Args:
        meeting_id (str): 要删除的会议ID
        db (Session): 数据库会话对象，通过依赖注入获取

    Returns:
        None: 成功删除返回204状态码，无内容

    Raises:
        HTTPException: 当会议不存在时，返回404错误
    """
    # 使用MeetingService删除会议，同时删除ZIP包
    await MeetingService.delete_meeting(db=db, meeting_id=meeting_id)

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


@router.put("/{meeting_id}/status")
async def update_meeting_status_endpoint(meeting_id: str, status_update: schemas.MeetingUpdate, db: Session = Depends(get_db)):
    """更新会议状态，仅当会议转变为"进行中"状态时更新会议变更识别码"""
    # 获取要更新的新状态
    new_status = status_update.status
    if new_status is None:
        raise HTTPException(status_code=400, detail="必须提供状态字段")

    # 获取当前会议状态
    current_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if current_meeting is None:
        raise HTTPException(status_code=404, detail="会议未找到")

    current_status = current_meeting.status

    # 仅更新会议状态，不处理议程项
    # 不使用 MeetingService.update_meeting 方法，因为它会处理议程项
    # 直接使用简单的状态更新方法
    db_meeting = crud.update_meeting_status(db=db, meeting_id=meeting_id, status=new_status)

    # 如果状态从其他状态变为"进行中"，先生成ZIP包，然后再更新会议状态token
    if new_status == "进行中" and current_status != "进行中":
        print(f"[状态变更] 会议 {meeting_id} 状态从 {current_status} 变为 {new_status}，先检查议程项")

        # 检查会议是否有议程项
        if not current_meeting.agenda_items or len(current_meeting.agenda_items) == 0:
            raise HTTPException(status_code=400, detail="会议没有议程项，无法开始会议")

        # 检查每个议程项是否有文件
        empty_file_items = []
        for item in current_meeting.agenda_items:
            if not item.files or len(item.files) == 0:
                empty_file_items.append(item.title or f"议程项 {item.position}")

        if empty_file_items:
            raise HTTPException(
                status_code=400,
                detail=f"以下议程项没有文件，无法开始会议: {', '.join(empty_file_items)}"
            )

        print(f"[状态变更] 会议 {meeting_id} 检查通过，开始生成ZIP包")

        # 预生成会议文件包
        success = await MeetingService.generate_meeting_package(db, meeting_id)
        if not success:
            raise HTTPException(status_code=500, detail="生成会议文件包失败，无法开始会议")

        print(f"[状态变更] 会议 {meeting_id} ZIP包生成成功，更新状态token")
        # 更新会议变更状态识别码
        crud.update_meeting_change_status_token(db)

    # 如果状态从"进行中"变为其他状态，删除ZIP包
    elif current_status == "进行中" and new_status != "进行中":
        print(f"[状态变更] 会议 {meeting_id} 状态从 {current_status} 变为 {new_status}，删除ZIP包")

        # 删除会议文件包
        await MeetingService.delete_meeting_package(db, meeting_id)

        print(f"[状态变更] 会议 {meeting_id} ZIP包删除完成")

    # 手动构建响应数据
    response = {
        "id": db_meeting.id,
        "title": db_meeting.title,
        "intro": db_meeting.intro,
        "time": db_meeting.time,
        "status": db_meeting.status,
        "agenda_items": []
    }

    # 添加议程项
    if db_meeting.agenda_items:
        for item in db_meeting.agenda_items:
            agenda_item = {
                "title": item.title,
                "position": item.position,
                "meeting_id": item.meeting_id,
                "files": [],
                "pages": item.pages,
                "reporter": item.reporter,
                "duration_minutes": item.duration_minutes
            }

            # 添加文件
            if item.files:
                for file in item.files:
                    try:
                        if file is None:
                            continue

                        file_data = {
                            "id": getattr(file, 'id', None),
                            "filename": getattr(file, 'filename', None),
                            "path": getattr(file, 'path', None),
                            "size": getattr(file, 'size', None),
                            "content_type": getattr(file, 'content_type', None)
                        }
                        agenda_item["files"].append(file_data)
                    except Exception as e:
                        print(f"处理文件时出错: {str(e)}")
                        # 继续处理下一个文件

            response["agenda_items"].append(agenda_item)

    return response


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
    position: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    """
    上传会议议程项的文件
    文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件
    自动转换：PDF文件会自动转换为JPG格式，用于无线平板显示
    """
    # 使用MeetingService上传会议文件
    result = await MeetingService.upload_meeting_files(db=db, meeting_id=meeting_id, position=position, files=files)
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

    # 准备文件名 - 使用ASCII字符确保兼容性
    # 仅使用会议ID作为文件名，避免中文字符编码问题
    zip_filename = f"meeting_{meeting_id}_jpgs.zip"

    # 准备响应
    headers = {
        'Content-Disposition': f'attachment; filename="{zip_filename}"'
    }

    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)


@router.get("/active/meetings")
def get_active_meetings(db: Session = Depends(get_db)):
    """
    获取所有进行中的会议列表

    此API用于客户端获取所有当前进行中的会议列表。
    如果没有进行中的会议，将返回空列表。

    Returns:
        list: 进行中的会议列表，每个会议包含会议ID、标题、时间和压缩包URL
    """
    # 查询所有处于"进行中"状态的会议
    in_progress_meetings = db.query(models.Meeting).filter(models.Meeting.status == "进行中").all()

    # 准备响应数据
    meetings_data = []

    for meeting in in_progress_meetings:
        # 格式化时间，将T替换为空格
        meeting_time = meeting.time
        if meeting_time and 'T' in meeting_time:
            meeting_time = meeting_time.replace('T', ' ')

        meeting_data = {
            "id": meeting.id,
            "title": meeting.title,
            "time": meeting_time,
            "status": meeting.status
        }

        # 如果会议有压缩包，添加压缩包URL
        if meeting.package_path:
            # 从 package_path 中提取文件名
            package_filename = os.path.basename(meeting.package_path)
            # 构建压缩包URL
            package_url = f"/uploads/packages/{package_filename}"
            meeting_data["package_url"] = package_url

        meetings_data.append(meeting_data)

    print(f"[活动会议查询] 当前进行中会议数量: {len(meetings_data)}")

    return meetings_data


@router.get("/active/download-package/{meeting_id}")
async def download_active_meeting_package(meeting_id: str, db: Session = Depends(get_db)):
    """
    下载指定进行中会议的压缩包

    此API用于客户端直接下载指定进行中会议的压缩包。
    如果会议不存在或不是进行中状态，将返回404错误。

    Args:
        meeting_id: 会议ID

    Returns:
        StreamingResponse: ZIP文件流响应
    """
    # 查询指定会议
    meeting = crud.get_meeting(db, meeting_id=meeting_id)

    # 如果会议不存在，返回404错误
    if not meeting:
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不存在")

    # 如果会议不是进行中状态，返回404错误
    if meeting.status != "进行中":
        raise HTTPException(status_code=404, detail=f"会议 {meeting_id} 不是进行中状态")

    # 检查会议是否有压缩包
    if not meeting.package_path:
        # 如果没有压缩包，尝试生成
        success = await MeetingService.generate_meeting_package(db, meeting_id)
        if not success:
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

        # 重新获取会议信息，因为包路径可能已更新
        db.refresh(meeting)

        # 再次检查是否有压缩包
        if not meeting.package_path:
            raise HTTPException(status_code=500, detail="生成会议压缩包失败")

    # 使用MeetingService下载会议文件包
    zip_buffer = await MeetingService.download_meeting_package(db=db, meeting_id=meeting_id)

    # 准备文件名 - 使用ASCII字符确保兼容性
    # 仅使用会议ID作为文件名，避免中文字符编码问题
    zip_filename = f"meeting_{meeting_id}_jpgs.zip"

    # 准备响应
    headers = {
        'Content-Disposition': f'attachment; filename="{zip_filename}"'
    }

    print(f"[压缩包下载] 返回进行中会议 {meeting_id} 的压缩包")

    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
