import asyncio
import sys
import json
import requests
import os
from sqlalchemy.orm import Session
from database import SessionLocal
import models

async def test_unbind_document():
    """测试解绑文档与会议的关联"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 获取文档列表
        response = requests.get("http://localhost:8000/api/v1/documents/")
        if response.status_code != 200:
            print(f"获取文档列表失败！状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return 1
        
        documents = response.json().get("documents", [])
        if not documents:
            print("没有找到任何文档")
            return 1
        
        # 找到第一个关联了会议的文档
        target_doc = None
        for doc in documents:
            if doc.get("meeting_id") and not doc.get("is_deletable", False):
                target_doc = doc
                break
        
        if not target_doc:
            print("没有找到关联了会议的文档")
            return 1
        
        doc_id = target_doc.get("id")
        doc_name = target_doc.get("name")
        meeting_id = target_doc.get("meeting_id")
        
        print(f"找到关联了会议的文档: {doc_name} (ID: {doc_id}), 会议ID: {meeting_id}")
        
        # 检查JPG文件夹是否存在
        pdf_filename = os.path.basename(target_doc.get("path", ""))
        pdf_uuid = pdf_filename.split("_")[0] if "_" in pdf_filename else ""
        
        jpg_folders = []
        if pdf_uuid:
            # 查找所有可能的JPG文件夹
            uploads_dir = os.path.join("uploads", meeting_id)
            for root, dirs, files in os.walk(uploads_dir):
                if "jpgs" in dirs:
                    jpgs_dir = os.path.join(root, "jpgs")
                    if os.path.exists(os.path.join(jpgs_dir, pdf_uuid)):
                        jpg_folders.append(os.path.join(jpgs_dir, pdf_uuid))
        
        if jpg_folders:
            print(f"找到JPG文件夹: {jpg_folders}")
        else:
            print("没有找到JPG文件夹")
        
        # 调用解绑API
        unbind_url = f"http://localhost:8000/api/v1/documents/{doc_id}/unbind"
        unbind_response = requests.post(unbind_url)
        
        if unbind_response.status_code != 200:
            print(f"解绑文档失败！状态码: {unbind_response.status_code}")
            print(f"错误信息: {unbind_response.text}")
            return 1
        
        result = unbind_response.json()
        print(f"解绑文档成功: {result}")
        
        # 检查文件是否已移动到临时文件夹
        temp_dir = os.path.join("uploads", "temp")
        temp_file_found = False
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.endswith(doc_name):
                    temp_file_found = True
                    print(f"找到临时文件: {os.path.join(root, file)}")
                    break
        
        if not temp_file_found:
            print("警告: 没有在临时文件夹中找到解绑的文件")
        
        # 检查JPG文件夹是否已删除
        jpg_folders_deleted = True
        for jpg_folder in jpg_folders:
            if os.path.exists(jpg_folder):
                jpg_folders_deleted = False
                print(f"警告: JPG文件夹仍然存在: {jpg_folder}")
        
        if jpg_folders and jpg_folders_deleted:
            print("所有JPG文件夹已成功删除")
        
        # 检查会议中是否已移除文件引用
        meeting_response = requests.get(f"http://localhost:8000/api/v1/meetings/{meeting_id}")
        if meeting_response.status_code != 200:
            print(f"获取会议详情失败！状态码: {meeting_response.status_code}")
            print(f"错误信息: {meeting_response.text}")
            return 1
        
        meeting_data = meeting_response.json()
        file_still_referenced = False
        
        if meeting_data.get("part"):
            for part in meeting_data["part"]:
                if part.get("files"):
                    for file in part["files"]:
                        if isinstance(file, dict) and file.get("path") == target_doc.get("path"):
                            file_still_referenced = True
                            print(f"警告: 文件仍然被会议引用: {file}")
                            break
        
        if not file_still_referenced:
            print("文件已成功从会议中移除")
        
        return 0
    except Exception as e:
        print(f"发生错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_unbind_document())
    sys.exit(exit_code)
