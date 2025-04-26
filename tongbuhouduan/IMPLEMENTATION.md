# 分布式文件服务节点实现指南

## 目录

1. [实现背景](#实现背景)
2. [设计目标](#设计目标)
3. [技术方案](#技术方案)
4. [代码实现](#代码实现)
5. [部署配置](#部署配置)
6. [测试验证](#测试验证)
7. [常见问题](#常见问题)

## 实现背景

无纸化会议系统的前端客户端需要从服务器下载会议文件包。随着系统使用规模的扩大，单一服务器的下载能力成为瓶颈，影响用户体验。为了解决这个问题，我们设计了分布式文件服务节点，将文件下载负载分散到多个节点，提高系统整体性能和可用性。

### 现有系统分析

1. **前端下载流程**：
   - 前端通过轮询`/api/v1/meetings/status/token`获取会议状态
   - 当检测到会议状态变化时，获取会议数据`/api/v1/meetings/{meeting_id}/data`
   - 使用硬编码的URL模式`/api/v1/meetings/{meeting_id}/download-package`下载文件

2. **存在的问题**：
   - 所有下载请求都发送到主控服务器，造成负载集中
   - 主控服务器需要处理大量的文件I/O和网络I/O
   - 单点故障风险高，可扩展性差

## 设计目标

1. **减轻主控服务器负载**：将文件下载任务分散到多个分布式节点
2. **保持前端兼容性**：不修改前端代码，保持现有的API调用方式
3. **提高系统可用性**：通过多节点部署减少单点故障风险
4. **简化部署和管理**：节点可以独立部署和管理，支持动态扩展

## 技术方案

### 整体架构

采用"中心辐射型"架构，由一个主控服务器和多个分布式文件服务节点组成：

```
┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │
│  主控服务器     │◄────►│  分布式节点1    │
│                 │      │                 │
└───────┬─────────┘      └─────────────────┘
        │
        │               ┌─────────────────┐
        │               │                 │
        └──────────────►│  分布式节点2    │
                        │                 │
                        └─────────────────┘
```

### 工作流程

1. **节点注册**：分布式节点启动时向主控服务器注册
2. **会议同步**：分布式节点定期从主控服务器同步会议状态和文件
3. **下载重定向**：主控服务器通过HTTP重定向将下载请求转发到分布式节点
4. **文件服务**：分布式节点直接向前端提供文件下载服务

### 关键技术

1. **HTTP重定向**：使用HTTP 302重定向，将前端的下载请求重定向到分布式节点
2. **异步编程**：使用`asyncio`和`aiohttp`实现高效的网络操作
3. **节点管理**：实现节点注册、健康检查和负载均衡
4. **文件同步**：定期从主控服务器同步会议文件

## 代码实现

### 主要文件

1. **main.py**：主程序入口，实现FastAPI应用和核心功能
2. **start.py**：启动脚本，处理命令行参数和环境变量

### 核心功能实现

#### 1. 节点注册

```python
async def register_node():
    """向主控服务器注册节点"""
    try:
        session = await get_http_session()
        node_info = {
            "node_id": NODE_ID,
            "address": os.getenv("NODE_ADDRESS", "localhost:8001"),
            "status": "online"
        }
        async with session.post(f"{MAIN_SERVER_URL}/api/v1/nodes/register", json=node_info) as response:
            if response.status == 200:
                logger.info("节点注册成功")
                return True
            else:
                logger.error(f"节点注册失败: HTTP {response.status}")
                return False
    except Exception as e:
        logger.error(f"节点注册出错: {str(e)}")
        return False
```

#### 2. 会议状态获取

```python
async def get_meeting_status():
    """从主控服务器获取会议状态"""
    try:
        session = await get_http_session()
        async with session.get(f"{MAIN_SERVER_URL}/api/v1/meetings/status/token") as response:
            if response.status == 200:
                return await response.json()
            else:
                logger.error(f"获取会议状态失败: HTTP {response.status}")
                return None
    except Exception as e:
        logger.error(f"获取会议状态出错: {str(e)}")
        return None
```

#### 3. 会议文件同步

```python
async def sync_meeting_data(meeting_id):
    """同步指定会议的数据"""
    try:
        logger.info(f"开始同步会议数据: {meeting_id}")
        
        # 创建会议目录
        meeting_dir = os.path.join(STORAGE_PATH, "meeting_files", meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        
        # 获取会议包
        package_path = os.path.join(meeting_dir, "package.zip")
        
        # 从主控服务器下载会议包
        session = await get_http_session()
        async with session.get(f"{MAIN_SERVER_URL}/api/v1/meetings/{meeting_id}/download-package-direct") as response:
            if response.status == 200:
                # 读取响应内容
                content = await response.read()
                
                # 保存到文件
                with open(package_path, "wb") as f:
                    f.write(content)
                
                logger.info(f"会议 {meeting_id} 同步完成，包大小: {len(content)} 字节")
                return True
            else:
                logger.error(f"下载会议包失败: HTTP {response.status}")
                return False
    except Exception as e:
        logger.error(f"同步会议数据出错: {str(e)}")
        return False
```

#### 4. 文件下载API

```python
@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """提供会议包下载，与主控服务器API兼容"""
    # 构建本地存储路径
    package_path = os.path.join(STORAGE_PATH, "meeting_files", meeting_id, "package.zip")
    
    # 检查会议包是否存在
    if not os.path.exists(package_path):
        # 如果本地没有，尝试从主控服务器同步
        synced = await sync_meeting_data(meeting_id)
        if not synced or not os.path.exists(package_path):
            raise HTTPException(status_code=404, detail="Meeting package not found")
    
    # 提供文件下载
    return FileResponse(
        path=package_path,
        filename=f"meeting_{meeting_id}.zip",
        media_type="application/zip"
    )
```

#### 5. 健康检查API

```python
@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "node_id": NODE_ID,
        "timestamp": time.time(),
        "main_server": MAIN_SERVER_URL,
        "storage_path": STORAGE_PATH,
        "sync_interval": SYNC_INTERVAL
    }
```

### 主控服务器修改

主控服务器需要添加以下功能：

#### 1. 节点管理API

```python
# 节点注册表
nodes_registry = {}

@router.post("/nodes/register")
async def register_node(node_info: dict):
    """注册分布式节点"""
    node_id = node_info.get("node_id")
    address = node_info.get("address")
    
    if not node_id or not address:
        raise HTTPException(status_code=400, detail="Missing node_id or address")
    
    # 添加到注册表
    nodes_registry[node_id] = {
        "address": address,
        "status": "online",
        "last_seen": time.time()
    }
    
    return {"status": "success", "message": f"Node {node_id} registered"}
```

#### 2. 下载重定向API

```python
from fastapi.responses import RedirectResponse

@router.get("/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """下载会议包，如果有可用节点则重定向到节点"""
    # 获取可用的分布式节点
    available_nodes = await get_available_nodes()
    
    if available_nodes:
        # 选择一个分布式节点
        selected_node = select_node(available_nodes)
        node_url = f"http://{selected_node}/api/v1/meetings/{meeting_id}/download-package"
        
        # 返回重定向响应
        return RedirectResponse(url=node_url)
    else:
        # 如果没有可用节点，使用本地文件
        return await download_local_package(meeting_id)
```

## 部署配置

### 环境要求

- Python 3.7+
- FastAPI 0.68.0+
- uvicorn 0.15.0+
- aiohttp 3.8.1+

### 依赖安装

```bash
pip install fastapi uvicorn aiohttp
```

### 配置选项

分布式节点支持以下配置选项：

| 选项 | 环境变量 | 命令行参数 | 默认值 | 说明 |
|------|----------|------------|--------|------|
| 主控服务器URL | MAIN_SERVER_URL | --main-server | http://127.0.0.1:8000 | 主控服务器的URL |
| 节点对外地址 | NODE_ADDRESS | --node-address | localhost:8001 | 节点的对外访问地址 |
| 存储路径 | STORAGE_PATH | --storage-path | ./storage | 文件存储路径 |
| 同步间隔 | SYNC_INTERVAL | --sync-interval | 300 | 同步间隔(秒) |
| 节点ID | NODE_ID | --node-id | 自动生成 | 节点的唯一标识 |

### 启动命令

```bash
python start.py --host 0.0.0.0 --port 8001 --main-server http://主控服务器IP:8000 --node-address 节点IP:8001
```

## 测试验证

### 功能测试

1. **节点注册测试**：
   ```bash
   # 启动节点后，检查主控服务器的节点列表
   curl http://主控服务器IP:8000/api/v1/nodes/list
   ```

2. **健康检查测试**：
   ```bash
   # 检查节点健康状态
   curl http://节点IP:8001/health
   ```

3. **下载重定向测试**：
   ```bash
   # 使用浏览器或curl测试下载重定向
   curl -v http://主控服务器IP:8000/api/v1/meetings/{meeting_id}/download-package
   ```

### 性能测试

1. **单节点性能测试**：
   - 测试单个节点的最大并发下载能力
   - 测试不同文件大小的下载性能

2. **多节点性能测试**：
   - 测试多个节点的负载均衡效果
   - 测试节点故障时的自动切换

### 兼容性测试

1. **前端兼容性测试**：
   - 确认前端能正常下载文件
   - 验证下载进度显示正常

2. **API兼容性测试**：
   - 确认API响应格式与主控服务器一致
   - 验证错误处理机制正常工作

## 常见问题

### 1. 节点无法连接到主控服务器

**问题**：节点启动后无法连接到主控服务器，日志显示连接错误。

**解决方案**：
- 检查主控服务器URL是否正确
- 确认网络连接是否正常
- 检查主控服务器是否在运行
- 检查防火墙设置是否允许连接

### 2. 文件同步失败

**问题**：节点无法从主控服务器同步文件，日志显示下载失败。

**解决方案**：
- 检查主控服务器的下载API是否可用
- 确认存储目录是否有写入权限
- 检查磁盘空间是否充足
- 验证会议ID是否正确

### 3. 下载重定向不生效

**问题**：主控服务器的下载重定向不生效，前端仍然从主控服务器下载文件。

**解决方案**：
- 确认主控服务器的重定向API正确实现
- 检查前端是否支持HTTP重定向
- 验证节点地址是否正确配置
- 检查节点是否已在主控服务器注册

### 4. 性能问题

**问题**：分布式节点的下载性能不如预期。

**解决方案**：
- 增加节点的硬件资源（CPU、内存、网络带宽）
- 优化文件存储方式，考虑使用SSD
- 调整同步策略，减少不必要的同步
- 实现文件缓存机制，减少磁盘I/O
