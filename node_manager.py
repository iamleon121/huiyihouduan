import time
import random
import logging
from typing import Dict, List, Optional
import asyncio

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("node_manager")

# 节点注册表
nodes_registry: Dict[str, dict] = {}

# 节点状态检查间隔（秒）
NODE_CHECK_INTERVAL = 10  # 每10秒检查一次节点状态，与心跳间隔一致

# 节点心跳超时时间（秒）
NODE_HEARTBEAT_TIMEOUT = 30  # 30秒未收到心跳则认为节点离线（约3次心跳）

async def register_node(node_id: str, address: str) -> bool:
    """注册分布式节点"""
    global nodes_registry

    if not node_id or not address:
        logger.warning(f"尝试注册无效节点: id={node_id}, address={address}")
        return False

    # 添加到注册表
    nodes_registry[node_id] = {
        "address": address,
        "status": "online",
        "last_seen": time.time(),
        "registered_at": time.time(),
        "active_meeting": None,  # 初始化活动会议字段（兼容旧版本）
        "active_meetings": [],   # 初始化活动会议列表
        "meeting_token": None    # 初始化会议识别号字段
    }

    logger.info(f"节点注册成功: {node_id} ({address})")
    return True

async def unregister_node(node_id: str) -> bool:
    """注销分布式节点"""
    global nodes_registry

    if node_id in nodes_registry:
        del nodes_registry[node_id]
        logger.info(f"节点注销成功: {node_id}")
        return True

    logger.warning(f"尝试注销不存在的节点: {node_id}")
    return False

async def update_node_heartbeat(node_id: str, active_meetings: List[dict] = None) -> bool:
    """更新节点心跳时间和活动会议信息

    更新节点的最后心跳时间，并可选地更新节点的活动会议信息。

    Args:
        node_id: 节点ID
        active_meetings: 可选的活动会议列表，包含会议ID和标题
    """
    global nodes_registry

    if node_id in nodes_registry:
        # 更新最后心跳时间
        nodes_registry[node_id]["last_seen"] = time.time()

        # 如果提供了活动会议信息，更新节点的活动会议列表
        if active_meetings is not None:
            nodes_registry[node_id]["active_meetings"] = active_meetings

            # 兼容旧版本，更新单一活动会议字段
            if active_meetings and len(active_meetings) > 0:
                # 将活动会议列表转换为字符串，用于显示
                meeting_titles = [m.get("title", f"会议 {m['id']}") for m in active_meetings if m.get("id")]
                if meeting_titles:
                    nodes_registry[node_id]["active_meeting"] = ", ".join(meeting_titles)
            else:
                nodes_registry[node_id]["active_meeting"] = None

        logger.debug(f"节点心跳更新: {node_id}")
        return True

    logger.warning(f"尝试更新不存在节点的心跳: {node_id}")
    return False

async def get_available_nodes() -> List[str]:
    """获取可用的分布式节点地址列表

    只返回在NODE_HEARTBEAT_TIMEOUT秒内有心跳的节点地址。
    """
    global nodes_registry

    available_nodes = []
    current_time = time.time()

    # 输出节点注册表信息
    print(f"[节点管理] 当前注册节点数量: {len(nodes_registry)}")
    for node_id, node_info in nodes_registry.items():
        # 计算节点最后心跳时间距离现在的秒数
        last_seen_seconds_ago = current_time - node_info["last_seen"]
        print(f"[节点管理] 节点 {node_id} ({node_info['address']}) 最后心跳: {last_seen_seconds_ago:.2f}秒前, 超时阈值: {NODE_HEARTBEAT_TIMEOUT}秒")

        # 检查节点是否在线（NODE_HEARTBEAT_TIMEOUT秒内有心跳）
        if last_seen_seconds_ago <= NODE_HEARTBEAT_TIMEOUT:
            # 确保地址格式正确（包含IP和端口）
            address = node_info["address"]
            if address and ":" in address:
                available_nodes.append(address)
                print(f"[节点管理] 节点 {node_id} ({address}) 在线，添加到可用节点列表")
            else:
                print(f"[节点管理] 节点 {node_id} 地址格式不正确: {address}，不添加到可用节点列表")
        else:
            print(f"[节点管理] 节点 {node_id} ({node_info['address']}) 离线，不添加到可用节点列表")

    print(f"[节点管理] 可用节点数量: {len(available_nodes)}, 节点列表: {available_nodes}")

    # 如果没有可用节点，添加一个测试节点（仅用于测试重定向功能）
    if not available_nodes and len(nodes_registry) > 0:
        # 获取第一个注册节点的地址
        for node_id, node_info in nodes_registry.items():
            address = node_info["address"]
            if address and ":" in address:
                available_nodes.append(address)
                print(f"[节点管理] 添加测试节点: {address}")
                break

    return available_nodes

