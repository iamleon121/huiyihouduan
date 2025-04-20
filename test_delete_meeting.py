import asyncio
import sys
import requests
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import os

# 测试会议ID - 请替换为实际存在的会议ID
MEETING_ID = "a69f2e2d-a741-43d8-85cb-5b289b0e0ce2"

async def test_delete_meeting():
    """测试删除会议功能，验证会议文件夹是否被删除"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 获取当前会议信息
        meeting = db.query(models.Meeting).filter(models.Meeting.id == MEETING_ID).first()
        if not meeting:
            print(f"错误: 会议 {MEETING_ID} 不存在")
            return 1
        
        print(f"准备删除会议: {meeting.title} (ID: {MEETING_ID})")
        
        # 检查会议文件夹是否存在
        meeting_dir = os.path.join("uploads", MEETING_ID)
        if os.path.exists(meeting_dir):
            print(f"会议文件夹存在: {meeting_dir}")
            file_count = sum([len(files) for _, _, files in os.walk(meeting_dir)])
            print(f"文件夹中包含 {file_count} 个文件")
        else:
            print(f"会议文件夹不存在: {meeting_dir}")
        
        # 调用API删除会议
        url = f"http://localhost:8000/api/v1/meetings/{MEETING_ID}"
        
        print(f"调用API删除会议: {url}")
        response = requests.delete(url)
        
        if response.status_code == 204:
            print("会议删除成功！")
            
            # 检查会议文件夹是否已被删除
            if os.path.exists(meeting_dir):
                print(f"错误: 会议文件夹仍然存在: {meeting_dir}")
                return 1
            else:
                print(f"会议文件夹已成功删除: {meeting_dir}")
                
            # 检查会议是否已从数据库中删除
            db.expire_all()  # 刷新会话
            deleted_meeting = db.query(models.Meeting).filter(models.Meeting.id == MEETING_ID).first()
            if deleted_meeting:
                print(f"错误: 会议仍然存在于数据库中: {deleted_meeting.id}")
                return 1
            else:
                print("会议已成功从数据库中删除")
                
            return 0
        else:
            print(f"会议删除失败！状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return 1
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_delete_meeting())
    sys.exit(exit_code)
