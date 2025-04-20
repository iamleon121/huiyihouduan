import asyncio
import sys
import json
import requests
from sqlalchemy.orm import Session
from database import SessionLocal
import models

# 测试会议ID
MEETING_ID = "a69f2e2d-a741-43d8-85cb-5b289b0e0ce2"  # 实际的会议ID

async def test_start_meeting():
    """测试开始会议，将会议状态从"未开始"变为"进行中" """
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 获取当前会议状态
        meeting = db.query(models.Meeting).filter(models.Meeting.id == MEETING_ID).first()
        if not meeting:
            print(f"错误: 会议 {MEETING_ID} 不存在")
            return 1
        
        current_status = meeting.status
        print(f"当前会议状态: {current_status}")
        
        if current_status == "进行中":
            print("会议已经处于进行中状态，先将其改为未开始状态")
            # 将会议状态改为"未开始"
            meeting.status = "未开始"
            db.commit()
            print("会议状态已改为未开始")
        
        # 调用API将会议状态改为"进行中"
        url = f"http://localhost:8000/api/v1/meetings/{MEETING_ID}/status"
        data = {"status": "进行中"}
        headers = {"Content-Type": "application/json"}
        
        print(f"调用API将会议状态改为进行中: {url}")
        response = requests.put(url, data=json.dumps(data), headers=headers)
        
        if response.status_code == 200:
            print("会议状态更新成功！")
            result = response.json()
            print(f"返回结果: {result}")
            return 0
        else:
            print(f"会议状态更新失败！状态码: {response.status_code}")
            print(f"错误信息: {response.text}")
            return 1
    except Exception as e:
        print(f"发生错误: {str(e)}")
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    # 运行测试
    exit_code = asyncio.run(test_start_meeting())
    sys.exit(exit_code)