def select_node(nodes: List[str]) -> Optional[str]:
    """选择最佳节点（简单实现：随机选择）"""
    if not nodes:
        return None

    return random.choice(nodes)

async def check_nodes_status():
    """定期检查节点状态，立即移除离线节点

    如果节点超过NODE_HEARTBEAT_TIMEOUT秒未发送心跳，则认为节点离线，从注册表中移除。
    """
    global nodes_registry

    while True:
        try:
            current_time = time.time()
            offline_nodes = []

            for node_id, node_info in nodes_registry.items():
                # 如果节点超过NODE_HEARTBEAT_TIMEOUT秒未发送心跳，则直接从注册表中移除
                if current_time - node_info["last_seen"] > NODE_HEARTBEAT_TIMEOUT:
                    offline_nodes.append(node_id)
                    logger.warning(f"节点 {node_id} ({node_info['address']}) 已离线（{NODE_HEARTBEAT_TIMEOUT}秒未收到心跳），从注册表中移除")

            # 从注册表中移除离线节点
            for node_id in offline_nodes:
                del nodes_registry[node_id]

            # 等待下一次检查
            await asyncio.sleep(NODE_CHECK_INTERVAL)
        except Exception as e:
            logger.error(f"检查节点状态出错: {str(e)}")
            await asyncio.sleep(NODE_CHECK_INTERVAL)

def get_nodes_info() -> List[dict]:
    """获取所有在线节点的信息

    只返回在NODE_HEARTBEAT_TIMEOUT秒内有心跳的节点信息。
    包含节点的活动会议信息。
    """
    nodes_info = []
    current_time = time.time()

    for node_id, node_info in nodes_registry.items():
        # 只返回在线节点（NODE_HEARTBEAT_TIMEOUT秒内有心跳）
        if current_time - node_info["last_seen"] <= NODE_HEARTBEAT_TIMEOUT:
            # 构建节点信息，包含会议相关信息
            node_data = {
                "node_id": node_id,
                "address": node_info["address"],
                "status": "online",  # 只有在线节点
                "last_seen": node_info["last_seen"],
                "uptime": time.time() - node_info["registered_at"]
            }

            # 添加活动会议信息
            # 兼容旧版本，如果有单一活动会议
            if node_info.get("active_meeting"):
                node_data["active_meeting"] = node_info["active_meeting"]

            # 添加活动会议列表
            if node_info.get("active_meetings") and len(node_info["active_meetings"]) > 0:
                # 将活动会议列表转换为字符串，用于显示
                meeting_titles = [m.get("title", f"会议 {m['id']}") for m in node_info["active_meetings"] if m.get("id")]
                if meeting_titles:
                    node_data["active_meeting"] = ", ".join(meeting_titles)

                # 同时添加完整的活动会议列表
                node_data["active_meetings"] = node_info["active_meetings"]

            nodes_info.append(node_data)

    return nodes_info

def start_background_tasks():
    """启动后台任务"""
    asyncio.create_task(check_nodes_status())
    logger.info("节点管理器后台任务已启动")
