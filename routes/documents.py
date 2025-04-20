"""
文档相关路由

此模块包含所有与文档管理相关的路由，包括文件的上传、查询、下载和删除。
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, File, UploadFile, Form, Path, Body
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
import uuid
import tempfile
import time
from datetime import datetime

# 导入数据库模型、模式和CRUD操作
import models, schemas, crud
from database import SessionLocal, get_db
from utils import format_file_size

# 创建路由器
router = APIRouter(
    prefix="/api/v1/documents",  # 使用不同的前缀避免与main.py中的路由冲突
    tags=["documents"],
    responses={404: {"description": "Not found"}},
)

# 获取项目根目录
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = current_dir
UPLOAD_DIR = os.path.join(project_root, "uploads")

@router.get("/")
def get_documents(db: Session = Depends(get_db)):
    """获取所有文档列表"""
    # 从uploads目录获取所有文件
    documents = []
    document_id = 0

    # 获取所有会议信息，用于关联文件
    meetings = crud.get_meetings(db)
    meeting_map = {meeting.id: meeting.title for meeting in meetings}

    # 查询所有议程项，用于检查文件引用
    all_agenda_items = db.query(models.AgendaItem).all()
    file_references = {}

    # 遍历所有议程项，收集文件引用信息
    for item in all_agenda_items:
        if not item.files:
            continue

        for file_info in item.files:
            if not isinstance(file_info, dict) or 'path' not in file_info:
                continue

            file_path = file_info.get('path', '')
            if not file_path:
                continue

            # 规范化路径，以便比较
            norm_path = os.path.normpath(file_path).replace("\\", "/")

            # 如果这个文件路径还没有记录，创建一个新条目
            if norm_path not in file_references:
                file_references[norm_path] = []

            # 添加引用信息
            file_references[norm_path].append({
                "agenda_item_id": item.id,
                "agenda_item_title": item.title,
                "meeting_id": item.meeting_id
            })

    # 遍历uploads目录
    for root, _, files in os.walk(UPLOAD_DIR):
        for file_name in files:
            if file_name.endswith(".pdf"):
                file_path = os.path.join(root, file_name)
                file_size = os.path.getsize(file_path)

                # 确保URL是相对路径格式，而不是本地文件系统路径
                # 将绝对路径转换为相对URL路径
                rel_path = os.path.relpath(file_path, project_root)
                file_url = '/' + rel_path.replace("\\", "/")

                # 确保URL以/uploads开头
                if not file_url.startswith('/uploads'):
                    file_url = '/uploads/' + os.path.basename(file_path)

                # 格式化文件大小
                size_formatted = format_file_size(file_size)

                # 尝试确定文件的上传时间
                try:
                    upload_time = datetime.fromtimestamp(os.path.getctime(file_path)).strftime("%Y-%m-%d %H:%M:%S")
                except:
                    upload_time = "未知"

                # 尝试确定文件所属的会议
                meeting_id = None
                meeting_title = "未关联会议"

                # 从文件路径中提取会议ID
                path_parts = file_path.replace("\\", "/").split("/")
                if "uploads" in path_parts:
                    uploads_index = path_parts.index("uploads")
                    if len(path_parts) > uploads_index + 1:
                        potential_meeting_id = path_parts[uploads_index + 1]
                        if potential_meeting_id in meeting_map:
                            meeting_id = potential_meeting_id
                            meeting_title = meeting_map[meeting_id]

                # 检查文件是否正在被议程项使用
                norm_path = os.path.normpath(file_path).replace("\\", "/")
                is_in_use = norm_path in file_references
                file_usage = file_references.get(norm_path, [])

                # 确定文件是否可删除
                # 只有未被任何会议引用的文件，或者会议已被删除的文件才可删除
                is_deletable = not is_in_use

                # 如果文件正在被使用，但所有引用它的会议都已不存在，则也可以删除
                if is_in_use:
                    all_meetings_deleted = True
                    for usage in file_usage:
                        ref_meeting_id = usage.get("meeting_id")
                        if ref_meeting_id in meeting_map:
                            all_meetings_deleted = False
                            break
                    is_deletable = all_meetings_deleted

                # 确定文件状态描述
                if is_in_use and not is_deletable:
                    file_status = "正在使用"
                elif is_in_use and is_deletable:
                    file_status = "会议已删除"
                else:
                    file_status = "未使用"

                # 处理文件显示名称
                # 如果文件名格式为UUID_原始文件名.pdf，则提取原始文件名
                display_name = file_name
                try:
                    if "_" in file_name and uuid.UUID(file_name.split("_")[0], version=4):
                        display_name = "_".join(file_name.split("_")[1:])
                except:
                    # 如果不是UUID格式，使用原始文件名
                    pass

                documents.append({
                    "id": str(document_id),
                    "name": display_name,  # 使用处理后的显示名称
                    "original_name": file_name,  # 保留原始文件名
                    "type": "PDF",
                    "size": file_size,
                    "size_formatted": size_formatted,
                    "upload_time": upload_time,
                    "url": file_url,
                    "meeting_id": meeting_id,
                    "meeting_title": meeting_title,
                    "path": file_path,  # 添加完整路径，方便删除操作
                    "is_in_use": is_in_use,  # 标记文件是否正在被议程项使用
                    "is_deletable": is_deletable,  # 标记文件是否可以删除
                    "file_status": file_status,  # 文件状态描述
                    "usage": file_usage if is_in_use else []  # 记录使用该文件的议程项信息
                })
                document_id += 1

    return {"documents": documents, "total": len(documents)}

@router.delete("/deletable")
def delete_all_deletable_documents(db: Session = Depends(get_db)):
    """删除所有可删除的文件（包括临时文件和未被会议引用的文件）"""
    try:
        # 获取所有文档
        docs_data = get_documents(db)
        documents = docs_data.get("documents", [])

        # 筛选出可删除的文件
        # 注意：只有会议被删除或未绑定会议的文件可以删除
        deletable_docs = [doc for doc in documents if doc.get("is_deletable", False)]

        print(f"找到 {len(deletable_docs)} 个可删除文件，总共 {len(documents)} 个文件")

        # 删除每个可删除的文件
        deleted_files = []
        errors = []

        for doc in deletable_docs:
            try:
                file_path = doc.get("path")
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
                    deleted_files.append({
                        "name": doc.get("name"),
                        "path": file_path
                    })
                    print(f"已删除文件: {file_path}")
                else:
                    errors.append({
                        "name": doc.get("name"),
                        "error": "文件不存在"
                    })
            except Exception as e:
                errors.append({
                    "name": doc.get("name"),
                    "error": str(e)
                })
                print(f"删除文件时出错: {e}")

        return JSONResponse(
            status_code=200,
            content={
                "message": f"成功删除 {len(deleted_files)} 个文件，失败 {len(errors)} 个",
                "deleted": deleted_files,
                "errors": errors,
                "status": "success"
            }
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"批量删除文件时出错: {error_details}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"批量删除文件失败: {str(e)}",
                "status": "error"
            }
        )

@router.post("/{document_id}/unbind")
async def unbind_document(document_id: str, db: Session = Depends(get_db)):
    """解绑文档与会议的关联，将文件移动到临时文件夹，删除JPG文件夹"""
    try:
        # 首先获取文件路径
        file_path = None

        # 获取文档列表并尝试查找匹配的文件
        documents = get_documents(db).get("documents", [])
        try:
            doc_id = int(document_id)
            if 0 <= doc_id < len(documents):
                target_file = documents[doc_id]
                file_path = target_file.get("path")
                meeting_id = target_file.get("meeting_id")
                original_name = target_file.get("original_name")
        except (ValueError, TypeError):
            # 如果document_id不是有效的整数或者找不到文件，返回错误
            return JSONResponse(
                status_code=404,
                content={"message": f"文件不存在: {document_id}"}
            )

        # 如果找不到文件，返回404错误
        if not file_path or not os.path.exists(file_path):
            return JSONResponse(
                status_code=404,
                content={"message": f"文件不存在: {document_id}"}
            )

        # 规范化路径，以便比较
        norm_path = os.path.normpath(file_path).replace("\\", "/")
        file_name = os.path.basename(norm_path)

        # 查找所有引用该文件的议程项
        agenda_items = db.query(models.AgendaItem).all()
        referenced_items = []

        for item in agenda_items:
            if not item.files:
                continue

            # 创建一个新的文件列表，不包含要解绑的文件
            new_files = []
            modified = False

            for file_info in item.files:
                if not isinstance(file_info, dict) or 'path' not in file_info:
                    new_files.append(file_info)
                    continue

                item_file_path = file_info.get('path', '')
                if not item_file_path:
                    new_files.append(file_info)
                    continue

                # 规范化路径，以便比较
                item_norm_path = os.path.normpath(item_file_path).replace("\\", "/")

                if item_norm_path == norm_path:
                    # 记录引用信息
                    referenced_items.append({
                        "agenda_item_id": item.id,
                        "agenda_item_title": item.title,
                        "meeting_id": item.meeting_id
                    })
                    modified = True
                else:
                    new_files.append(file_info)

            # 如果有变化，更新议程项的文件列表
            if modified:
                item.files = new_files
                # 不在这里提交，而是在处理完所有议程项后再提交

        # 在处理完所有议程项后，提交数据库更改
        if referenced_items:  # 如果有引用被修改，则提交更改
            db.commit()
            print(f"成功更新所有议程项的文件列表")

        # 如果没有引用，返回成功消息
        if not referenced_items:
            return JSONResponse(
                status_code=200,
                content={
                    "message": f"文件没有被任何会议引用，无需解绑",
                    "status": "success"
                }
            )

        # 将文件移动到临时文件夹
        temp_dir = os.path.join(UPLOAD_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)

        # 提取原始文件名中的UUID和文件名部分
        original_uuid = ""
        original_filename = ""

        # 尝试从文件名中提取UUID
        pdf_filename = os.path.basename(file_path)
        print(f"处理文件: {pdf_filename}, 路径: {file_path}")

        if "_" in pdf_filename:
            parts = pdf_filename.split("_")
            potential_uuid = parts[0]
            # 验证是否是UUID格式
            try:
                uuid_obj = uuid.UUID(potential_uuid)
                original_uuid = potential_uuid
                original_filename = "_".join(parts[1:])
                print(f"从文件名提取到UUID: {original_uuid}, 原始文件名: {original_filename}")
            except ValueError:
                print(f"文件名中的第一部分不是UUID: {potential_uuid}")
                original_filename = pdf_filename
        else:
            original_filename = pdf_filename

        # 如果没有提取到UUID，生成一个新的
        if not original_uuid:
            original_uuid = str(uuid.uuid4())
            print(f"生成新的UUID: {original_uuid}")

        # 使用原始的UUID创建新的文件名，保持UUID一致性
        new_file_name = f"{original_uuid}_{original_filename}"
        new_file_path = os.path.join(temp_dir, new_file_name)
        print(f"新文件路径: {new_file_path}")

        # 复制文件到临时文件夹
        shutil.copy2(file_path, new_file_path)

        # 删除JPG文件夹
        if meeting_id:
            # 使用前面提取的原始UUID
            pdf_uuid = original_uuid
            print(f"使用原始UUID删除JPG文件夹: {pdf_uuid}")

            # 如果有UUID，尝试删除对应的JPG文件夹
            if pdf_uuid:
                print(f"将删除与UUID {pdf_uuid} 相关的JPG文件夹")

                # 定位议程项文件夹
                for ref_item in referenced_items:
                    agenda_item_id = ref_item.get("agenda_item_id")
                    agenda_folder_name = f"agenda_{agenda_item_id}"
                    agenda_dir = os.path.join(UPLOAD_DIR, meeting_id, agenda_folder_name)
                    jpg_dir = os.path.join(agenda_dir, "jpgs")
                    jpg_subdir = os.path.join(jpg_dir, pdf_uuid)

                    print(f"检查JPG文件夹: {jpg_subdir}")

                    # 如果JPG子目录存在，删除它
                    try:
                        if os.path.exists(jpg_subdir):
                            if os.path.isdir(jpg_subdir):
                                shutil.rmtree(jpg_subdir)
                                print(f"成功删除JPG文件夹: {jpg_subdir}")
                            else:
                                os.remove(jpg_subdir)
                                print(f"成功删除JPG文件: {jpg_subdir}")
                        else:
                            print(f"JPG文件夹不存在: {jpg_subdir}")

                            # 尝试在整个会议目录中搜索相关的JPG文件夹
                            meeting_dir = os.path.join(UPLOAD_DIR, meeting_id)
                            if os.path.exists(meeting_dir) and os.path.isdir(meeting_dir):
                                print(f"在整个会议目录中搜索: {meeting_dir}")
                                for root, dirs, files in os.walk(meeting_dir):
                                    if "jpgs" in dirs:
                                        jpgs_path = os.path.join(root, "jpgs")
                                        potential_uuid_dir = os.path.join(jpgs_path, pdf_uuid)
                                        if os.path.exists(potential_uuid_dir) and os.path.isdir(potential_uuid_dir):
                                            print(f"找到相关JPG文件夹: {potential_uuid_dir}")
                                            shutil.rmtree(potential_uuid_dir)
                                            print(f"成功删除JPG文件夹: {potential_uuid_dir}")
                    except Exception as e:
                        print(f"删除JPG文件夹时出错: {str(e)}")
                        import traceback
                        traceback.print_exc()
            else:
                print(f"无法从文件名中提取UUID: {pdf_filename}")

        # 删除原文件
        os.remove(file_path)

        return JSONResponse(
            status_code=200,
            content={
                "message": f"文件已成功解绑并移动到临时文件夹: {original_filename}",
                "status": "success",
                "new_path": new_file_path,
                "temp_id": original_uuid  # 使用原始的UUID而不是新生成的
            }
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"解绑文件时出错: {error_details}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"解绑文件失败: {str(e)}",
                "status": "error"
            }
        )

@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    """删除单个文件"""
    try:
        # 首先获取文件路径
        file_path = None

        # 尝试直接使用document_id作为路径
        direct_path = os.path.join(UPLOAD_DIR, document_id)
        if os.path.exists(direct_path):
            file_path = direct_path
        else:
            # 如果直接路径不存在，获取文档列表并尝试查找匹配的文件
            documents = get_documents(db).get("documents", [])
            try:
                doc_id = int(document_id)
                if 0 <= doc_id < len(documents):
                    target_file = documents[doc_id]
                    file_path = target_file.get("path")

                    # 检查文件是否可删除
                    # 判断文件所属会议是否存在，如果会议存在则不可删除（无论会议状态）
                    meeting_id = target_file.get("meeting_id")
                    is_deletable = target_file.get("is_deletable", False)

                    if not is_deletable:
                        return JSONResponse(
                            status_code=403,
                            content={
                                "message": "此文件关联的会议仍然存在，不能删除。只有会议被删除后，文件才可删除。",
                                "is_in_use": True,
                                "usage": target_file.get("usage", [])
                            }
                        )
            except (ValueError, TypeError):
                # 如果document_id不是有效的整数或者找不到文件，继续尝试其他方法
                pass

        # 如果找不到文件，返回404错误
        if not file_path or not os.path.exists(file_path):
            return JSONResponse(
                status_code=404,
                content={"message": f"文件不存在: {document_id}"}
            )

        # 检查文件是否正在被议程项使用
        norm_path = os.path.normpath(file_path).replace("\\", "/")
        file_name = os.path.basename(norm_path)

        # 查找所有引用该文件的议程项
        agenda_items = db.query(models.AgendaItem).all()
        referenced_items = []

        for item in agenda_items:
            if not item.files:
                continue

            for file_info in item.files:
                if not isinstance(file_info, dict) or 'path' not in file_info:
                    continue

                item_file_path = file_info.get('path', '')
                if not item_file_path:
                    continue

                # 规范化路径，以便比较
                item_norm_path = os.path.normpath(item_file_path).replace("\\", "/")

                if item_norm_path == norm_path:
                    # 检查会议是否存在
                    meeting = crud.get_meeting(db, meeting_id=item.meeting_id)
                    if meeting:
                        referenced_items.append({
                            "agenda_item_id": item.id,
                            "agenda_item_title": item.title,
                            "meeting_id": item.meeting_id,
                            "meeting_title": meeting.title
                        })

        # 如果文件正在被使用，不允许删除
        if referenced_items:
            return JSONResponse(
                status_code=403,
                content={
                    "message": "此文件正在被以下会议使用，不能删除",
                    "is_in_use": True,
                    "usage": referenced_items
                }
            )

        # 删除文件
        os.remove(file_path)

        return JSONResponse(
            status_code=200,
            content={
                "message": f"文件已成功删除: {file_name}",
                "status": "success"
            }
        )
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"删除文件时出错: {error_details}")
        return JSONResponse(
            status_code=500,
            content={
                "message": f"删除文件失败: {str(e)}",
                "status": "error"
            }
        )
