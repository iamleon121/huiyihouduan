"""
会议状态相关路由

此模块包含与会议状态相关的路由，用于获取会议状态信息。
包括前端客户端使用的状态端点和分布式节点使用的专用端点。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import time

# 导入数据库模型、模式和CRUD操作
import models, schemas, crud
from database import get_db

# 创建路由器
router = APIRouter(prefix="/api/v1/meetings", tags=["meetings_status"])

@router.get("/status/token")
async def get_meeting_status_token(db: Session = Depends(get_db)):
    """
    获取会议状态变更识别码和进行中的会议列表

    此API用于客户端获取会议状态变更识别码和进行中的会议列表。
    客户端可以通过比较识别码来判断是否需要刷新会议数据。

    Returns:
        dict: 包含会议状态变更识别码和会议列表的字典
          - id: 会议状态变更识别码
          - meetings: 会议列表，每个会议包含id、title、time和status
    """
    # 获取最新的会议变更识别码
    token = crud.get_meeting_change_status_token(db)

    # 获取所有会议
    meetings = crud.get_meetings(db)

    # 构建会议列表
    meeting_list = []
    for meeting in meetings:
        meeting_data = {
            "id": meeting.id,
            "title": meeting.title,
            "time": meeting.time,
            "status": meeting.status
        }

        # 如果会议状态为"进行中"，添加议程项信息
        if meeting.status == "进行中":
            # 获取议程项
            agenda_items = []
            for item in meeting.agenda_items:
                agenda_items.append({
                    "id": item.id,
                    "title": item.title,
                    "position": item.position
                })

            meeting_data["agenda_items"] = agenda_items

        meeting_list.append(meeting_data)

    # 返回状态信息
    return {
        "id": token,
        "timestamp": time.time(),
        "meetings": meeting_list
    }

@router.get("/status/node")
async def get_meeting_status_for_node(db: Session = Depends(get_db)):
    """
    获取会议状态信息（分布式节点专用）

    此API专为分布式节点设计，提供简化的会议状态信息，只包含必要的数据。
    分布式节点通过此API获取当前进行中的会议信息，用于同步会议文件。

    Returns:
        dict: 包含会议状态信息的字典
          - id: 会议状态变更识别码
          - active_meetings: 当前进行中的会议列表
          - timestamp: 当前时间戳
    """
    # 获取最新的会议变更识别码
    token = crud.get_meeting_change_status_token(db)

    # 获取所有进行中的会议
    meetings = crud.get_meetings_by_status(db, "进行中")

    # 构建活动会议列表
    active_meetings = []
    if meetings and len(meetings) > 0:
        for meeting in meetings:
            active_meetings.append({
                "id": meeting.id,
                "title": meeting.title
            })
        print(f"[节点API] 当前进行中会议数量: {len(active_meetings)}")
    else:
        print(f"[节点API] 当前没有进行中的会议")

    # 返回状态信息
    return {
        "id": token,
        "active_meetings": active_meetings,
        "timestamp": time.time()
    }
