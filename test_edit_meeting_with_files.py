import asyncio
import sys
import json
import requests
import os
from sqlalchemy.orm import Session
from database import SessionLocal
import models

# 测试会议ID - 请替换为实际存在的会议ID
MEETING_ID = "a69f2e2d-a741-43d8-85cb-5b289b0e0ce2"

async def test_edit_meeting_with_files():
    """测试编辑会议并上传新文件"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 获取当前会议信息
        meeting = db.query(models.Meeting).filter(models.Meeting.id == MEETING_ID).first()
        if not meeting:
            print(f"错误: 会议 {MEETING_ID} 不存在")
            return 1
        
        print(f"准备编辑会议: {meeting.title} (ID: {MEETING_ID})")
        
        # 检查会议文件夹是否存在
        meeting_dir = os.path.join("uploads", MEETING_ID)
        if os.path.exists(meeting_dir):
            print(f"会议文件夹存在: {meeting_dir}")
            file_count = sum([len(files) for _, _, files in os.walk(meeting_dir)])
            print(f"文件夹中包含 {file_count} 个文件")
        else:
            print(f"会议文件夹不存在: {meeting_dir}")
        
        # 获取会议详情
        url = f"http://localhost:8000/api/v1/meetings/{MEETING_ID}"
        response = requests.get(url)
        
        if response.status_code != 200:
            print(f"获取会议详情失败！状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return 1
        
        meeting_data = response.json()
        print(f"获取会议详情成功: {meeting_data['title']}")
        
        # 上传临时文件
        temp_file_path = "test_file.pdf"  # 请确保此文件存在
        if not os.path.exists(temp_file_path):
            print(f"测试文件不存在: {temp_file_path}")
            # 创建一个简单的测试PDF文件
            with open(temp_file_path, "wb") as f:
                f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF")
            print(f"创建测试文件: {temp_file_path}")
        
        files = {'files': open(temp_file_path, 'rb')}
        upload_url = "http://localhost:8000/api/v1/pdf/upload-temp"
        upload_response = requests.post(upload_url, files=files)
        
        if upload_response.status_code != 200:
            print(f"上传临时文件失败！状态码: {upload_response.status_code}")
            print(f"错误信息: {upload_response.text}")
            return 1
        
        temp_file_data = upload_response.json()
        print(f"上传临时文件成功: {temp_file_data}")
        
        # 获取上传的临时文件信息
        temp_file_info = temp_file_data['uploaded_files'][0]
        
        # 修改会议数据，添加新文件
        if 'part' not in meeting_data or not meeting_data['part']:
            meeting_data['part'] = [{"id": 1, "title": "测试议程项", "files": []}]
        
        # 添加临时文件到第一个议程项
        meeting_data['part'][0]['files'].append(temp_file_info)
        
        # 更新会议
        update_url = f"http://localhost:8000/api/v1/meetings/{MEETING_ID}"
        headers = {"Content-Type": "application/json"}
        update_response = requests.put(update_url, data=json.dumps(meeting_data), headers=headers)
        
        if update_response.status_code != 200:
            print(f"更新会议失败！状态码: {update_response.status_code}")
            print(f"错误信息: {update_response.text}")
            return 1
        
        print("会议更新成功！")
        
        # 检查会议文件夹中的文件
        print("\n检查会议文件夹中的文件:")
        for root, dirs, files in os.walk(meeting_dir):
            for file in files:
                print(f"- {os.path.join(root, file)}")
        
        # 检查是否生成了JPG文件
        jpg_found = False
        for root, dirs, files in os.walk(meeting_dir):
            for file in files:
                if file.lower().endswith(".jpg"):
                    jpg_found = True
                    print(f"找到JPG文件: {os.path.join(root, file)}")
        
        if jpg_found:
            print("成功生成JPG文件！")
        else:
            print("警告: 未找到JPG文件")
        
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
    exit_code = asyncio.run(test_edit_meeting_with_files())
    sys.exit(exit_code)
