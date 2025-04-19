"""
文件服务模块，包含文件处理相关的业务逻辑代码
"""
import os
import shutil
import time
import uuid
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session
from datetime import datetime

import models
import crud
from database import SessionLocal
from utils import format_file_size

# 获取项目根目录
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

# 上传目录
UPLOAD_DIR = os.path.join(project_root, "uploads")

class FileService:
    """文件服务类，处理文件相关的业务逻辑"""

    @staticmethod
    def get_documents(db: Session):
        """获取所有文档列表"""
        # 这里将来会实现获取文档列表的业务逻辑
        pass

    @staticmethod
    def delete_document(db: Session, document_id: str):
        """删除单个文件"""
        # 这里将来会实现删除文件的业务逻辑
        pass

    @staticmethod
    def delete_all_deletable_documents(db: Session):
        """删除所有可删除的文件"""
        # 这里将来会实现删除所有可删除文件的业务逻辑
        pass

    @staticmethod
    def process_temp_files_in_meeting(meeting_data: Dict[str, Any]):
        """处理会议中的临时文件"""
        # 这里将来会实现处理会议中临时文件的业务逻辑
        pass

    @staticmethod
    def process_temp_files_in_meeting_update(meeting_data: Dict[str, Any]):
        """处理会议更新中的临时文件"""
        # 这里将来会实现处理会议更新中临时文件的业务逻辑
        pass

    @staticmethod
    async def cleanup_temp_files():
        """
        清理uploads/temp目录中超过24小时的临时文件

        Returns:
            Dict: 包含清理结果的字典
        """
        try:
            print(f"[{datetime.now()}] 开始自动清理临时文件...")

            # 获取temp目录路径
            temp_dir = os.path.join(UPLOAD_DIR, "temp")
            if not os.path.exists(temp_dir):
                print(f"[{datetime.now()}] 临时文件目录不存在，创建目录")
                os.makedirs(temp_dir, exist_ok=True)
                return {
                    "deleted_count": 0,
                    "preserved_count": 0,
                    "total_count": 0,
                    "message": "临时文件目录不存在，已创建目录"
                }

            if not os.path.isdir(temp_dir):
                print(f"[{datetime.now()}] 临时文件路径存在但不是目录，跳过清理")
                return {
                    "deleted_count": 0,
                    "preserved_count": 0,
                    "total_count": 0,
                    "message": "临时文件路径存在但不是目录，跳过清理"
                }

            print(f"[{datetime.now()}] 临时文件目录: {temp_dir}")

            # 获取所有会议ID
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
            expired_count = 0

            # 获取当前时间
            current_time = time.time()
            one_day_in_seconds = 24 * 60 * 60

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
                    # 获取文件创建时间
                    file_creation_time = os.path.getctime(file_path)
                    file_age_in_seconds = current_time - file_creation_time
                    file_age_hours = file_age_in_seconds / 3600

                    # 检查文件是否绑定到会议
                    is_bound = is_file_bound_to_meeting(file_path)

                    # 如果文件超过24小时且未被绑定，则删除
                    if file_age_in_seconds > one_day_in_seconds:
                        expired_count += 1
                        if not is_bound:
                            print(f"[{datetime.now()}] 删除过期临时文件: {filename} (年龄: {file_age_hours:.1f}小时)")
                            os.remove(file_path)
                            deleted_count += 1
                        else:
                            preserved_count += 1
                            print(f"[{datetime.now()}] 保留已绑定的过期临时文件: {filename} (年龄: {file_age_hours:.1f}小时)")
                    else:
                        preserved_count += 1
                        print(f"[{datetime.now()}] 保留新上传的临时文件: {filename} (年龄: {file_age_hours:.1f}小时)")
                except Exception as e:
                    preserved_count += 1
                    print(f"[{datetime.now()}] 处理文件 {filename} 时出错，将保留该文件: {str(e)}")

            # 计算清理后的文件数量
            remaining_count = total_count - deleted_count

            print(f"[{datetime.now()}] 临时文件清理完成: 总共 {total_count} 个文件，删除 {deleted_count} 个，保留 {preserved_count} 个，过期文件 {expired_count} 个")

            # 返回详细结果
            return {
                "deleted_count": deleted_count,
                "preserved_count": preserved_count,
                "total_count": total_count,
                "expired_count": expired_count,
                "remaining_count": remaining_count,
                "message": f"临时文件清理完成：总共扫描 {total_count} 个文件，删除 {deleted_count} 个，保留 {preserved_count} 个。"
            }

        except Exception as e:
            print(f"[{datetime.now()}] 清理临时文件时出错: {str(e)}")
            import traceback
            print(traceback.format_exc())
            return {
                "deleted_count": 0,
                "preserved_count": 0,
                "total_count": 0,
                "error": str(e),
                "message": f"清理临时文件时出错: {str(e)}"
            }

    @staticmethod
    async def background_cleanup_task():
        """
        后台清理任务，定时清理临时文件
        """
        cleanup_interval_hours = 24.0  # 清理间隔时间（小时）
        while True:
            try:
                await FileService.cleanup_temp_files()
                print(f"[{datetime.now()}] 下次临时文件清理将在 {cleanup_interval_hours} 小时后执行")
                # 等待指定时间后再次执行清理
                await asyncio.sleep(cleanup_interval_hours * 3600)
            except Exception as e:
                print(f"[{datetime.now()}] 临时文件清理任务出错: {str(e)}")
                # 发生错误后等待10分钟再次尝试
                await asyncio.sleep(600)

    @staticmethod
    async def background_cleanup_meetings_task():
        """
        后台清理任务，定时清理无效的会议文件夹
        """
        cleanup_interval_hours = 24.0  # 清理间隔时间（小时）
        while True:
            try:
                print(f"[{datetime.now()}] 开始自动清理无效会议文件夹...")

                # 获取数据库连接
                db = SessionLocal()

                # 获取数据库中所有会议ID
                all_meetings = db.query(models.Meeting).all()
                valid_meeting_ids = {meeting.id for meeting in all_meetings}
                print(f"[{datetime.now()}] 当前有效会议ID列表数量: {len(valid_meeting_ids)}")

                # 遍历uploads目录
                removed_folders = []
                skipped_folders = []

                for item in os.listdir(UPLOAD_DIR):
                    item_path = os.path.join(UPLOAD_DIR, item)

                    # 跳过temp目录和非目录项
                    if item == "temp" or not os.path.isdir(item_path):
                        continue

                    # 检查目录名是否是UUID格式（会议ID）
                    try:
                        # 尝试将目录名解析为UUID，如果成功则说明可能是会议目录
                        uuid_obj = uuid.UUID(item)

                        # 检查该会议ID是否存在于数据库中
                        if item not in valid_meeting_ids:
                            # 会议ID不在数据库中，删除该文件夹
                            shutil.rmtree(item_path)
                            removed_folders.append(item)
                            print(f"[{datetime.now()}] 自动清理：已删除孤立会议文件夹: {item}")
                        else:
                            skipped_folders.append(item)
                    except ValueError:
                        # 不是UUID格式，跳过
                        skipped_folders.append(item)

                db.close()

                print(f"[{datetime.now()}] 无效会议文件夹清理完成: 总共删除 {len(removed_folders)} 个目录，保留 {len(skipped_folders)} 个目录")
                print(f"[{datetime.now()}] 下次无效会议文件夹清理将在 {cleanup_interval_hours} 小时后执行")

                # 等待指定时间后再次执行清理
                await asyncio.sleep(cleanup_interval_hours * 3600)
            except Exception as e:
                print(f"[{datetime.now()}] 无效会议文件夹清理任务出错: {str(e)}")
                import traceback
                print(traceback.format_exc())
                # 发生错误后等待10分钟再次尝试
                await asyncio.sleep(600)
