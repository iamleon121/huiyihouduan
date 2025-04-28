from fastapi import APIRouter, HTTPException
from typing import Dict, List
from pydantic import BaseModel
import time
import logging

from node_manager import (
    register_node, unregister_node, update_node_heartbeat,
    get_available_nodes, get_nodes_info
)

# 配置日志
logger = logging.getLogger("nodes_router")

router = APIRouter(prefix="/api/v1/nodes", tags=["nodes"])

# 数据模型
class NodeRegistration(BaseModel):
    node_id: str
    address: str
    status: str = "online"

class MeetingInfo(BaseModel):
    id: str
    title: str = None

class NodeHeartbeat(BaseModel):
    node_id: str
    address: str  # 添加节点地址字段，用于自动重新注册
    status: str = "online"
    active_meetings: List[MeetingInfo] = []  # 活动会议列表
    synced_meetings: List[str] = []  # 已同步的会议ID列表

class NodeUnregistration(BaseModel):
    node_id: str

# API路由
@router.post("/register")
async def api_register_node(node_data: NodeRegistration):
    """注册分布式节点"""
    success = await register_node(node_data.node_id, node_data.address)

    if not success:
        raise HTTPException(status_code=400, detail="Invalid node data")

    return {"status": "success", "message": f"Node {node_data.node_id} registered"}

@router.post("/unregister")
async def api_unregister_node(node_data: NodeUnregistration):
    """注销分布式节点"""
    success = await unregister_node(node_data.node_id)

    if not success:
        raise HTTPException(status_code=404, detail=f"Node {node_data.node_id} not found")

    return {"status": "success", "message": f"Node {node_data.node_id} unregistered"}

@router.post("/heartbeat")
async def api_node_heartbeat(heartbeat: NodeHeartbeat):
    """接收节点心跳

    如果节点存在，则更新节点的最后心跳时间、活动会议信息和已同步会议信息。
    如果节点不存在，则自动重新注册该节点。
    """
    # 提取活动会议信息
    active_meetings = [
        {"id": meeting.id, "title": meeting.title}
        for meeting in heartbeat.active_meetings
    ] if heartbeat.active_meetings else []

    # 提取已同步会议信息
    synced_meetings = heartbeat.synced_meetings if heartbeat.synced_meetings else []

    # 尝试更新节点心跳、活动会议信息和已同步会议信息
    success = await update_node_heartbeat(heartbeat.node_id, active_meetings, synced_meetings)

    # 如果节点不存在，尝试重新注册
    if not success:
        logger.info(f"节点 {heartbeat.node_id} 不存在，尝试重新注册")
        # 使用心跳中的信息重新注册节点
        success = await register_node(heartbeat.node_id, heartbeat.address)
        if not success:
            raise HTTPException(status_code=400, detail=f"无法重新注册节点 {heartbeat.node_id}")
        logger.info(f"节点 {heartbeat.node_id} 已自动重新注册")

        # 注册成功后，更新活动会议信息和已同步会议信息
        if active_meetings or synced_meetings:
            await update_node_heartbeat(heartbeat.node_id, active_meetings, synced_meetings)
            logger.info(f"节点 {heartbeat.node_id} 活动会议信息已更新: {len(active_meetings)} 个会议，已同步会议: {len(synced_meetings)} 个")

    return {"status": "success", "timestamp": time.time()}

@router.get("/list")
async def api_list_nodes():
    """获取所有节点信息"""
    return get_nodes_info()

@router.get("/available")
async def api_available_nodes():
    """获取可用节点列表"""
    nodes = await get_available_nodes()
    return {"count": len(nodes), "nodes": nodes}
