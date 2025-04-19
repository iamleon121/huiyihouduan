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
    def get_meetings(db: Session, skip: int = 0, limit: int = 100):
        """获取会议列表"""
        return crud.get_meetings(db, skip=skip, limit=limit)

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
        # 处理临时文件
        await MeetingService.process_temp_files_in_meeting(meeting_data)

        # 创建会议
        db_meeting = crud.create_meeting(db=db, meeting=meeting_data)
        return db_meeting

    @staticmethod
    async def update_meeting(db: Session, meeting_id: str, meeting_data: Dict[str, Any]):
        """更新会议信息"""
        # 处理临时文件
        if meeting_data.part:
            await MeetingService.process_temp_files_in_meeting_update(meeting_id, meeting_data)

        # 更新会议
        db_meeting = crud.update_meeting(db=db, meeting_id=meeting_id, meeting_update=meeting_data)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        return db_meeting

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
    def delete_meeting(db: Session, meeting_id: str):
        """删除会议"""
        success = crud.delete_meeting(db=db, meeting_id=meeting_id)
        if not success:
            raise HTTPException(status_code=404, detail="会议未找到")
        return True

    @staticmethod
    async def upload_meeting_files(db: Session, meeting_id: str, agenda_item_id: int, files: List[Any]):
        """上传会议文件"""
        # 检查会议是否存在
        db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
        if db_meeting is None:
            raise HTTPException(status_code=404, detail="会议未找到")

        # 检查议程项是否存在
        db_agenda_item = db.query(models.AgendaItem).filter(
            models.AgendaItem.id == agenda_item_id,
            models.AgendaItem.meeting_id == meeting_id
        ).first()

        if db_agenda_item is None:
            raise HTTPException(status_code=404, detail="议程项未找到")

        # 创建会议目录
        meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        # 创建议程项目录
        agenda_dir = os.path.join(meeting_dir, f"agenda_{agenda_item_id}")
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
            # 使用异步方式调用PDF转JPG功能
            await PDFService.convert_pdf_to_jpg_for_pad(file_path, jpg_subdir)

            # 添加文件信息
            file_info = {
                "name": file.filename,
                "path": file_path,
                "size": os.path.getsize(file_path),
                "url": f"/uploads/{meeting_id}/agenda_{agenda_item_id}/{filename}",
                "display_name": file.filename,
                "meeting_id": meeting_id,
                "agenda_folder": f"agenda_{agenda_item_id}"
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
            agenda_item_id = agenda_item.id
            agenda_dir = os.path.join(meeting_dir, f"agenda_{agenda_item_id}")
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
                                jpg_path = f"/uploads/{meeting_id}/agenda_{agenda_item_id}/jpgs/{pdf_id}/{jpg_file}"
                                jpg_paths.append(jpg_path)
                        return jpg_paths
                    return await AsyncUtils.run_in_threadpool(_get_jpg_files)

                jpg_files = await get_jpg_files()

                # 如果有JPG文件，添加到结果中
                if jpg_files:
                    agenda_files.append({
                        "pdf_id": pdf_id,
                        "pdf_file": f"/uploads/{meeting_id}/agenda_{agenda_item_id}/{pdf_file}",
                        "jpg_files": jpg_files
                    })

            # 添加议程项信息
            if agenda_files:
                agenda_info = {
                    "id": agenda_item_id,
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
            agenda_item_id = agenda_item.id
            agenda_dir = os.path.join(meeting_dir, f"agenda_{agenda_item_id}")

            # 准备议程项信息
            agenda_info = {
                "id": agenda_item_id,
                "title": agenda_item.title,
                "content": agenda_item.content,
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
                        "url": f"/uploads/{meeting_id}/agenda_{agenda_item_id}/{file}",
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
        """下载会议的JPG文件包，将所有JPG文件打包成ZIP文件
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

        # 创建内存中的ZIP文件
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # 遍历会议的所有议程项
            for agenda_item in db_meeting.agenda_items:
                agenda_item_id = agenda_item.id
                agenda_dir = os.path.join(meeting_dir, f"agenda_{agenda_item_id}")
                jpg_dir = os.path.join(agenda_dir, "jpgs")

                # 使用线程池检查目录是否存在
                agenda_dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(agenda_dir))
                if not agenda_dir_exists:
                    continue

                # 使用线程池检查JPG目录是否存在
                jpg_dir_exists = await AsyncUtils.run_in_threadpool(lambda: os.path.exists(jpg_dir))
                if not jpg_dir_exists:
                    continue

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

                    # 如果找不到对应的PDF文件，使用默认名称
                    pdf_name = pdf_file.split("_", 1)[1] if pdf_file and "_" in pdf_file else f"document_{pdf_id}.pdf"

                    # 使用线程池获取所有JPG文件
                    async def get_jpg_files():
                        def _get_jpg_files():
                            return [f for f in os.listdir(pdf_jpg_dir) if f.lower().endswith(".jpg")]
                        return await AsyncUtils.run_in_threadpool(_get_jpg_files)

                    jpg_files = await get_jpg_files()

                    # 遍历所有JPG文件并添加到ZIP包中
                    for jpg_file in jpg_files:
                        jpg_path = os.path.join(pdf_jpg_dir, jpg_file)
                        # 在ZIP文件中创建层次结构
                        zip_path = f"{db_meeting.title}/议程{agenda_item_id}_{agenda_item.title}/{pdf_name}/{jpg_file}"

                        # 使用线程池将文件添加到ZIP包中
                        await AsyncUtils.run_in_threadpool(lambda: zip_file.write(jpg_path, zip_path))

        # 将指针移动到文件开头
        zip_buffer.seek(0)
        return zip_buffer

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
                            # 如果是字典且有name字段，添加到现有文件映射中用于去重
                            if isinstance(f, dict) and 'name' in f:
                                existing_files[f['name']] = f
                    except Exception as e:
                        print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

                if not temp_files:
                    print("没有临时文件需要处理")
                    continue

                print(f"找到 {len(temp_files)} 个临时文件")
                print(f"保留 {len(non_temp_files)} 个非临时文件")

                # 创建议程项目录
                agenda_folder_name = f"agenda_{agenda_index+1}"
                agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
                os.makedirs(agenda_dir, exist_ok=True)
                print(f"创建议程项目录: {agenda_dir}")

                # 创廾JPG文件存储目录
                jpg_dir = os.path.join(agenda_dir, "jpgs")
                os.makedirs(jpg_dir, exist_ok=True)

                # 检查目录中已有的文件
                for filename in os.listdir(agenda_dir):
                    if filename.endswith(".pdf") and "_" in filename:
                        # 提取原始文件名（去除UUID前缀）
                        original_name = "_".join(filename.split("_")[1:])
                        if original_name not in existing_files:
                            file_path = os.path.join(agenda_dir, filename)
                            file_size = os.path.getsize(file_path)
                            existing_files[original_name] = {
                                "name": original_name,
                                "path": file_path,
                                "size": file_size,
                                "url": f"/uploads/{meeting_data.id}/{agenda_folder_name}/{filename}",
                                "display_name": original_name,  # 添加显示名称，不包含UUID前缀
                                "meeting_id": meeting_data.id,  # 添加会议ID关联
                                "agenda_folder": agenda_folder_name  # 添加议程文件夹关联
                            }

                # 处理每个临时文件
                processed_files = []
                for file_info in temp_files:
                    try:
                        print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                        # 检查文件是否已存在（通过文件名去重）
                        file_name = file_info.get('name')
                        if file_name in existing_files:
                            print(f"文件已存在: {file_name}，复用现有文件")
                            existing_file = existing_files[file_name]
                            processed_files.append(existing_file)

                            # 检查是否已经生成过JPG文件
                            pdf_path = existing_file.get("path")
                            pdf_filename = os.path.basename(pdf_path)
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)

                            # 如果JPG子目录不存在，则需要转换
                            if not os.path.exists(jpg_subdir) and pdf_path and os.path.exists(pdf_path):
                                print(f"为已存在的PDF生成JPG文件: {pdf_path}")
                                os.makedirs(jpg_subdir, exist_ok=True)
                                # 使用异步方式调用PDF转JPG功能
                                await PDFService.convert_pdf_to_jpg_for_pad(pdf_path, jpg_subdir)
                            continue

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

                        # 复制文件而不是移动，以避免权限问题
                        shutil.copy2(temp_path, new_path)
                        print("文件复制成功")

                        # 尝试删除原文件，如果失败也不影响继续
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

                        # 为新处理的PDF文件创廾JPG文件
                        if file_name.lower().endswith(".pdf"):
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_filename = os.path.basename(new_path)
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)
                            os.makedirs(jpg_subdir, exist_ok=True)
                            # 使用异步方式调用PDF转JPG功能
                            await PDFService.convert_pdf_to_jpg_for_pad(new_path, jpg_subdir)

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
                            # 如果是字典且有name字段，添加到现有文件映射中用于去重
                            if isinstance(f, dict) and 'name' in f:
                                existing_files[f['name']] = f
                    except Exception as e:
                        print(f"处理文件信息时出错: {e}, 文件类型: {type(f)}")

                print(f"找到 {len(temp_files)} 个临时文件")
                print(f"保留 {len(non_temp_files)} 个非临时文件")

                # 如果没有临时文件，直接使用非临时文件
                if not temp_files:
                    agenda_item.files = non_temp_files
                    continue

                # 创建议程项目录
                agenda_folder_name = f"agenda_{agenda_item.id}"
                agenda_dir = os.path.join(meeting_dir, agenda_folder_name)
                os.makedirs(agenda_dir, exist_ok=True)
                print(f"创建议程项目录: {agenda_dir}")

                # 创廾JPG文件存储目录
                jpg_dir = os.path.join(agenda_dir, "jpgs")
                os.makedirs(jpg_dir, exist_ok=True)

                # 检查目录中已有的文件
                for filename in os.listdir(agenda_dir):
                    if filename.endswith(".pdf") and "_" in filename:
                        # 提取原始文件名（去除UUID前缀）
                        original_name = "_".join(filename.split("_")[1:])
                        if original_name not in existing_files:
                            file_path = os.path.join(agenda_dir, filename)
                            file_size = os.path.getsize(file_path)
                            existing_files[original_name] = {
                                "name": original_name,
                                "path": file_path,
                                "size": file_size,
                                "url": f"/uploads/{meeting_id}/{agenda_folder_name}/{filename}",
                                "display_name": original_name,  # 添加显示名称，不包含UUID前缀
                                "meeting_id": meeting_id,  # 添加会议ID关联
                                "agenda_folder": agenda_folder_name  # 添加议程文件夹关联
                            }

                # 处理每个临时文件
                processed_files = []
                for file_info in temp_files:
                    try:
                        print(f"\n处理文件: {file_info.get('name', 'unknown')}")

                        # 检查文件是否已存在（通过文件名去重）
                        file_name = file_info.get('name')
                        if file_name in existing_files:
                            print(f"文件已存在: {file_name}，复用现有文件")
                            existing_file = existing_files[file_name]
                            processed_files.append(existing_file)

                            # 检查是否已经生成过JPG文件
                            pdf_path = existing_file.get("path")
                            pdf_filename = os.path.basename(pdf_path)
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)

                            # 如果JPG子目录不存在，则需要转换
                            if not os.path.exists(jpg_subdir) and pdf_path and os.path.exists(pdf_path):
                                print(f"为已存在的PDF生成JPG文件: {pdf_path}")
                                os.makedirs(jpg_subdir, exist_ok=True)
                                # 使用异步方式调用PDF转JPG功能
                                await PDFService.convert_pdf_to_jpg_for_pad(pdf_path, jpg_subdir)
                            continue

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

                        # 复制文件而不是移动，以避免权限问题
                        shutil.copy2(temp_path, new_path)
                        print("文件复制成功")

                        # 尝试删除原文件，如果失败也不影响继续
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

                        # 为新处理的PDF文件创廾JPG文件
                        if file_name.lower().endswith(".pdf"):
                            # 从UUID_filename.pdf格式中提取UUID部分
                            pdf_filename = os.path.basename(new_path)
                            pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
                            jpg_subdir = os.path.join(jpg_dir, pdf_uuid)
                            os.makedirs(jpg_subdir, exist_ok=True)
                            # 使用异步方式调用PDF转JPG功能
                            await PDFService.convert_pdf_to_jpg_for_pad(new_path, jpg_subdir)

                    except Exception as e:
                        print(f"处理临时文件时出错: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # 更新议程项的文件列表 - 合并非临时文件和处理后的临时文件
                agenda_item.files = non_temp_files + processed_files

        except Exception as e:
            print(f"\n\n处理临时文件时发生全局错误: {e}")
            import traceback
            traceback.print_exc()
            # 不抛出异常，允许程序继续执行
            # 即使文件处理失败，也应该允许会议信息保存
