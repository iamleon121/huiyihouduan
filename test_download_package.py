import asyncio
import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal
from services.meeting_service import MeetingService

# 测试会议ID
MEETING_ID = "a69f2e2d-a741-43d8-85cb-5b289b0e0ce2"  # 实际的会议ID

async def test_download_package():
    """测试下载会议ZIP包"""
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        print(f"开始下载会议 {MEETING_ID} 的ZIP包")
        
        # 调用下载ZIP包的方法
        zip_buffer = await MeetingService.download_meeting_package(db, MEETING_ID)
        
        # 将ZIP包保存到本地文件
        output_path = f"test_download_{MEETING_ID}.zip"
        with open(output_path, "wb") as f:
            f.write(zip_buffer.getvalue())
        
        # 检查文件大小
        file_size = os.path.getsize(output_path)
        print(f"ZIP包下载成功！文件大小: {file_size} 字节")
        print(f"文件保存路径: {os.path.abspath(output_path)}")
        
        return 0
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_download_package())
    sys.exit(exit_code)
