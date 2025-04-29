"""
维护相关路由

此模块包含所有与系统维护相关的路由，包括临时文件清理、系统设置等。
"""

import os
import shutil
import uuid
import asyncio
from datetime import datetime
import time
import traceback

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

# 导入数据库模型、模式和CRUD操作
import models, schemas, crud
from database import SessionLocal, get_db

# 创建路由器
router = APIRouter(
    prefix="/api/v1/maintenance",  # 使用不同的前缀避免与main.py中的路由冲突
    tags=["maintenance"],
    responses={404: {"description": "Not found"}},
)

# 获取项目根目录
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = current_dir
UPLOAD_DIR = os.path.join(project_root, "uploads")

# 导入文件服务
from services.file_service import FileService

# 注意：清理临时文件相关函数已移动到services/file_service.py

# --- 维护相关路由 ---

@router.get("/temp-files-count")
def get_temp_files_count():
    """获取临时文件目录中的文件数量"""
    try:
        # 获取temp目录路径
        temp_dir = os.path.join(UPLOAD_DIR, "temp")
        file_count = 0

        if os.path.exists(temp_dir) and os.path.isdir(temp_dir):
            # 只统计PDF文件
            file_count = len([f for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f)) and f.lower().endswith('.pdf')])

        return {
            "count": file_count,
            "status": "success",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        print(f"获取临时文件数量时出错: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"获取临时文件数量失败: {str(e)}",
                "status": "error",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        )

@router.post("/cleanup-temp")
async def trigger_temp_cleanup(background_tasks: BackgroundTasks):
    """手动触发临时文件清理"""
    print(f"[{datetime.now()}] 收到清理临时文件请求")
    try:
        # 确保BackgroundTasks对象是有效的
        if not isinstance(background_tasks, BackgroundTasks):
            print(f"[{datetime.now()}] 错误：background_tasks不是有效对象")
            return JSONResponse(
                status_code=500,
                content={
                    "message": "内部服务器错误: BackgroundTasks 对象无效",
                    "status": "error",
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            )

        # 获取临时文件目录中文件的总数量
        temp_dir = os.path.join(UPLOAD_DIR, "temp")
        file_count = 0
        if os.path.exists(temp_dir) and os.path.isdir(temp_dir):
            file_count = len([f for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f)) and f.lower().endswith('.pdf')])

        # 创建一个可在后台运行的函数版本
        def run_cleanup():
            print(f"[{datetime.now()}] 后台任务开始执行临时文件清理")
            # 使用AsyncUtils来运行异步函数
            try:
                from services.async_utils import AsyncUtils
                AsyncUtils.run_sync(FileService.cleanup_temp_files)
                print(f"[{datetime.now()}] 后台清理任务完成")
            except Exception as e:
                print(f"[{datetime.now()}] 后台清理任务出错: {str(e)}")
                import traceback
                print(traceback.format_exc())

        # 添加到后台任务
        background_tasks.add_task(run_cleanup)

        print(f"[{datetime.now()}] 清理任务已添加到后台任务队列")
        return {
            "message": f"临时文件清理任务已启动，将在后台执行。当前临时文件夹中有 {file_count} 个PDF文件。",
            "status": "success",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "current_file_count": file_count
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[{datetime.now()}] 启动清理任务失败: {error_details}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"启动清理任务失败: {str(e)}",
                "status": "error",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        )

