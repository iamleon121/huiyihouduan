"""
会议服务模块，包含会议相关的业务逻辑处理代码
"""
import os
import json
import uuid
import shutil
import zipfile
import io
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

import crud
import models
from utils import format_file_size
from services.pdf_service import PDFService

# 获取项目根目录
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

# 上传目录
UPLOAD_DIR = os.path.join(project_root, "uploads")

class MeetingService:
    """会议服务类，处理会议相关的业务逻辑"""

    @staticmethod
    def get_meetings(db: Session):
        """获取所有会议列表"""
        return crud.get_meetings(db)

    @staticmethod
    def get_meeting(db: Session, meeting_id: str):
        """获取单个会议详情"""
        meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")
        return meeting

    @staticmethod
    async def create_meeting(db: Session, meeting_data: Dict[str, Any]):
        """创建新会议"""
        try:
            # 处理临时文件
            await MeetingService.process_temp_files_in_meeting(meeting_data)

            # 创建会议
            db_meeting = crud.create_meeting(db=db, meeting=meeting_data)
            return db_meeting
        except ValueError as e:
            # 处理标题重复错误
            raise ValueError(f"创建会议失败: {str(e)}")

    @staticmethod
    async def update_meeting(db: Session, meeting_id: str, meeting_data: Dict[str, Any]):
        """更新会议信息，包括处理新上传的文件"""
        print(f"\n\n开始更新会议 {meeting_id}")

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 获取当前会议的议程项列表（更新前）
        current_agenda_items = db.query(models.AgendaItem).filter(
            models.AgendaItem.meeting_id == meeting_id
        ).all()
        print(f"当前会议有 {len(current_agenda_items)} 个议程项")

        # 获取当前议程项的标题和位置
        current_titles = {item.title: item.position for item in current_agenda_items}
        print(f"当前议程项: {current_titles}")

        # 获取更新后的议程项标题
        new_titles = []
        if hasattr(meeting_data, 'part') and meeting_data.part:
            for item in meeting_data.part:
                if hasattr(item, 'title') and item.title:
                    new_titles.append(item.title)
        print(f"更新后会议将有 {len(new_titles)} 个议程项")

        # 找出被移除的议程项
        # 比较当前标题和新标题，找出被移除的议程项
        removed_titles = set(current_titles.keys()) - set(new_titles)
        print(f"被移除的议程项标题: {removed_titles}")

        # 在这里不删除议程项文件夹，而是在process_temp_files_in_meeting_update中处理
        # 这样可以确保在处理完所有文件后才删除不需要的文件夹
        for title in removed_titles:
            position = current_titles[title]
            print(f"记录被移除的议程项: 位置={position}, 标题={title}")
            # 不在这里删除文件夹
            # await MeetingService.delete_agenda_item_folder(meeting_id, position)

        # 处理临时文件
        if hasattr(meeting_data, 'part') and meeting_data.part:
            print(f"处理会议编辑中的临时文件，共 {len(meeting_data.part)} 个议程项")
            await MeetingService.process_temp_files_in_meeting_update(meeting_id, meeting_data)
        else:
            print("没有议程项需要处理")

        # 更新会议
        print(f"更新会议数据库记录")
        try:
            db_meeting = crud.update_meeting(db=db, meeting_id=meeting_id, meeting_update=meeting_data)
            if db_meeting is None:
                raise HTTPException(status_code=404, detail="会议更新失败")

            print(f"会议 {meeting_id} 更新成功")
            return db_meeting
        except ValueError as e:
            # 处理标题重复错误
            raise ValueError(f"更新会议失败: {str(e)}")

    @staticmethod
    def update_meeting_status(db: Session, meeting_id: str, status: str):
        """更新会议状态（开始或结束会议）"""
        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 检查状态是否有效
        if status not in ["active", "ended"]:
            raise HTTPException(status_code=400, detail="无效的会议状态")

        # 更新会议状态
        db_meeting.status = status
        db.commit()
        db.refresh(db_meeting)

        # 获取会议状态变更令牌
        status_token = crud.get_meeting_change_status_token(db)

        return {
            "id": meeting_id,
            "status": status,
            "token": status_token.token
        }

    @staticmethod
    async def delete_meeting(db: Session, meeting_id: str):
        """删除会议，同时删除相关的ZIP包和文件系统中的会议文件夹"""
        print(f"\n开始删除会议 {meeting_id} 及其相关资源")

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            print(f"错误: 会议 {meeting_id} 未找到")
            raise HTTPException(status_code=404, detail="会议未找到")

        # 1. 先删除ZIP包
        await MeetingService.delete_meeting_package(db, meeting_id)

        # 2. 删除文件系统中的会议文件夹
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
        if os.path.exists(meeting_dir) and os.path.isdir(meeting_dir):
            try:
                print(f"删除会议文件夹: {meeting_dir}")
                shutil.rmtree(meeting_dir)
                print(f"成功删除会议文件夹: {meeting_dir}")
            except Exception as e:
                print(f"删除会议文件夹失败: {str(e)}")
                # 即使删除文件夹失败，也继续删除数据库记录
        else:
            print(f"会议文件夹不存在: {meeting_dir}")

        # 3. 最后删除数据库中的会议记录
        success = crud.delete_meeting(db=db, meeting_id=meeting_id)
        if not success:
            print(f"删除数据库中的会议记录失败")
            raise HTTPException(status_code=500, detail="删除数据库中的会议记录失败")

        print(f"会议 {meeting_id} 及其相关资源删除成功")
        return True

    @staticmethod
    async def upload_meeting_files(db: Session, meeting_id: str, position: int, files: List[Any]):
        """上传会议文件"""
        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 检查议程项是否存在
        db_agenda_item = db.query(models.AgendaItem).filter(
            models.AgendaItem.position == position,
            models.AgendaItem.meeting_id == meeting_id
        ).first()

        if db_agenda_item is None:
            raise HTTPException(status_code=404, detail="议程项未找到")

        # 创建会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        # 创建议程项目录
        agenda_dir = os.path.join(meeting_dir, f"agenda_{position}")
        os.makedirs(agenda_dir, exist_ok=True)

        # 创廾JPG文件存储目录
        jpg_dir = os.path.join(agenda_dir, "jpgs")
        os.makedirs(jpg_dir, exist_ok=True)

        # 处理上传的文件
        uploaded_files = []
        for file in files:
            # 检查文件类型
            if not file.filename.lower().endswith(".pdf"):
                return JSONResponse(
                    status_code=400,
                    content={"错误": f"不支持的文件类型: {file.filename}，仅支持PDF文件"}
                )

            # 生成唯一文件名
            unique_id = str(uuid.uuid4())
            filename = f"{unique_id}_{file.filename}"
            file_path = os.path.join(agenda_dir, filename)

            # 保存文件
            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content={"错误": f"保存文件时出错: {str(e)}"}
                )
            finally:
                await file.close()

            # 为PDF文件创廾JPG文件
            jpg_subdir = os.path.join(jpg_dir, unique_id)
            os.makedirs(jpg_subdir, exist_ok=True)

            # 检查是否已经有JPG文件
            jpg_exists = False
            if os.path.exists(jpg_subdir):
                for jpg_file in os.listdir(jpg_subdir):
                    if jpg_file.lower().endswith(".jpg"):
                        jpg_exists = True
                        print(f"JPG文件已存在，跳过转JPG: {jpg_subdir}/{jpg_file}")
                        break

            # 只有当JPG文件不存在时才进行转换
            if not jpg_exists:
                print(f"开始转换PDF到JPG: {file_path} -> {jpg_subdir}")
                # 使用异步方式调用PDF转JPG功能
                await PDFService.convert_pdf_to_jpg_for_pad(file_path, jpg_subdir)
                print(f"PDF转JPG完成: {file_path}")

            # 添加文件信息
            file_info = {
                "name": file.filename,
                "path": file_path,
                "size": os.path.getsize(file_path),
                "url": f"/uploads/{meeting_id}/agenda_{position}/{filename}",
                "display_name": file.filename,
                "meeting_id": meeting_id,
                "agenda_folder": f"agenda_{position}"
            }
            uploaded_files.append(file_info)

        # 更新议程项的文件列表
        current_files = db_agenda_item.files or []
        if isinstance(current_files, list):
            current_files.extend(uploaded_files)
        else:
            current_files = uploaded_files

        # 更新数据库
        db_agenda_item.files = current_files
        db.commit()
        db.refresh(db_agenda_item)

        return {"success": True, "files": uploaded_files}

    @staticmethod
    async def get_meeting_jpgs(db: Session, meeting_id: str):
        """获取会议的JPG文件信息
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 获取会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)

        # 使用线程池检查目录是否存在
        dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(meeting_dir))
        if not dir_exists:
            raise HTTPException(status_code=404, detail="会议文件目录不存在")

        # 准备返回结果
        result = {"agenda_items": []}

        # 遍历会议的所有议程项
        for agenda_item in db_meeting.agenda_items:
            position = agenda_item.position
            agenda_dir = os.path.join(meeting_dir, f"agenda_{position}")
            jpg_dir = os.path.join(agenda_dir, "jpgs")

            # 使用线程池检查议程项目录是否存在
            agenda_dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(agenda_dir))
            if not agenda_dir_exists:
                continue

            # 使用线程池检查JPG目录是否存在
            jpg_dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(jpg_dir))
            if not jpg_dir_exists:
                continue

            # 收集议程项的JPG文件信息
            agenda_files = []

            # 使用线程池获取JPG目录中的所有子目录
            async def get_pdf_dirs():
                def _get_pdf_dirs():
                    return [d for d in os.listdir(jpg_dir) if os.path.isdir(os.path.join(jpg_dir, d))]
                return await AsyncUtils.run_in_threadpool(_get_pdf_dirs)

            pdf_dirs = await get_pdf_dirs()

            # 遍历所有PDF对应的目录
            for pdf_id in pdf_dirs:
                pdf_jpg_dir = os.path.join(jpg_dir, pdf_id)

                # 使用线程池查找对应的PDF文件
                async def find_pdf_file():
                    def _find_pdf_file():
                        for file in os.listdir(agenda_dir):
                            if file.startswith(f"{pdf_id}_") and file.lower().endswith(".pdf"):
                                return file
                        return None
                    return await AsyncUtils.run_in_threadpool(_find_pdf_file)

                pdf_file = await find_pdf_file()

                if not pdf_file:
                    continue

                # 使用线程池获取所有JPG文件
                async def get_jpg_files():
                    def _get_jpg_files():
                        jpg_paths = []
                        for jpg_file in os.listdir(pdf_jpg_dir):
                            if jpg_file.lower().endswith(".jpg"):
                                jpg_path = f"/uploads/{meeting_id}/agenda_{position}/jpgs/{pdf_id}/{jpg_file}"
                                jpg_paths.append(jpg_path)
                        return jpg_paths
                    return await AsyncUtils.run_in_threadpool(_get_jpg_files)

                jpg_files = await get_jpg_files()

                # 如果有JPG文件，添加到结果中
                if jpg_files:
                    agenda_files.append({
                        "pdf_id": pdf_id,
                        "pdf_file": f"/uploads/{meeting_id}/agenda_{position}/{pdf_file}",
                        "jpg_files": jpg_files
                    })

            # 添加议程项信息
            if agenda_files:
                agenda_info = {
                    "position": position,
                    "title": agenda_item.title,
                    "files": agenda_files
                }
                result["agenda_items"].append(agenda_info)

        # 添加会议基本信息
        result["id"] = meeting_id
        result["title"] = db_meeting.title
        result["status"] = db_meeting.status
        result["time"] = db_meeting.time.replace("T", " ") if db_meeting.time and "T" in db_meeting.time else db_meeting.time

        return result

    @staticmethod
    async def get_meeting_package(db: Session, meeting_id: str):
        """获取会议的完整信息包，包括会议基本信息、议程项和文件信息
        使用异步IO和线程池处理文件操作，避免阻塞事件循环。
        """
        # 导入异步工具
        from services.async_utils import AsyncUtils

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 准备返回结果
        result = {
            "id": meeting_id,
            "title": db_meeting.title,
            "time": db_meeting.time,
            "status": db_meeting.status,
            "agenda_items": []
        }

        # 获取会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)

        # 遍历会议的所有议程项
        for agenda_item in db_meeting.agenda_items:
            position = agenda_item.position
            agenda_dir = os.path.join(meeting_dir, f"agenda_{position}")

            # 准备议程项信息
            agenda_info = {
                "position": position,
                "title": agenda_item.title,
                "reporter": agenda_item.reporter,
                "duration_minutes": agenda_item.duration_minutes,
                "files": []
            }

            # 使用线程池检查议程项目录是否存在
            agenda_dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(agenda_dir))
            if agenda_dir_exists:
                # 使用线程池获取目录中的所有PDF文件
                async def get_pdf_files():
                    def _get_pdf_files():
                        return [f for f in os.listdir(agenda_dir) if f.lower().endswith(".pdf")]
                    return await AsyncUtils.run_in_threadpool(_get_pdf_files)

                pdf_files = await get_pdf_files()

                # 并行处理所有PDF文件
                async def process_pdf_file(file):
                    file_path = os.path.join(agenda_dir, file)

                    # 使用线程池获取文件大小
                    file_size = await AsyncUtils.run_in_threadpool(lambda: os.path.getsize(file_path))

                    # 从UUID_filename.pdf格式中提取原始文件名
                    original_name = "_".join(file.split("_")[1:]) if "_" in file else file

                    # 创建文件信息字典
                    return {
                        "name": original_name,
                        "path": file_path,
                        "size": file_size,
                        "formatted_size": format_file_size(file_size),
                        "url": f"/uploads/{meeting_id}/agenda_{position}/{file}",
                        "type": "pdf"
                    }

                # 并行处理所有PDF文件，但限制并发数量为4
                tasks = [process_pdf_file(file) for file in pdf_files]
                file_results = await AsyncUtils.gather_with_concurrency(4, *tasks)

                # 添加文件信息到议程项
                agenda_info["files"] = file_results

            # 添加议程项信息到结果中
            result["agenda_items"].append(agenda_info)

        return result

    @staticmethod
    async def download_meeting_package(db: Session, meeting_id: str):
        """下载会议的JPG文件包，返回预生成的ZIP文件
        如果文件不存在，尝试重新生成
        """
        print(f"\n开始下载会议 {meeting_id} 的JPG文件包")

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            print(f"错误: 会议 {meeting_id} 未找到")
            raise HTTPException(status_code=404, detail="会议未找到")

        # 检查是否有预生成的包
        if hasattr(db_meeting, 'package_path') and db_meeting.package_path and os.path.exists(db_meeting.package_path):
            print(f"使用预生成的包: {db_meeting.package_path}")
            # 返回文件内容
            with open(db_meeting.package_path, 'rb') as f:
                content = f.read()
                # 创建内存中的文件对象
                file_obj = io.BytesIO(content)
                return file_obj
        else:
            print(f"预生成的包不存在，尝试重新生成")
            # 尝试重新生成包
            success = await MeetingService.generate_meeting_package(db, meeting_id)
            if success:
                # 重新获取会议信息，因为包路径可能已更新
                db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
                if hasattr(db_meeting, 'package_path') and db_meeting.package_path and os.path.exists(db_meeting.package_path):
                    print(f"使用新生成的包: {db_meeting.package_path}")
                    # 返回文件内容
                    with open(db_meeting.package_path, 'rb') as f:
                        content = f.read()
                        # 创建内存中的文件对象
                        file_obj = io.BytesIO(content)
                        return file_obj

            # 如果仍然失败，返回错误
            print(f"无法生成会议包")
            error_buffer = io.BytesIO()
            with zipfile.ZipFile(error_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                error_content = f"无法生成会议 '{db_meeting.title}' (ID: {meeting_id}) 的JPG文件包。"
                zip_file.writestr("ERROR.txt", error_content)
            error_buffer.seek(0)
            return error_buffer

    @staticmethod
    async def process_temp_files_in_meeting(meeting_data):
        """处理会议中的临时文件，将它们从临时目录移动到正式目录
        文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件
        自动转换：PDF文件会自动转换为JPG格式，用于无线平板显示
        """
        try:
            print(f"\n\n开始处理新会议 {meeting_data.id} 的临时文件")

            # 创建会议目录
            meeting_dir = os.path.join(UPLOAD_DIR, meeting_data.id)
            os.makedirs(meeting_dir, exist_ok=True)
            print(f"创建会议目录: {meeting_dir}")

            # 处理议程项中的临时文件
            if not meeting_data.part:
                print("没有议程项需要处理")
                return

            for agenda_index, agenda_item in enumerate(meeting_data.part):
                print(f"\n处理议程项 {agenda_index+1}")

                if not agenda_item.files:
                    print("该议程项没有文件")
                    continue

                print(f"议程项文件数量: {len(agenda_item.files)}")
                print(f"文件类型: {type(agenda_item.files)}")

                # 安全地过滤出临时文件信息
                temp_files = []
                existing_files = {}

                # 先收集非临时文件，这些文件将被保留
                non_temp_files = []

                for f in agenda_item.files:
                    try:
                        if isinstance(f, dict) and 'temp_id' in f:
                            temp_files.append(f)
                        else:
                            # 保留非临时文件
                            non_temp_files.append(f)
                    except Exception as e:
                        print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

                if not temp_files:
                    print("没有临时文件需要处理")
                    continue

                print(f"找到 {len(temp_files)} 个临时文件")
                print(f"保留 {len(non_temp_files)} 个非临时文件")

                # 创建议程项目录
                # 使用位置作为文件夹名称
                position = agenda_index + 1
                agenda_folder_name = f"agenda_{position}"
                agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
                os.makedirs(agenda_dir, exist_ok=True)
                print(f"创建议程项目录: {agenda_dir}")

                # 创廾JPG文件存储目录
                jpg_dir = os.path.join(agenda_dir, "jpgs")
                os.makedirs(jpg_dir, exist_ok=True)

                # 不再检查目录中已有的文件，允许相同文件再次上传

                # 处理每个临时文件
                processed_files = []
                for file_info in temp_files:
                    try:
                        print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                        # 获取文件名（不再检查文件是否已存在）
                        file_name = file_info.get('name')

                        # 获取临时文件路径
                        temp_path = file_info.get('path')
                        if not temp_path:
                            print("文件路径为空")
                            continue

                        print(f"临时文件路径: {temp_path}")

                        if not os.path.exists(temp_path):
                            print(f"文件不存在: {temp_path}")
                            continue

                        # 生成新的文件名和路径
                        filename = os.path.basename(temp_path)
                        new_path = os.path.join(agenda_dir, filename)
                        print(f"新文件路径: {new_path}")

                        # 检查源文件和目标文件是否相同，避免SameFileError
                        is_same_file = os.path.normpath(temp_path) == os.path.normpath(new_path)
                        if is_same_file:
                            print(f"源文件和目标文件相同，跳过复制: {temp_path}")
                        else:
                            # 复制文件而不是移动，以避免权限问题
                            shutil.copy2(temp_path, new_path)
                            print("文件复制成功")

                            # 只有当源文件和目标文件不同时，才尝试删除原文件
                            try:
                                os.remove(temp_path)
                                print("原文件删除成功")
                            except Exception as e:
                                print(f"删除原文件失败: {e}")

                        # 更新文件信息
                        file_info['path'] = new_path
                        file_info['url'] = f"/uploads/{meeting_data.id}/{agenda_folder_name}/{filename}"
                        # 添加显示名称和关联信息
                        file_info['display_name'] = file_name  # 使用原始文件名作为显示名称
                        file_info['meeting_id'] = meeting_data.id  # 添加会议ID关联
                        file_info['agenda_folder'] = agenda_folder_name  # 添加议程文件夹关联
                        processed_files.append(file_info)
                        existing_files[file_name] = file_info
                        print("文件信息更新成功")

                        # 为新处理的PDF文件创廾JPG文件并获取总页数
                        if file_name.lower().endswith(".pdf"):
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_filename = os.path.basename(new_path)
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)
                            os.makedirs(jpg_subdir, exist_ok=True)

                            # 先检查PDF文件是否存在
                            if os.path.exists(new_path):
                                # 获取PDF文件的总页数
                                page_count = await PDFService.get_pdf_page_count(new_path)
                                if page_count is not None:
                                    print(f"PDF文件总页数: {page_count}")
                                    # 将总页数添加到文件信息中
                                    file_info['total_pages'] = page_count
                                else:
                                    print(f"无法获取PDF文件总页数: {new_path}")
                                    file_info['total_pages'] = 0

                                # 检查是否已经有JPG文件
                                jpg_exists = False
                                if os.path.exists(jpg_subdir):
                                    # 检查目录中是否有JPG文件
                                    for file in os.listdir(jpg_subdir):
                                        if file.lower().endswith(".jpg"):
                                            jpg_exists = True
                                            print(f"JPG文件已存在，跳过转JPG: {jpg_subdir}/{file}")
                                            break

                                # 只有当JPG文件不存在时才进行转换
                                if not jpg_exists:
                                    print(f"开始转换PDF到JPG: {new_path} -> {jpg_subdir}")
                                    # 使用异步方式调用PDF转JPG功能
                                    await PDFService.convert_pdf_to_jpg_for_pad(new_path, jpg_subdir)
                                    print(f"PDF转JPG完成: {new_path}")
                            else:
                                print(f"PDF文件不存在，跳过转JPG: {new_path}")
                                file_info['total_pages'] = 0

                    except Exception as e:
                        print(f"处理临时文件时出错: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # 更新议程项的文件列表 - 合并非临时文件和处理后的临时文件
                agenda_item.files = non_temp_files + processed_files
                print(f"议程项文件列表更新成功，共 {len(agenda_item.files)} 个文件")

        except Exception as e:
            print(f"\n\n处理临时文件时发生全局错误: {e}")
            import traceback
            traceback.print_exc()
            # 不抛出异常，允许程序继续执行
            # 即使文件处理失败，也应该允许会议信息保存

    @staticmethod
    async def delete_agenda_item_folder(meeting_id: str, agenda_item_id: int):
        """删除议程项对应的文件夹及其中的所有文件
        在编辑会议时，如果议程项被移除，调用此方法删除对应的文件夹

        Args:
            meeting_id: 会议ID
            agenda_item_id: 议程项位置
        """
        # 获取数据库会话
        from database import get_db
        db = next(get_db())
        try:
            # 导入异步工具
            from services.async_utils import AsyncUtils

            # 构建议程项文件夹路径
            # 获取议程项的位置
            agenda_item = db.query(models.AgendaItem).filter(
                models.AgendaItem.meeting_id == meeting_id,
                models.AgendaItem.position == agenda_item_id
            ).first()

            if agenda_item:
                agenda_dir = os.path.join(UPLOAD_DIR, meeting_id, f"agenda_{agenda_item.position}")
            else:
                # 如果找不到议程项，尝试直接使用ID
                agenda_dir = os.path.join(UPLOAD_DIR, meeting_id, f"agenda_{agenda_item_id}")

            # 检查文件夹是否存在
            dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(agenda_dir))
            if not dir_exists:
                print(f"议程项 {agenda_item_id} 的文件夹不存在: {agenda_dir}")
                return

            # 删除文件夹及其内容
            print(f"删除议程项 {agenda_item_id} 的文件夹: {agenda_dir}")
            await AsyncUtils.run_in_threadpool(lambda: shutil.rmtree(agenda_dir, ignore_errors=True))
            print(f"成功删除议程项 {agenda_item_id} 的文件夹")

        except Exception as e:
            print(f"删除议程项 {agenda_item_id} 的文件夹时出错: {str(e)}")
            import traceback
            traceback.print_exc()

    @staticmethod
    async def delete_meeting_package(db: Session, meeting_id: str) -> bool:
        """删除会议的ZIP文件包
        在会议停止或删除时调用此方法

        Args:
            db: 数据库会话
            meeting_id: 会议ID

        Returns:
            bool: 删除成功返回true，失败返回false
        """
        print(f"\n开始删除会议 {meeting_id} 的ZIP文件包")

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            print(f"错误: 会议 {meeting_id} 未找到")
            return False

        # 检查是否有包路径
        if not hasattr(db_meeting, 'package_path') or not db_meeting.package_path:
            print(f"会议 {meeting_id} 没有包路径记录")
            return True  # 没有包路径也算成功

        # 检查文件是否存在
        package_path = db_meeting.package_path
        if not os.path.exists(package_path):
            print(f"包文件不存在: {package_path}")
            # 清除包路径记录
            db_meeting.package_path = None
            db.commit()
            return True

        try:
            # 删除文件
            os.remove(package_path)
            print(f"成功删除包文件: {package_path}")

            # 清除包路径记录
            db_meeting.package_path = None
            db.commit()

            return True
        except Exception as e:
            print(f"删除包文件失败: {str(e)}")
            return False

    @staticmethod
    async def generate_meeting_package(db: Session, meeting_id: str) -> bool:
        """为会议预生成PDF文件包，将所有PDF文件打包成ZIP文件并保存到磁盘
        在会议开始时调用此方法，生成完成后才将会议状态更新为“进行中”

        Args:
            db: 数据库会话
            meeting_id: 会议ID

        Returns:
            bool: 生成成功返回true，失败返回false
        """
        print(f"\n开始为会议 {meeting_id} 预生成PDF文件包")

        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            print(f"错误: 会议 {meeting_id} 未找到")
            return False

        # 获取会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
        print(f"会议目录: {meeting_dir}")

        # 检查目录是否存在
        if not os.path.exists(meeting_dir):
            print(f"错误: 会议目录 {meeting_dir} 不存在")
            return False

        # 创建会议包目录，如果不存在
        packages_dir = os.path.join(UPLOAD_DIR, "packages")
        if not os.path.exists(packages_dir):
            os.makedirs(packages_dir)

        # 生成ZIP文件路径 - 使用pdfs而不是jpgs
        zip_filename = f"{db_meeting.title.replace(' ', '_')}_{meeting_id}_pdfs.zip"
        zip_path = os.path.join(packages_dir, zip_filename)
        print(f"ZIP文件路径: {zip_path}")

        file_count = 0  # 用于跟踪添加到ZIP的文件数量

        try:
            # 导入异步工具
            from services.async_utils import AsyncUtils

            # 收集所有PDF文件
            pdf_files = []
            for root, dirs, files in os.walk(meeting_dir):
                for file in files:
                    if file.lower().endswith(".pdf"):
                        pdf_files.append(os.path.join(root, file))

            print(f"找到 {len(pdf_files)} 个PDF文件")

            # 如果没有PDF文件，创建一个包含说明文件的ZIP
            if not pdf_files:
                print("没有找到PDF文件，添加说明文件到空ZIP包")
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                    info_content = f"会议 '{db_meeting.title}' (ID: {meeting_id}) 没有可用的PDF文件。\n请确保会议中包含PDF文件。"
                    zip_file.writestr("README.txt", info_content)
            else:
                # 有PDF文件，创建包含这些文件的ZIP
                with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                    # 添加README.txt说明文件
                    readme_content = f"会议: {db_meeting.title} (ID: {meeting_id})\n"
                    readme_content += f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                    readme_content += f"包含PDF文件数量: {len(pdf_files)}\n\n"
                    readme_content += "文件列表:\n"

                    # 添加文件列表到README
                    for pdf_path in pdf_files:
                        rel_path = os.path.relpath(pdf_path, meeting_dir)
                        readme_content += f"- {rel_path}\n"

                    zip_file.writestr("README.txt", readme_content)
                    file_count += 1

                    # 添加所有PDF文件
                    for pdf_path in pdf_files:
                        try:
                            # 获取文件名和UUID
                            pdf_filename = os.path.basename(pdf_path)
                            # 从文件名中提取UUID部分（通常是文件名的第一部分，以下划线分隔）
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else pdf_filename

                            # 确保文件名有.pdf扩展名
                            if not pdf_uuid.lower().endswith(".pdf"):
                                pdf_uuid = f"{pdf_uuid}.pdf"

                            # 获取文件所在的目录相对路径
                            rel_dir = os.path.dirname(os.path.relpath(pdf_path, meeting_dir))

                            # 创建新的相对路径，使用UUID作为文件名
                            new_rel_path = os.path.join(rel_dir, pdf_uuid)

                            # 添加文件到ZIP
                            print(f"添加文件到ZIP: {pdf_path} -> {new_rel_path} (仅使用UUID)")
                            zip_file.write(pdf_path, new_rel_path)
                            file_count += 1
                            print(f"成功添加文件到ZIP: {pdf_path}")
                        except Exception as e:
                            print(f"添加文件到ZIP失败: {pdf_path}, 错误: {str(e)}")

            # 检查ZIP文件大小
            zip_size = os.path.getsize(zip_path)
            print(f"生成的ZIP文件大小: {zip_size} 字节, 包含 {file_count} 个文件")

            # 更新会议元数据，记录ZIP包路径
            db_meeting.package_path = zip_path
            db.commit()

            return True

        except Exception as e:
            print(f"创建ZIP文件时发生错误: {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    async def process_temp_files_in_meeting_update(meeting_id, meeting_data):
        """处理会议更新中的临时文件
        文件去重：检查文件名是否已存在，如果存在则复用已有文件而不是创建新文件
        自动转换：PDF文件会自动转换为JPG格式，用于无线平板显示
        """
        try:
            print(f"\n\n开始处理会议 {meeting_id} 的临时文件")

            # 创建会议目录
            meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
            os.makedirs(meeting_dir, exist_ok=True)
            print(f"创建会议目录: {meeting_dir}")

            # 记录当前使用的议程项文件夹
            current_agenda_folders = set()

            # 处理议程项中的临时文件
            if not meeting_data.part:
                print("没有议程项需要处理")
                return

            for agenda_index, agenda_item in enumerate(meeting_data.part):
                print(f"\n处理议程项 {agenda_index+1}")

                # 初始化文件处理变量

                # 如果议程项没有文件，继续下一个
                if not agenda_item.files:
                    print("该议程项没有文件")
                    continue

                # 安全地过滤出临时文件信息和非临时文件
                temp_files = []
                non_temp_files = []
                existing_files = {}

                for f in agenda_item.files:
                    try:
                        if isinstance(f, dict) and 'temp_id' in f:
                            temp_files.append(f)
                        else:
                            non_temp_files.append(f)
                    except Exception as e:
                        print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

                print(f"找到 {len(temp_files)} 个临时文件")
                print(f"保留 {len(non_temp_files)} 个非临时文件")

                # 如果没有临时文件，直接使用非临时文件
                if not temp_files:
                    agenda_item.files = non_temp_files
                    continue

                # 创建议程项目录
                # 使用位置作为文件夹名称
                position = agenda_index + 1
                agenda_folder_name = f"agenda_{position}"
                agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
                os.makedirs(agenda_dir, exist_ok=True)
                print(f"创建议程项目录: {agenda_dir}")

                # 将当前使用的文件夹添加到集合中
                current_agenda_folders.add(agenda_folder_name)

                # 创廾JPG文件存储目录
                jpg_dir = os.path.join(agenda_dir, "jpgs")
                os.makedirs(jpg_dir, exist_ok=True)

                # 不再检查目录中已有的文件，允许相同文件再次上传

                # 处理每个临时文件
                processed_files = []
                for file_info in temp_files:
                    try:
                        print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                        # 获取文件名（不再检查文件是否已存在）
                        file_name = file_info.get('name')

                        # 获取临时文件路径
                        temp_path = file_info.get('path')
                        if not temp_path:
                            print("文件路径为空")
                            # 不中断处理，将文件信息添加到processed_files
                            # 这样即使文件不存在，也能保留文件信息
                            file_info['path'] = ''
                            file_info['url'] = f"/uploads/{meeting_id}/{agenda_folder_name}/{file_info.get('name', 'unknown')}"
                            file_info['display_name'] = file_info.get('name', 'unknown')
                            file_info['meeting_id'] = meeting_id
                            file_info['agenda_folder'] = agenda_folder_name
                            processed_files.append(file_info)
                            existing_files[file_info.get('name', 'unknown')] = file_info
                            print("文件信息已保留，尽管路径为空")
                            continue

                        print(f"临时文件路径: {temp_path}")

                        if not os.path.exists(temp_path):
                            print(f"文件不存在: {temp_path}")
                            # 不中断处理，将文件信息添加到processed_files
                            # 这样即使文件不存在，也能保留文件信息
                            file_info['path'] = ''
                            file_info['url'] = f"/uploads/{meeting_id}/{agenda_folder_name}/{file_info.get('name', 'unknown')}"
                            file_info['display_name'] = file_info.get('name', 'unknown')
                            file_info['meeting_id'] = meeting_id
                            file_info['agenda_folder'] = agenda_folder_name
                            processed_files.append(file_info)
                            existing_files[file_info.get('name', 'unknown')] = file_info
                            print("文件信息已保留，尽管文件不存在")
                            continue

                        # 生成新的文件名和路径
                        filename = os.path.basename(temp_path)
                        new_path = os.path.join(agenda_dir, filename)
                        print(f"新文件路径: {new_path}")

                        # 检查源文件和目标文件是否相同，避免SameFileError
                        is_same_file = os.path.normpath(temp_path) == os.path.normpath(new_path)
                        if is_same_file:
                            print(f"源文件和目标文件相同，跳过复制: {temp_path}")
                        else:
                            # 复制文件而不是移动，以避免权限问题
                            shutil.copy2(temp_path, new_path)
                            print("文件复制成功")

                            # 只有当源文件和目标文件不同时，才尝试删除原文件
                            try:
                                os.remove(temp_path)
                                print("原文件删除成功")
                            except Exception as e:
                                print(f"删除原文件失败: {e}")

                        # 更新文件信息
                        file_info['path'] = new_path
                        file_info['url'] = f"/uploads/{meeting_id}/{agenda_folder_name}/{filename}"
                        # 添加显示名称和关联信息
                        file_info['display_name'] = file_name  # 使用原始文件名作为显示名称
                        file_info['meeting_id'] = meeting_id  # 添加会议ID关联
                        file_info['agenda_folder'] = agenda_folder_name  # 添加议程文件夹关联
                        processed_files.append(file_info)
                        existing_files[file_name] = file_info
                        print("文件信息更新成功")

                        # 为新处理的PDF文件创廾JPG文件并获取总页数
                        if file_name.lower().endswith(".pdf"):
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_filename = os.path.basename(new_path)
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)
                            os.makedirs(jpg_subdir, exist_ok=True)

                            # 先检查PDF文件是否存在
                            if os.path.exists(new_path):
                                # 获取PDF文件的总页数
                                page_count = await PDFService.get_pdf_page_count(new_path)
                                if page_count is not None:
                                    print(f"PDF文件总页数: {page_count}")
                                    # 将总页数添加到文件信息中
                                    file_info['total_pages'] = page_count
                                else:
                                    print(f"无法获取PDF文件总页数: {new_path}")
                                    file_info['total_pages'] = 0

                                # 检查是否已经有JPG文件
                                jpg_exists = False
                                if os.path.exists(jpg_subdir):
                                    # 检查目录中是否有JPG文件
                                    for file in os.listdir(jpg_subdir):
                                        if file.lower().endswith(".jpg"):
                                            jpg_exists = True
                                            print(f"JPG文件已存在，跳过转JPG: {jpg_subdir}/{file}")
                                            break

                                # 只有当JPG文件不存在时才进行转换
                                if not jpg_exists:
                                    print(f"开始转换PDF到JPG: {new_path} -> {jpg_subdir}")
                                    # 使用异步方式调用PDF转JPG功能
                                    await PDFService.convert_pdf_to_jpg_for_pad(new_path, jpg_subdir)
                                    print(f"PDF转JPG完成: {new_path}")
                            else:
                                print(f"PDF文件不存在，跳过转JPG: {new_path}")
                                file_info['total_pages'] = 0

                    except Exception as e:
                        print(f"处理临时文件时出错: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # 更新议程项的文件列表 - 合并非临时文件和处理后的临时文件
                agenda_item.files = non_temp_files + processed_files

                # 检查并删除原来的文件夹（如果与当前文件夹不同）
                # 收集所有需要检查的原始文件夹
                old_folders = set()
                for file_item in temp_files:
                    if 'agenda_folder' in file_item and file_item['agenda_folder'] != agenda_folder_name:
                        old_folders.add(file_item['agenda_folder'])

                # 检查并删除空文件夹
                for folder_name in old_folders:
                    old_folder = os.path.join(meeting_dir, folder_name)
                    if os.path.exists(old_folder) and os.path.isdir(old_folder):
                        # 检查文件夹是否为空
                        if not os.listdir(old_folder):
                            try:
                                shutil.rmtree(old_folder)
                                print(f"删除空文件夹: {old_folder}")
                            except Exception as e:
                                print(f"删除空文件夹失败: {e}")

            # 处理完所有议程项后，检查并删除不再使用的文件夹
            print(f"\n当前使用的议程项文件夹: {current_agenda_folders}")

            # 获取会议目录中的所有议程项文件夹
            all_agenda_folders = set()
            for item in os.listdir(meeting_dir):
                if os.path.isdir(os.path.join(meeting_dir, item)) and item.startswith("agenda_"):
                    all_agenda_folders.add(item)

            print(f"所有议程项文件夹: {all_agenda_folders}")

            # 找出不再使用的文件夹
            unused_folders = all_agenda_folders - current_agenda_folders
            print(f"不再使用的文件夹: {unused_folders}")

            # 删除不再使用的文件夹
            for folder_name in unused_folders:
                folder_path = os.path.join(meeting_dir, folder_name)
                try:
                    shutil.rmtree(folder_path)
                    print(f"删除不再使用的文件夹: {folder_path}")
                except Exception as e:
                    print(f"删除文件夹失败: {folder_path}, 错误: {e}")

        except Exception as e:
            print(f"\n\n处理临时文件时发生全局错误: {e}")
            import traceback
            traceback.print_exc()
            # 不抛出异常，允许程序继续执行
            # 即使文件处理失败，也应该允许会议信息保存