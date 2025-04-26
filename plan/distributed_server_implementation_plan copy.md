# 分布式文件服务器实现方案

## 目录

1. [需求概述](#需求概述)
2. [架构设计](#架构设计)
3. [组件实现](#组件实现)
4. [数据流程](#数据流程)
5. [部署方案](#部署方案)
6. [测试策略](#测试策略)
7. [实施计划](#实施计划)

## 需求概述

基于项目的新需求，需要从前端移除多服务器下载逻辑，改为采用分布式文件服务器架构。主要需求包括：

1. 减轻前端复杂度，移除多服务器下载逻辑
2. 实现主控服务器与分布式文件服务节点的协作机制
3. 确保文件分发高效、可靠
4. 支持高并发下载需求
5. 实现系统的可扩展性和灵活性

## 架构设计

### 整体架构

采用"中心辐射型"架构模式，包含以下组件：

1. **主控服务器**：负责业务逻辑和数据管理
2. **分布式文件服务节点**：负责文件存储和分发
3. **节点管理服务**：负责节点注册、监控和负载均衡

```
+-------------------+
|                   |
|   主控服务器       |
|                   |
+-------------------+
        |  |  |
        v  v  v
+-------+  +-------+  +-------+
|               |                |
| 文件服务节点1 | 文件服务节点2 | 文件服务节点3 |
|               |                |
+---------------+----------------+---------------+
        ^  ^  ^
        |  |  |
+-------------------+
|                   |
|    前端客户端     |
|                   |
+-------------------+
```

### 组件职责

1. **主控服务器**：
   - 管理会议数据和状态
   - 提供API接口给前端
   - 维护节点注册表
   - 实现负载均衡策略
   - 同步会议数据到文件服务节点

2. **分布式文件服务节点**：
   - 从主控服务器同步文件数据
   - 提供文件下载服务
   - 向主控服务器报告状态
   - 管理本地文件缓存

3. **前端客户端**：
   - 与主控服务器交互获取会议数据
   - 根据主控服务器提供的链接下载文件
   - 不再实现多服务器下载逻辑

## 组件实现

### 主控服务器实现

#### 1. 节点注册管理

```python
from fastapi import FastAPI, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Dict, Optional
import time
import uuid
import asyncio

# 节点模型
class Node(BaseModel):
    id: str
    ip: str
    port: int
    status: str = "active"  # active, inactive, maintenance
    health: float = 1.0     # 0.0-1.0 代表健康度
    last_heartbeat: float = 0.0
    storage_capacity: int = 0  # 字节
    storage_used: int = 0      # 字节

# 内存存储节点信息
nodes_registry: Dict[str, Node] = {}

# 节点注册
@app.post("/api/v1/nodes/register")
async def register_node(node_data: dict, request: Request):
    # 验证请求来源
    client_ip = request.client.host
    if client_ip != node_data.get("ip") and not is_local_network(client_ip, node_data.get("ip")):
        raise HTTPException(status_code=403, detail="IP address mismatch")
    
    # 创建或更新节点记录
    node_id = node_data.get("id") or str(uuid.uuid4())
    node = Node(
        id=node_id,
        ip=node_data["ip"],
        port=node_data["port"],
        status="active",
        last_heartbeat=time.time(),
        storage_capacity=node_data.get("storage_capacity", 0),
        storage_used=node_data.get("storage_used", 0)
    )
    
    nodes_registry[node_id] = node
    
    return {"id": node_id, "status": "registered"}

# 节点心跳
@app.post("/api/v1/nodes/{node_id}/heartbeat")
async def node_heartbeat(node_id: str, data: dict):
    if node_id not in nodes_registry:
        raise HTTPException(status_code=404, detail="Node not found")
    
    node = nodes_registry[node_id]
    node.last_heartbeat = time.time()
    node.health = data.get("health", node.health)
    node.status = data.get("status", node.status)
    node.storage_used = data.get("storage_used", node.storage_used)
    
    return {"status": "ok"}

# 获取活跃节点
async def get_active_nodes() -> List[Node]:
    current_time = time.time()
    # 获取过去60秒内有心跳的节点
    active_nodes = [
        node for node in nodes_registry.values()
        if node.status == "active" and current_time - node.last_heartbeat < 60
    ]
    return active_nodes
```

#### 2. 负载均衡实现

```python
async def select_node(nodes: List[Node], meeting_id: str = None) -> Optional[Node]:
    """选择最佳节点用于文件下载"""
    if not nodes:
        return None
    
    # 初始化节点评分
    node_scores = []
    
    for node in nodes:
        # 基础评分是节点健康度
        score = node.health * 10
        
        # 考虑存储使用率 (越低越好)
        if node.storage_capacity > 0:
            storage_ratio = node.storage_used / node.storage_capacity
            score -= storage_ratio * 3  # 存储使用率每10%减少0.3分
        
        # 如果有特定会议ID，检查此节点是否已有该会议的数据
        if meeting_id:
            has_meeting = await check_node_has_meeting(node, meeting_id)
            if has_meeting:
                score += 5  # 如果节点已有会议数据，加分
        
        # 添加一点随机因素来分散负载
        import random
        score += random.uniform(0, 1)
        
        node_scores.append((node, score))
    
    # 按评分降序排序
    node_scores.sort(key=lambda x: x[1], reverse=True)
    
    # 返回评分最高的节点
    return node_scores[0][0] if node_scores else None

async def check_node_has_meeting(node: Node, meeting_id: str) -> bool:
    """检查节点是否已有指定会议的数据"""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"http://{node.ip}:{node.port}/api/v1/node/meetings/{meeting_id}/status"
            async with session.get(url, timeout=2) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("exists", False)
    except Exception:
        pass
    return False
```

#### 3. 修改会议数据API

```python
@app.get("/api/v1/meetings/{meeting_id}/data")
async def get_meeting_data(meeting_id: str, db: Session = Depends(get_db)):
    """获取会议数据，包含分布式节点下载链接"""
    # 获取基本会议数据
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # 构建会议数据响应
    response_data = {
        "id": db_meeting.id,
        "title": db_meeting.title,
        "time": db_meeting.time,
        "status": db_meeting.status,
        "intro": db_meeting.intro,
        "agenda_items": []
    }
    
    # 处理议程项...
    for item in db_meeting.agenda_items:
        # 处理议程项数据...
        agenda_item = {
            "title": item.title,
            "position": item.position,
            # 其他字段...
        }
        response_data["agenda_items"].append(agenda_item)
    
    # 获取活跃节点
    active_nodes = await get_active_nodes()
    
    # 选择最佳节点
    selected_node = await select_node(active_nodes, meeting_id)
    
    # 构建下载URL
    if selected_node:
        base_url = f"http://{selected_node.ip}:{selected_node.port}"
        download_url = f"{base_url}/api/v1/meetings/{meeting_id}/download-package"
    else:
        # 如果没有可用节点，使用主服务器URL
        download_url = f"{BASE_URL}/api/v1/meetings/{meeting_id}/download-package"
    
    # 添加下载URL到响应
    response_data["download_url"] = download_url
    
    return response_data
```

#### 4. 提供节点同步接口

```python
@app.get("/api/v1/sync/meetings/{meeting_id}")
async def sync_meeting_data(
    meeting_id: str, 
    request: Request,
    node_id: str,
    api_key: str,
    db: Session = Depends(get_db)
):
    """提供给文件服务节点同步会议数据的接口"""
    # 验证API密钥
    if not verify_api_key(api_key):
        raise HTTPException(status_code=403, detail="Invalid API key")
    
    # 验证节点是否注册
    if node_id not in nodes_registry:
        raise HTTPException(status_code=403, detail="Node not registered")
    
    # 获取会议数据
    db_meeting = crud.get_meeting(db, meeting_id=meeting_id)
    if not db_meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # 构建会议数据响应
    sync_data = {
        "id": db_meeting.id,
        "title": db_meeting.title,
        "time": db_meeting.time,
        "status": db_meeting.status,
        "files": []
    }
    
    # 获取会议相关文件
    meeting_files = await get_meeting_files(db, meeting_id)
    for file in meeting_files:
        file_data = {
            "id": file.id,
            "path": file.path,
            "size": file.size,
            "content_type": file.content_type,
            "url": f"{BASE_URL}/uploads/{file.path}"
        }
        sync_data["files"].append(file_data)
    
    # 更新节点同步状态
    node = nodes_registry[node_id]
    # 记录同步状态
    
    return sync_data

async def get_meeting_files(db: Session, meeting_id: str):
    """获取会议相关的所有文件"""
    # 实现获取会议相关文件的逻辑
    # 可能需要从议程项中收集文件信息
    # ...
```

### 分布式文件服务节点实现

#### 1. 节点基本结构

```python
import os
import asyncio
import aiohttp
import logging
import time
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
import uvicorn

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("file_node")

app = FastAPI(title="会议文件服务节点")

# 节点配置
NODE_ID = os.getenv("NODE_ID", str(uuid.uuid4()))
NODE_IP = os.getenv("NODE_IP", "127.0.0.1")
NODE_PORT = int(os.getenv("NODE_PORT", 8001))
MAIN_SERVER_URL = os.getenv("MAIN_SERVER_URL", "http://127.0.0.1:8000")
API_KEY = os.getenv("API_KEY", "your-api-key")
STORAGE_PATH = os.getenv("STORAGE_PATH", "./storage")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", 30))  # 同步间隔(秒)

# 确保存储目录存在
os.makedirs(os.path.join(STORAGE_PATH, "meetings"), exist_ok=True)
```

#### 2. 节点注册和心跳机制

```python
async def register_node():
    """向主服务器注册节点"""
    try:
        # 获取存储容量信息
        import shutil
        total, used, free = shutil.disk_usage(STORAGE_PATH)
        
        async with aiohttp.ClientSession() as session:
            url = f"{MAIN_SERVER_URL}/api/v1/nodes/register"
            data = {
                "id": NODE_ID,
                "ip": NODE_IP,
                "port": NODE_PORT,
                "storage_capacity": total,
                "storage_used": used
            }
            
            async with session.post(url, json=data) as response:
                if response.status == 200:
                    result = await response.json()
                    logger.info(f"节点注册成功: {result}")
                    if "id" in result:
                        global NODE_ID
                        NODE_ID = result["id"]
                    return True
                else:
                    error = await response.text()
                    logger.error(f"节点注册失败: {response.status} - {error}")
                    return False
    except Exception as e:
        logger.error(f"节点注册出错: {str(e)}")
        return False

async def send_heartbeat():
    """定期向主服务器发送心跳"""
    while True:
        try:
            # 获取存储使用情况
            import shutil
            total, used, free = shutil.disk_usage(STORAGE_PATH)
            
            # 计算健康度指标
            health = calculate_node_health()
            
            async with aiohttp.ClientSession() as session:
                url = f"{MAIN_SERVER_URL}/api/v1/nodes/{NODE_ID}/heartbeat"
                data = {
                    "health": health,
                    "status": "active",
                    "storage_used": used
                }
                
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        logger.debug("心跳发送成功")
                    else:
                        error = await response.text()
                        logger.warning(f"心跳发送失败: {response.status} - {error}")
                        
                        # 如果是404，尝试重新注册
                        if response.status == 404:
                            await register_node()
        except Exception as e:
            logger.error(f"发送心跳出错: {str(e)}")
        
        # 等待下一次心跳
        await asyncio.sleep(15)  # 15秒一次心跳

def calculate_node_health():
    """计算节点健康度"""
    # 示例实现，可基于CPU使用率、内存使用率、磁盘I/O等指标
    try:
        import psutil
        # CPU使用率 (0-100)
        cpu_percent = psutil.cpu_percent(interval=1)
        # 内存使用率 (0-100)
        memory_percent = psutil.virtual_memory().percent
        
        # 简单加权计算，CPU和内存各占50%
        # 健康度为1.0(最佳)到0.0(最差)
        health = 1.0 - ((cpu_percent / 200) + (memory_percent / 200))
        return max(0.1, min(1.0, health))  # 确保在0.1-1.0范围内
    except Exception:
        # 如果无法获取系统指标，返回默认值
        return 0.8
```

#### 3. 同步机制实现

```python
async def sync_meetings():
    """从主服务器同步会议数据"""
    while True:
        try:
            # 获取活跃会议
            active_meetings = await get_active_meetings()
            
            if active_meetings:
                for meeting_id in active_meetings:
                    # 检查本地是否已有该会议数据
                    meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
                    if not os.path.exists(meeting_path) or is_meeting_outdated(meeting_id):
                        # 同步会议数据
                        await sync_meeting_data(meeting_id)
            
            logger.info(f"会议同步完成，共同步 {len(active_meetings)} 个会议")
        except Exception as e:
            logger.error(f"同步会议出错: {str(e)}")
        
        # 等待下一次同步
        await asyncio.sleep(SYNC_INTERVAL)

async def get_active_meetings():
    """获取活跃会议列表"""
    try:
        async with aiohttp.ClientSession() as session:
            url = f"{MAIN_SERVER_URL}/api/v1/meetings/active"
            headers = {"Authorization": f"Bearer {API_KEY}"}
            
            async with session.get(url, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    return [meeting["id"] for meeting in result.get("meetings", [])]
                else:
                    logger.error(f"获取活跃会议失败: {response.status}")
                    return []
    except Exception as e:
        logger.error(f"获取活跃会议出错: {str(e)}")
        return []

async def sync_meeting_data(meeting_id):
    """同步特定会议的数据"""
    try:
        logger.info(f"开始同步会议 {meeting_id} 数据")
        
        async with aiohttp.ClientSession() as session:
            url = f"{MAIN_SERVER_URL}/api/v1/sync/meetings/{meeting_id}"
            params = {"node_id": NODE_ID, "api_key": API_KEY}
            
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    meeting_data = await response.json()
                    
                    # 创建会议目录
                    meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
                    os.makedirs(meeting_path, exist_ok=True)
                    
                    # 保存会议元数据
                    with open(os.path.join(meeting_path, "metadata.json"), "w") as f:
                        import json
                        json.dump(meeting_data, f, ensure_ascii=False, indent=2)
                    
                    # 同步会议文件
                    await sync_meeting_files(meeting_id, meeting_data.get("files", []))
                    
                    # 生成会议包（如果需要）
                    await generate_meeting_package(meeting_id)
                    
                    logger.info(f"会议 {meeting_id} 数据同步完成")
                    return True
                else:
                    logger.error(f"同步会议 {meeting_id} 数据失败: {response.status}")
                    return False
    except Exception as e:
        logger.error(f"同步会议 {meeting_id} 数据出错: {str(e)}")
        return False

async def sync_meeting_files(meeting_id, files):
    """同步会议文件"""
    meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
    files_path = os.path.join(meeting_path, "files")
    os.makedirs(files_path, exist_ok=True)
    
    for file_info in files:
        try:
            file_id = file_info.get("id")
            file_url = file_info.get("url")
            file_name = os.path.basename(file_info.get("path", ""))
            
            # 目标文件路径
            target_path = os.path.join(files_path, file_name)
            
            # 检查文件是否已存在且大小相同
            if os.path.exists(target_path) and os.path.getsize(target_path) == file_info.get("size"):
                logger.debug(f"文件已存在且完整，跳过: {file_name}")
                continue
                
            # 下载文件
            await download_file(file_url, target_path)
            logger.info(f"文件同步完成: {file_name}")
        except Exception as e:
            logger.error(f"同步文件出错: {str(e)}")

async def download_file(url, target_path):
    """下载文件到指定路径"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    # 创建临时文件
                    temp_path = f"{target_path}.temp"
                    with open(temp_path, "wb") as f:
                        # 分块下载
                        chunk_size = 1024 * 1024  # 1MB
                        async for chunk in response.content.iter_chunked(chunk_size):
                            f.write(chunk)
                    
                    # 下载完成后重命名
                    import os
                    if os.path.exists(target_path):
                        os.remove(target_path)
                    os.rename(temp_path, target_path)
                    return True
                else:
                    logger.error(f"下载文件失败: {response.status}")
                    return False
    except Exception as e:
        logger.error(f"下载文件出错: {str(e)}")
        return False

async def generate_meeting_package(meeting_id):
    """生成会议包"""
    try:
        meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
        files_path = os.path.join(meeting_path, "files")
        package_path = os.path.join(meeting_path, "package.zip")
        
        # 检查是否已有会议包
        if os.path.exists(package_path):
            # 检查会议包是否需要更新（比如检查修改时间）
            if not is_package_outdated(meeting_id):
                logger.debug(f"会议 {meeting_id} 的会议包已存在且是最新的")
                return True
        
        # 创建ZIP包
        import zipfile
        with zipfile.ZipFile(package_path, "w") as zipf:
            # 添加元数据
            metadata_path = os.path.join(meeting_path, "metadata.json")
            if os.path.exists(metadata_path):
                zipf.write(metadata_path, "metadata.json")
            
            # 添加所有文件
            for root, _, files in os.walk(files_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.join("files", file)
                    zipf.write(file_path, arcname)
        
        logger.info(f"会议包生成完成: {package_path}")
        return True
    except Exception as e:
        logger.error(f"生成会议包出错: {str(e)}")
        return False

def is_meeting_outdated(meeting_id):
    """检查会议数据是否过期"""
    try:
        meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
        metadata_path = os.path.join(meeting_path, "metadata.json")
        
        if not os.path.exists(metadata_path):
            return True
        
        # 获取元数据文件的修改时间
        mod_time = os.path.getmtime(metadata_path)
        current_time = time.time()
        
        # 如果元数据超过30分钟未更新，认为过期
        return (current_time - mod_time) > (30 * 60)
    except Exception:
        # 如果无法判断，默认为过期
        return True

def is_package_outdated(meeting_id):
    """检查会议包是否过期"""
    try:
        meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
        metadata_path = os.path.join(meeting_path, "metadata.json")
        package_path = os.path.join(meeting_path, "package.zip")
        
        if not os.path.exists(package_path):
            return True
        
        if not os.path.exists(metadata_path):
            return False
        
        # 如果元数据比会议包新，则会议包过期
        return os.path.getmtime(metadata_path) > os.path.getmtime(package_path)
    except Exception:
        # 如果无法判断，默认为过期
        return True
```

#### 4. 提供文件下载API

```python
@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """提供会议包下载"""
    package_path = os.path.join(STORAGE_PATH, "meetings", meeting_id, "package.zip")
    
    # 检查会议包是否存在
    if not os.path.exists(package_path):
        # 先尝试同步
        synced = await sync_meeting_data(meeting_id)
        if not synced or not os.path.exists(package_path):
            raise HTTPException(status_code=404, detail="Meeting package not found")
    
    return FileResponse(
        path=package_path,
        filename=f"meeting_{meeting_id}.zip",
        media_type="application/zip"
    )

@app.get("/api/v1/node/meetings/{meeting_id}/status")
async def check_meeting_status(meeting_id: str):
    """检查节点是否有指定会议的数据"""
    meeting_path = os.path.join(STORAGE_PATH, "meetings", meeting_id)
    package_path = os.path.join(meeting_path, "package.zip")
    
    exists = os.path.exists(package_path)
    outdated = False
    
    if exists:
        outdated = is_package_outdated(meeting_id)
    
    return {
        "exists": exists,
        "outdated": outdated,
        "size": os.path.getsize(package_path) if exists else 0
    }

@app.get("/api/v1/node/status")
async def node_status():
    """获取节点状态"""
    try:
        import shutil
        import psutil
        
        storage_path = STORAGE_PATH
        total, used, free = shutil.disk_usage(storage_path)
        
        # 统计会议数量
        meetings_path = os.path.join(STORAGE_PATH, "meetings")
        meeting_count = len([d for d in os.listdir(meetings_path) 
                          if os.path.isdir(os.path.join(meetings_path, d))])
        
        return {
            "id": NODE_ID,
            "ip": NODE_IP,
            "port": NODE_PORT,
            "status": "active",
            "health": calculate_node_health(),
            "storage": {
                "total": total,
                "used": used,
                "free": free,
                "percent_used": (used / total * 100) if total > 0 else 0
            },
            "meetings": {
                "count": meeting_count
            },
            "system": {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent
            },
            "uptime": time.time() - START_TIME
        }
    except Exception as e:
        logger.error(f"获取节点状态出错: {str(e)}")
        return {"status": "error", "message": str(e)}
```

#### 5. 启动文件服务节点

```python
# 启动时记录时间
START_TIME = time.time()

@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 注册节点
    success = await register_node()
    if not success:
        logger.warning("节点注册失败，将在心跳中重试")
    
    # 启动心跳任务
    asyncio.create_task(send_heartbeat())
    
    # 启动同步任务
    asyncio.create_task(sync_meetings())
    
    logger.info(f"文件服务节点已启动 [ID: {NODE_ID}]")

if __name__ == "__main__":
    uvicorn.run(
        "main:app", 
        host=NODE_IP, 
        port=NODE_PORT,
        reload=False
    )
```

## 数据流程

### 会议创建/更新流程

1. 主控服务器接收会议创建/更新请求
2. 主控服务器将会议数据写入数据库
3. 分布式文件服务节点通过定期轮询获取会议状态变更
4. 发现新会议或会议更新后，分布式节点从主控服务器同步会议数据
5. 分布式节点下载会议相关文件并生成会议包

### 会议数据获取流程

1. 前端向主控服务器请求会议数据
2. 主控服务器从数据库获取会议信息，包括议程项和文件列表
3. 主控服务器选择最佳的分布式节点提供下载服务
4. 主控服务器返回包含分布式节点下载链接的会议数据
5. 前端使用该链接从分布式节点下载会议包

### 节点管理流程

1. 分布式节点启动时向主控服务器注册
2. 分布式节点定期发送心跳包更新状态
3. 主控服务器根据心跳信息维护节点注册表
4. 如果节点超过一定时间未发送心跳，标记为不可用
5. 负载均衡算法根据节点状态、负载和网络情况选择最佳节点

## 部署方案

### 部署架构

```
+-----------------+
|  负载均衡器/CDN  |
+-----------------+
        |
+-------------------+
|                   |
|   主控服务器       |
|                   |
+-------------------+
        |
+-------------------+
|                   |
|    数据库服务     |
|                   |
+-------------------+
        |
+-------+-------+-------+
|       |       |       |
| 文件  | 文件  | 文件  |
| 节点1 | 节点2 | 节点3 |
|       |       |       |
+-------+-------+-------+
```

### 部署步骤

1. **主控服务器部署**
   - 准备FastAPI应用环境
   - 配置数据库连接
   - 配置分布式节点参数
   - 启动主控服务

2. **分布式文件服务节点部署**
   - 准备FastAPI应用环境
   - 配置节点参数（ID、IP、端口等）
   - 配置主控服务器连接信息
   - 创建文件存储目录
   - 启动文件服务节点

3. **负载均衡配置**
   - 配置前端访问主控服务器的负载均衡
   - 确保会话一致性

### 环境变量配置

#### 主控服务器

```
# 基本配置
PORT=8000
HOST=0.0.0.0
DATABASE_URL=sqlite:///./meetings.db

# 节点管理配置
NODE_HEARTBEAT_TIMEOUT=60
API_KEY=your-secure-api-key

# 路径配置
UPLOAD_DIR=./uploads
BASE_URL=http://example.com
```

#### 文件服务节点

```
# 节点身份
NODE_ID=node-1
NODE_IP=192.168.1.10
NODE_PORT=8001

# 主控服务器连接
MAIN_SERVER_URL=http://main-server:8000
API_KEY=your-secure-api-key

# 存储配置
STORAGE_PATH=./storage
SYNC_INTERVAL=30
```

## 测试策略

1. **单元测试**
   - 测试负载均衡算法
   - 测试节点选择逻辑
   - 测试同步过程中的各个组件

2. **集成测试**
   - 测试主控服务器与文件服务节点的通信
   - 测试会议数据同步完整性
   - 测试文件下载流程

3. **性能测试**
   - 测试高并发下载性能
   - 测试多节点负载均衡效果
   - 测试大文件下载性能

4. **故障恢复测试**
   - 测试节点故障时的自动切换
   - 测试主控服务器故障恢复
   - 测试网络中断后的断点续传

## 实施计划

### 阶段1：基础架构实现（2周）

1. 实现主控服务器节点管理功能
2. 实现分布式文件服务节点基本功能
3. 建立节点注册和心跳机制
4. 编写基本测试用例

### 阶段2：数据同步功能（2周）

1. 实现会议数据同步接口
2. 实现文件同步功能
3. 实现会议包生成功能
4. 测试同步功能

### 阶段3：负载均衡与优化（1周）

1. 实现负载均衡算法
2. 优化文件传输性能
3. 实现断点续传功能
4. 进行性能测试和优化

### 阶段4：集成与测试（1周）

1. 与前端集成
2. 进行端到端测试
3. 修复缺陷
4. 编写部署文档

### 阶段5：部署与监控（1周）

1. 部署到测试环境
2. 搭建监控系统
3. 进行压力测试
4. 编写运维文档 