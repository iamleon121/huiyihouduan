# 分布式文件服务器架构设计

## 目录

1. [架构概述](#架构概述)
2. [设计目标](#设计目标)
3. [系统组件](#系统组件)
4. [工作流程](#工作流程)
5. [实现细节](#实现细节)
6. [部署建议](#部署建议)
7. [安全考虑](#安全考虑)
8. [性能优化](#性能优化)
9. [扩展性](#扩展性)

## 架构概述

无纸化会议系统的分布式文件服务架构采用"中心辐射型"设计模式，由一个主控服务器和多个分布式文件服务节点组成。这种架构将文件存储和分发功能从主控服务器分离出来，提高了系统的可扩展性和性能。

在这种架构中：
- **主控服务器**作为中央数据管理和API入口点
- **分布式文件服务节点**负责文件存储和提供下载服务
- **前端客户端**只与主控服务器交互获取会议信息，但可以从分布式节点下载文件

## 设计目标

1. **提高系统可用性**：通过分布式部署减少单点故障风险
2. **优化下载性能**：将文件下载负载分散到多个服务节点
3. **简化前端逻辑**：前端只需连接到单一API端点，无需处理多服务器逻辑
4. **灵活的扩展能力**：可以根据需求动态增加或减少文件服务节点
5. **数据一致性**：确保所有节点提供一致的文件内容

## 系统组件

### 1. 主控服务器

主控服务器是系统的核心，负责：

- 提供会议管理API接口
- 存储会议元数据和状态信息
- 生成包含分布式节点下载链接的响应
- 为分布式节点提供同步接口

### 2. 分布式文件服务节点

分布式文件服务节点负责：

- 定期从主控服务器同步会议数据
- 存储会议相关文件
- 提供文件下载服务
- 监控自身状态并向主控服务器报告

### 3. 前端客户端

前端客户端：

- 只与主控服务器API交互获取会议信息
- 根据主控服务器提供的链接从分布式节点下载文件
- 无需关心多服务器下载逻辑

## 工作流程

### 1. 数据同步流程

1. 分布式节点定期轮询主控服务器获取当前活跃会议ID
2. 当检测到会议状态变更时，分布式节点从主控服务器同步会议数据和文件
3. 分布式节点将同步状态报告给主控服务器

### 2. 文件下载流程

1. 前端向主控服务器请求会议数据
2. 主控服务器在响应中包含指向分布式节点的文件下载链接
3. 前端使用这些链接直接从分布式节点下载文件

### 3. 节点管理流程

1. 主控服务器维护分布式节点列表及其状态
2. 分布式节点定期向主控服务器发送心跳信息
3. 主控服务器根据节点状态动态调整文件下载链接的分配

## 实现细节

### 1. 主控服务器实现

主控服务器需要实现两个关键功能：

#### A. 提供会议数据API，但下载链接指向分布式节点

```python
@app.get("/api/v1/meetings/{meeting_id}/data")
async def get_meeting_data(meeting_id: str):
    # 获取会议数据
    meeting_data = await get_meeting_from_database(meeting_id)
    
    # 获取可用的分布式节点
    available_nodes = await get_available_nodes()
    
    if not available_nodes:
        # 如果没有可用节点，使用主控端自身的下载链接
        download_url = f"{BASE_URL}/api/v1/meetings/{meeting_id}/download-package"
    else:
        # 选择一个分布式节点（可以实现负载均衡算法）
        selected_node = select_node(available_nodes)
        download_url = f"http://{selected_node}/api/v1/meetings/{meeting_id}/download-package"
    
    # 在会议数据中添加下载链接
    meeting_data["download_url"] = download_url
    
    return meeting_data
```

#### B. 提供分布式节点同步接口

```python
@app.get("/api/v1/sync/meetings/{meeting_id}")
async def sync_meeting_data(meeting_id: str, request: Request):
    # 验证请求来源是否为授权的分布式节点
    client_ip = request.client.host
    if client_ip not in AUTHORIZED_NODES:
        raise HTTPException(status_code=403, detail="Unauthorized sync attempt")
    
    # 获取完整的会议数据（包括文件）
    meeting_data = await get_complete_meeting_data(meeting_id)
    
    return meeting_data
```

### 2. 分布式服务器实现

分布式服务器需要实现两个主要功能：

#### A. 定期从主控端同步数据

```python
async def sync_meeting_data():
    while True:
        try:
            # 获取当前活跃会议ID
            active_meeting = await get_active_meeting_id()
            
            if active_meeting:
                # 从主控端同步会议数据
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{MAIN_SERVER_URL}/api/v1/sync/meetings/{active_meeting}",
                        headers={"Authorization": f"Bearer {API_KEY}"}
                    ) as response:
                        if response.status == 200:
                            meeting_data = await response.json()
                            # 保存会议数据和文件
                            await save_meeting_data(meeting_data)
                            logger.info(f"Successfully synced meeting {active_meeting}")
                        else:
                            logger.error(f"Failed to sync meeting: HTTP {response.status}")
            
            # 等待下一次同步
            await asyncio.sleep(SYNC_INTERVAL)
        except Exception as e:
            logger.error(f"Sync error: {str(e)}")
            await asyncio.sleep(ERROR_RETRY_INTERVAL)
```

#### B. 提供与主控端兼容的下载API

```python
@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    # 检查本地是否有会议包
    package_path = f"storage/meetings/{meeting_id}/package.zip"
    
    if not os.path.exists(package_path):
        # 如果本地没有，尝试从主控端同步
        success = await sync_specific_meeting(meeting_id)
        if not success:
            raise HTTPException(status_code=404, detail="Meeting package not found")
    
    # 提供文件下载
    return FileResponse(
        path=package_path,
        filename=f"meeting_{meeting_id}.zip",
        media_type="application/zip"
    )
```

## 部署建议

### 1. 节点部署策略

- **地理分布**：在不同地理位置部署分布式节点，提高下载速度和可用性
- **资源分配**：根据预期负载为节点分配适当的资源
- **网络连接**：确保节点之间和节点与主控服务器之间有可靠的网络连接

### 2. 扩展策略

- **水平扩展**：根据需求增加更多分布式节点
- **负载监控**：监控节点负载，动态调整资源分配
- **自动扩缩容**：在云环境中实现自动扩缩容

## 安全考虑

### 1. 节点认证

- 实现节点间的双向认证
- 使用API密钥或JWT令牌进行身份验证
- 限制IP访问，只允许授权节点进行同步

### 2. 数据安全

- 实现数据传输加密（HTTPS）
- 考虑文件内容加密
- 实现访问控制和权限管理

### 3. 监控与审计

- 记录所有同步和下载操作
- 实现异常检测和告警机制
- 定期安全审计

## 性能优化

### 1. 缓存策略

- 在分布式节点上实现文件缓存
- 使用CDN加速静态文件分发
- 实现智能缓存失效策略

### 2. 负载均衡

- 实现智能负载均衡算法
- 考虑节点地理位置、负载和网络状况
- 支持会话亲和性（Session Affinity）

### 3. 文件传输优化

- 实现文件压缩
- 支持断点续传
- 考虑使用更高效的传输协议

## 扩展性

### 1. 支持更多文件类型

- 扩展系统以支持更多文件格式
- 实现特定文件类型的处理逻辑

### 2. 集成第三方存储

- 支持与云存储服务集成
- 实现混合存储策略

### 3. 高级功能

- 实现文件版本控制
- 支持文件差异同步
- 添加文件访问统计和分析功能