@router.post("/force-cleanup-temp")
async def force_cleanup_temp_files(background_tasks: BackgroundTasks):
    """
    强制清理所有未绑定的临时文件

    与定时清理不同，该端点会立即清理所有未绑定到会议的临时文件，不考虑文件的创建时间。
    这个功能主要用于手动清理系统中的临时文件，释放存储空间。
    """
    print(f"[{datetime.now()}] 收到强制清理临时文件请求")
    try:
        # 获取temp目录路径
        temp_dir = os.path.join(UPLOAD_DIR, "temp")
        if not os.path.exists(temp_dir):
            print(f"[{datetime.now()}] 临时文件目录不存在，创建目录")
            os.makedirs(temp_dir, exist_ok=True)
            return {
                "message": "临时文件目录不存在，已创建目录",
                "status": "success",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "deleted_count": 0,
                "total_count": 0
            }

        if not os.path.isdir(temp_dir):
            print(f"[{datetime.now()}] 临时文件路径存在但不是目录，跳过清理")
            return {
                "message": "临时文件路径存在但不是目录，跳过清理",
                "status": "error",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

        # 创建一个可在后台运行的函数版本
        def run_force_cleanup():
            print(f"[{datetime.now()}] 后台任务开始执行强制清理临时文件")
            try:
                # 获取所有会议ID
                from database import SessionLocal
                db = SessionLocal()
                meetings = db.query(models.Meeting).all()
                meeting_ids = [meeting.id for meeting in meetings]
                db.close()

                print(f"[{datetime.now()}] 当前会议ID列表: {meeting_ids}")

                # 检查文件是否与任何会议关联
                def is_file_bound_to_meeting(file_path):
                    """检查文件是否绑定到已知会议"""
                    # 标准化路径
                    norm_path = os.path.normpath(file_path).replace("\\", "/")

                    # 对于uploads目录下的文件，检查它们是否在会议子目录中
                    for meeting_id in meeting_ids:
                        meeting_path_marker = f"uploads/{meeting_id}/"
                        if meeting_path_marker in norm_path:
                            return True
                    return False

                # 统计变量
                deleted_count = 0
                preserved_count = 0

                # 列出temp目录中的所有文件
                temp_files = os.listdir(temp_dir)
                total_count = len([f for f in temp_files if os.path.isfile(os.path.join(temp_dir, f)) and f.lower().endswith('.pdf')])
                print(f"[{datetime.now()}] 临时目录中共有 {total_count} 个PDF文件")

                # 遍历temp目录中的所有文件
                for filename in temp_files:
                    file_path = os.path.join(temp_dir, filename)

                    # 只处理文件，跳过目录
                    if not os.path.isfile(file_path):
                        print(f"[{datetime.now()}] 跳过目录: {filename}")
                        continue

                    # 只处理PDF文件
                    if not filename.lower().endswith(".pdf"):
                        print(f"[{datetime.now()}] 跳过非PDF文件: {filename}")
                        continue

                    try:
                        # 检查文件是否绑定到会议
                        is_bound = is_file_bound_to_meeting(file_path)

                        # 如果文件未绑定，直接删除（不考虑创建时间）
                        if not is_bound:
                            print(f"[{datetime.now()}] 删除未绑定的临时文件: {filename}")
                            os.remove(file_path)
                            deleted_count += 1
                        else:
                            preserved_count += 1
                            print(f"[{datetime.now()}] 保留已绑定的临时文件: {filename}")
                    except Exception as e:
                        preserved_count += 1
                        print(f"[{datetime.now()}] 处理文件 {filename} 时出错，将保留该文件: {str(e)}")

                # 计算清理后的文件数量
                remaining_count = total_count - deleted_count

                print(f"[{datetime.now()}] 强制清理临时文件完成: 总共 {total_count} 个文件，删除 {deleted_count} 个，保留 {preserved_count} 个")

            except Exception as e:
                print(f"[{datetime.now()}] 强制清理临时文件时出错: {str(e)}")
                import traceback
                print(traceback.format_exc())

        # 添加到后台任务
        background_tasks.add_task(run_force_cleanup)

        # 获取临时文件目录中文件的总数量
        file_count = 0
        if os.path.exists(temp_dir) and os.path.isdir(temp_dir):
            file_count = len([f for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f)) and f.lower().endswith('.pdf')])

        # 返回结果
        return {
            "message": f"强制清理任务已启动，将在后台执行。当前临时文件夹中有 {file_count} 个PDF文件。",
            "status": "success",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "current_file_count": file_count
        }

    except Exception as e:
        print(f"[{datetime.now()}] 启动强制清理任务失败: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            "message": f"启动强制清理任务失败: {str(e)}",
            "status": "error",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

@router.get("/settings/{key}")
def get_system_setting(key: str, db: Session = Depends(get_db)):
    """
    获取系统设置项

    Args:
        key: 设置项的键

    Returns:
        dict: 包含键和值的字典
    """
    # 对于PDF分辨率设置，设置默认值为1920
    default_value = None
    if key == "default_pdf_jpg_width":
        default_value = "1920"

    value = crud.get_system_setting(db, key, default_value)
    return {"key": key, "value": value}

@router.put("/settings/{key}")
def update_system_setting(key: str, data: dict, db: Session = Depends(get_db)):
    """
    更新系统设置项

    Args:
        key: 设置项的键
        data: 包含value字段的请求体

    Returns:
        dict: 包含更新后的键和值的字典
    """
    # 从请求体中获取value
    value = data.get("value")
    if value is None:
        raise HTTPException(status_code=400, detail="请求体中必须包含'value'字段")

    # 验证PDF分辨率设置的值
    if key == "default_pdf_jpg_width":
        valid_widths = ["960", "1440", "1920"]
        if value not in valid_widths:
            raise HTTPException(status_code=400, detail=f"无效的分辨率值，必须是以下之一: {', '.join(valid_widths)}")

    updated_value = crud.update_system_setting(db, key, value)
    return {"key": key, "value": updated_value}

@router.post("/cleanup-empty-folders")
def cleanup_empty_folders(db: Session = Depends(get_db)):
    """
    清理uploads目录中的孤立文件夹

    扫描uploads目录，删除那些不再关联到数据库中任何会议的文件夹。
    这个功能用于清理系统中的孤立文件夹，释放存储空间。

    孤立文件夹通常是由于会议被删除但文件夹未被正确清理而产生的。
    """
    try:
        # 获取数据库中所有会议ID
        all_meetings = db.query(models.Meeting).all()
        valid_meeting_ids = {meeting.id for meeting in all_meetings}
        print(f"当前有效会议ID列表: {valid_meeting_ids}")

        # 遍历uploads目录，删除不存在于数据库中的会议文件夹
        removed_folders = []
        skipped_folders = []

        for folder_name in os.listdir(UPLOAD_DIR):
            folder_path = os.path.join(UPLOAD_DIR, folder_name)

            # 跳过temp目录和非目录项
            if folder_name == "temp" or not os.path.isdir(folder_path):
                continue

            # 检查目录名是否是UUID格式（会议ID）
            try:
                # 尝试将目录名解析为UUID，如果成功则说明可能是会议目录
                folder_uuid = uuid.UUID(folder_name)

                # 检查该会议ID是否存在于数据库中
                if folder_name not in valid_meeting_ids:
                    # 会议ID不在数据库中，删除该文件夹
                    shutil.rmtree(folder_path)
                    removed_folders.append(folder_name)
                    print(f"已删除孤立会议文件夹: {folder_name}")
                else:
                    skipped_folders.append(folder_name)
            except ValueError:
                # 不是UUID格式，跳过
                skipped_folders.append(folder_name)

        return {
            "message": f"清理完成，共删除 {len(removed_folders)} 个孤立文件夹，保留 {len(skipped_folders)} 个文件夹",
            "removed_folders": removed_folders,
            "status": "success"
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"清理孤立文件夹时出错: {error_details}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"清理孤立文件夹失败: {str(e)}",
                "error_details": error_details,
                "status": "error"
            }
        )
