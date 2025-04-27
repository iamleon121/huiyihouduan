"""
分布式文件服务节点主程序

此程序实现了分布式文件服务节点的核心功能，包括：
1. 与主控服务器通信
2. 文件同步
3. 文件下载服务
4. 健康检查
"""
import os
import asyncio
import aiohttp
import logging
import logging.handlers
import time
import socket
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 导入配置模块
from config import (
    load_config, save_config, get_main_server_url,
    get_storage_config, get_network_config, get_logging_config, get_heartbeat_config
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("file_node")

# 使用lifespan上下文管理器替代on_event
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用生命周期管理

    参数 _ 是FastAPI实例，但在此函数中不使用，使用下划线避免未使用变量的警告。
    """
    # 应用启动时执行
    # 初始化配置
    init_config()

    # 初始化存储目录
    init_storage()

    # 启动心跳任务
    asyncio.create_task(send_heartbeat())

    # 启动同步任务
    asyncio.create_task(sync_meetings())

    # 自动注册节点
    asyncio.create_task(register_node())

    logger.info(f"文件服务节点已启动 [ID: {NODE_ID}]")

    yield  # 这里是应用运行期间

    # 应用关闭时执行
    # 关闭HTTP会话
    await close_http_session()

    # 如果服务正在运行，从主控服务器注销节点
    if service_running:
        await unregister_node()

    logger.info("文件服务节点已关闭")

# 创建FastAPI应用
app = FastAPI(title="分布式文件服务节点", lifespan=lifespan)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
config = None
NODE_ID = None
MAIN_SERVER_URL = None
SYNC_INTERVAL = None
STORAGE_PATH = "./storage"
service_running = True  # 默认服务启动
start_time = time.time()  # 设置启动时间
http_session = None
last_sync_time = None
last_sync_status = "未同步"
active_meetings = []  # 当前活动的会议列表
last_meeting_token = None  # 上次同步的会议状态识别码

# 初始化配置
def init_config():
    """初始化配置"""
    global config, NODE_ID, MAIN_SERVER_URL, SYNC_INTERVAL, STORAGE_PATH

    # 加载配置
    config = load_config()

    # 设置全局变量
    NODE_ID = config["nodeId"]
    MAIN_SERVER_URL = get_main_server_url(config)
    SYNC_INTERVAL = config["syncInterval"]

    # 获取存储配置
    storage_config = get_storage_config(config)
    STORAGE_PATH = storage_config["path"]

    # 获取网络配置
    # 网络配置将在需要时获取

    # 获取日志配置
    logging_config = get_logging_config(config)
    # 设置日志级别
    logger.setLevel(getattr(logging, logging_config["level"]))
    # 如果启用了文件日志，添加文件处理器
    if logging_config["fileEnabled"]:
        # 确保日志目录存在
        log_dir = os.path.dirname(logging_config["filePath"])
        os.makedirs(log_dir, exist_ok=True)
        # 创建文件处理器
        file_handler = logging.handlers.RotatingFileHandler(
            logging_config["filePath"],
            maxBytes=logging_config["maxFileSize"],
            backupCount=logging_config["backupCount"]
        )
        file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(file_handler)

    # 获取心跳配置
    heartbeat_config = get_heartbeat_config(config)

    logger.info(f"节点ID: {NODE_ID}")
    logger.info(f"主控服务器: {MAIN_SERVER_URL}")
    logger.info(f"同步间隔: {SYNC_INTERVAL}秒")
    logger.info(f"存储路径: {STORAGE_PATH}")
    logger.info(f"心跳间隔: {heartbeat_config['interval']}秒")
    logger.info(f"心跳超时: {heartbeat_config['timeout']}秒")

# 初始化存储目录
def init_storage():
    """初始化存储目录"""
    os.makedirs(os.path.join(STORAGE_PATH, "meeting_files"), exist_ok=True)
    os.makedirs(os.path.join(STORAGE_PATH, "download"), exist_ok=True)

# HTTP会话管理
async def get_http_session():
    """获取或创建HTTP会话"""
    global http_session
    if http_session is None:
        http_session = aiohttp.ClientSession()
    return http_session

async def close_http_session():
    """关闭HTTP会话"""
    global http_session
    if http_session is not None:
        await http_session.close()
        http_session = None

# 节点注册
async def register_node():
    """向主控服务器注册节点"""
    global service_running, config

    if not service_running:
        logger.warning("服务未运行，跳过节点注册")
        return False

    try:
        session = await get_http_session()

        # 获取本机地址，使用配置中的端口
        host_name = socket.gethostname()
        host_ip = socket.gethostbyname(host_name)
        node_port = config.get("nodePort", 8001)  # 从配置中获取端口号
        node_address = f"{host_ip}:{node_port}"

        node_info = {
            "node_id": NODE_ID,
            "address": node_address,
            "status": "online"
        }

        logger.info(f"正在向主控服务器 {MAIN_SERVER_URL} 注册节点")
        logger.info(f"节点地址: {node_address}")

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

# 节点注销
async def unregister_node():
    """向主控服务器注销节点"""
    try:
        session = await get_http_session()
        async with session.post(f"{MAIN_SERVER_URL}/api/v1/nodes/unregister", json={"node_id": NODE_ID}) as response:
            if response.status == 200:
                logger.info("节点注销成功")
                return True
            else:
                logger.error(f"节点注销失败: HTTP {response.status}")
                return False
    except Exception as e:
        logger.error(f"节点注销出错: {str(e)}")
        return False

# 发送心跳
async def send_heartbeat():
    """定期向主控服务器发送心跳

    简化的心跳机制，只发送节点ID、地址和在线状态，不发送会议信息。
    心跳间隔和超时时间从配置中获取。
    如果节点被注销后又发送心跳，主控服务器会自动重新注册该节点。
    """
    global service_running, config

    # 获取心跳配置
    heartbeat_config = get_heartbeat_config(config)
    heartbeat_interval = heartbeat_config["interval"]

    # 获取网络配置
    network_config = get_network_config(config)
    connection_timeout = network_config["connectionTimeout"]
    retry_count = network_config["retryCount"]
    retry_delay = network_config["retryDelay"]

    logger.info(f"心跳服务启动，间隔: {heartbeat_interval}秒")

    while True:
        try:
            if service_running:
                session = await get_http_session()

                # 获取本机地址，用于心跳信息
                host_name = socket.gethostname()
                host_ip = socket.gethostbyname(host_name)
                node_port = config.get("nodePort", 8001)
                node_address = f"{host_ip}:{node_port}"

                # 构建心跳信息，包含节点ID、地址、状态和活动会议信息
                heartbeat_info = {
                    "node_id": NODE_ID,
                    "address": node_address,
                    "status": "online",
                    "active_meetings": []  # 初始化为空列表
                }

                # 添加活动会议信息
                if active_meetings and len(active_meetings) > 0:
                    # 转换活动会议列表为心跳所需格式
                    heartbeat_info["active_meetings"] = [
                        {"id": meeting["id"], "title": meeting.get("title", f"会议 {meeting['id']}")}
                        for meeting in active_meetings
                    ]
                    logger.debug(f"心跳包含 {len(active_meetings)} 个活动会议")

                # 尝试发送心跳，支持重试
                success = False
                for attempt in range(retry_count):
                    try:
                        async with session.post(
                            f"{MAIN_SERVER_URL}/api/v1/nodes/heartbeat",
                            json=heartbeat_info,
                            timeout=connection_timeout
                        ) as response:
                            if response.status == 200:
                                logger.debug("心跳发送成功")
                                success = True
                                break
                            else:
                                logger.warning(f"心跳发送失败: HTTP {response.status}")
                    except Exception as e:
                        logger.warning(f"心跳发送尝试 {attempt+1}/{retry_count} 失败: {str(e)}")
                        if attempt < retry_count - 1:
                            await asyncio.sleep(retry_delay)

                if not success:
                    logger.error(f"心跳发送失败，已尝试 {retry_count} 次")

                # 服务运行时，按配置的间隔发送心跳
                await asyncio.sleep(heartbeat_interval)
            else:
                logger.debug("服务未运行，暂停心跳发送")
                # 服务未运行时，等待较长时间再检查，避免频繁轮询
                await asyncio.sleep(300)  # 服务停止时，每5分钟检查一次服务状态
        except Exception as e:
            logger.error(f"心跳发送出错: {str(e)}")
            # 出错时，根据服务状态决定等待时间
            if service_running:
                await asyncio.sleep(heartbeat_interval)  # 保持与正常心跳间隔一致
            else:
                await asyncio.sleep(300)  # 服务停止时，每5分钟检查一次服务状态

# 获取会议状态
async def get_meeting_status():
    """从主控服务器获取会议状态"""
    global service_running

    if not service_running:
        logger.debug("服务未运行，跳过获取会议状态")
        return None

    try:
        session = await get_http_session()
        # 使用分布式节点专用的端点
        async with session.get(f"{MAIN_SERVER_URL}/api/v1/meetings/status/node") as response:
            if response.status == 200:
                data = await response.json()
                logger.info(f"获取会议状态成功: {data}")
                return data
            else:
                logger.error(f"获取会议状态失败: HTTP {response.status}")
                return None
    except Exception as e:
        logger.error(f"获取会议状态出错: {str(e)}")
        return None

# 同步会议数据
async def sync_meeting_data(meeting_id):
    """同步指定会议的数据"""
    global last_sync_time, last_sync_status, service_running, config

    if not service_running:
        logger.warning("服务未运行，跳过同步会议数据")
        return False

    # 获取网络配置
    network_config = get_network_config(config)
    connection_timeout = network_config["connectionTimeout"]
    download_timeout = network_config["downloadTimeout"]
    retry_count = network_config["retryCount"]
    retry_delay = network_config["retryDelay"]

    # 检查与主控服务器的连接状态
    connected = False
    try:
        session = await get_http_session()
        async with session.get(f"{MAIN_SERVER_URL}/", timeout=connection_timeout) as response:
            if response.status in [200, 301, 302, 307, 308]:
                connected = True
    except Exception as e:
        logger.warning(f"连接主控服务器失败: {str(e)}")
        connected = False

    if not connected:
        logger.warning(f"主控服务器连接失败，无法同步会议数据: {meeting_id}")
        last_sync_status = "同步失败: 主控服务器连接失败"
        return False

    try:
        logger.info(f"开始同步会议数据: {meeting_id}")
        last_sync_status = "同步中"

        # 获取存储配置
        storage_config = get_storage_config(config)
        storage_path = storage_config["path"]

        # 创建会议目录（两个位置都创建，确保兼容性）
        meeting_dir = os.path.join(storage_path, "meeting_files", meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        # 同时创建另一个会议目录，用于前端显示
        meeting_folder = os.path.join(storage_path, f"meeting_{meeting_id}")
        os.makedirs(meeting_folder, exist_ok=True)

        # 获取会议包
        package_path = os.path.join(meeting_dir, "package.zip")

        # 从主控服务器下载会议包，支持重试
        session = await get_http_session()
        success = False

        for attempt in range(retry_count):
            try:
                logger.info(f"尝试下载会议包 {attempt+1}/{retry_count}: {meeting_id}")

                async with session.get(
                    f"{MAIN_SERVER_URL}/api/v1/meetings/{meeting_id}/download-package-direct",
                    timeout=download_timeout
                ) as response:
                    if response.status == 200:
                        # 读取响应内容
                        content = await response.read()

                        # 保存到文件
                        with open(package_path, "wb") as f:
                            f.write(content)

                        # 同时保存一份到另一个目录
                        package_folder_path = os.path.join(meeting_folder, "package.zip")
                        with open(package_folder_path, "wb") as f:
                            f.write(content)

                        # 更新同步状态
                        last_sync_time = time.time()
                        last_sync_status = "同步成功"

                        logger.info(f"会议 {meeting_id} 同步完成，包大小: {len(content)} 字节")
                        success = True
                        break
                    else:
                        logger.warning(f"下载会议包失败: HTTP {response.status}，尝试 {attempt+1}/{retry_count}")
                        if attempt < retry_count - 1:
                            await asyncio.sleep(retry_delay)
            except asyncio.TimeoutError:
                logger.warning(f"下载会议包超时，尝试 {attempt+1}/{retry_count}")
                if attempt < retry_count - 1:
                    await asyncio.sleep(retry_delay)
            except Exception as e:
                logger.warning(f"下载会议包出错: {str(e)}，尝试 {attempt+1}/{retry_count}")
                if attempt < retry_count - 1:
                    await asyncio.sleep(retry_delay)

        if not success:
            last_sync_status = "同步失败: 下载失败"
            logger.error(f"会议 {meeting_id} 同步失败，已尝试 {retry_count} 次")
            return False

        return success
    except Exception as e:
        last_sync_status = f"同步出错: {str(e)}"
        logger.error(f"同步会议数据出错: {str(e)}")
        return False

# 同步会议
async def sync_meetings():
    """定期同步所有活动会议"""
    global service_running, last_meeting_token, active_meetings, config

    # 获取同步间隔
    sync_interval = config.get("syncInterval", 10)

    # 获取网络配置
    # 网络配置将在需要时获取

    logger.info(f"同步服务启动，间隔: {sync_interval}秒")

    while True:
        try:
            if service_running:
                logger.info("开始同步会议数据...")

                # 获取会议状态
                status = await get_meeting_status()
                if not status:
                    logger.warning("无法获取会议状态，将在下次同步时重试")
                    await asyncio.sleep(sync_interval)
                    continue

                # 获取会议状态识别码
                current_token = status.get("id")

                # 获取当前活动会议列表
                current_active_meetings = status.get("active_meetings", [])
                logger.info(f"当前活动会议列表: {current_active_meetings}")

                # 兼容旧版API，检查是否使用单一会议ID
                if status.get("active_meeting") and not current_active_meetings:
                    active_meeting_id = status.get("active_meeting")
                    if active_meeting_id:
                        logger.info(f"使用旧版API，单一会议ID: {active_meeting_id}")
                        current_active_meetings = [{"id": active_meeting_id, "title": "活动会议"}]

                # 确保活动会议列表是一个列表
                if current_active_meetings and not isinstance(current_active_meetings, list):
                    logger.warning(f"活动会议列表不是列表类型: {type(current_active_meetings)}")
                    if isinstance(current_active_meetings, dict):
                        logger.info(f"将字典转换为列表: {current_active_meetings}")
                        current_active_meetings = [current_active_meetings]
                    else:
                        logger.warning(f"无法处理的活动会议列表类型，使用空列表")
                        current_active_meetings = []

                # 确保每个会议都有id和title字段
                for i, meeting in enumerate(current_active_meetings):
                    if not isinstance(meeting, dict):
                        logger.warning(f"会议项不是字典类型: {meeting}")
                        current_active_meetings[i] = {"id": str(meeting), "title": f"会议 {meeting}"}
                    elif "id" not in meeting:
                        logger.warning(f"会议项缺少id字段: {meeting}")
                        current_active_meetings[i]["id"] = f"unknown_{i}"
                    elif "title" not in meeting:
                        logger.info(f"会议项缺少title字段: {meeting}")
                        current_active_meetings[i]["title"] = f"会议 {meeting['id']}"

                current_meeting_ids = [m["id"] for m in current_active_meetings]
                logger.info(f"当前活动会议ID列表: {current_meeting_ids}")

                # 检查会议状态是否变化
                if current_token == last_meeting_token and set(current_meeting_ids) == set([m["id"] for m in active_meetings]):
                    logger.info(f"会议状态未变化，跳过同步 (Token: {current_token})")
                    await asyncio.sleep(sync_interval)
                    continue

                # 更新会议状态识别码
                last_meeting_token = current_token

                # 记录当前活动会议数量
                logger.info(f"检测到 {len(current_active_meetings)} 个活动会议")

                # 查找需要同步的新会议
                current_meeting_set = set(current_meeting_ids)
                existing_meeting_set = set([m["id"] for m in active_meetings])

                # 需要同步的新会议
                new_meetings = current_meeting_set - existing_meeting_set
                # 已经结束的会议
                ended_meetings = existing_meeting_set - current_meeting_set

                # 处理已结束的会议
                if ended_meetings:
                    logger.info(f"以下会议已结束: {', '.join(ended_meetings)}")
                    # 从活动会议列表中移除已结束的会议
                    active_meetings = [m for m in active_meetings if m["id"] not in ended_meetings]

                # 同步新会议
                for meeting_id in new_meetings:
                    logger.info(f"开始同步新会议: {meeting_id}")
                    success = await sync_meeting_data(meeting_id)
                    if success:
                        logger.info(f"会议 {meeting_id} 同步成功")
                        # 找到当前会议的标题
                        meeting_title = next((m["title"] for m in current_active_meetings if m["id"] == meeting_id), "未知会议")
                        # 添加到活动会议列表
                        active_meetings.append({"id": meeting_id, "title": meeting_title})
                    else:
                        logger.warning(f"会议 {meeting_id} 同步失败")

                # 如果没有活动会议
                if not current_active_meetings:
                    logger.info("当前没有活动会议")
                    active_meetings = []

                # 等待下一次同步
                logger.info(f"同步完成，{sync_interval}秒后进行下一次同步")
                await asyncio.sleep(sync_interval)
            else:
                logger.debug("服务未运行，暂停同步会议")
                # 服务未运行时，等待较长时间再检查，避免频繁轮询
                await asyncio.sleep(60)  # 服务停止时，每分钟检查一次服务状态
        except Exception as e:
            logger.error(f"同步过程出错: {str(e)}")
            # 出错时，根据服务状态决定等待时间
            if service_running:
                await asyncio.sleep(sync_interval)
            else:
                await asyncio.sleep(60)  # 服务停止时，每分钟检查一次服务状态

# 获取存储使用情况
def get_storage_usage():
    """获取存储使用情况"""
    total_size = 0
    meeting_count = 0

    try:
        # 遍历会议文件目录
        meeting_files_dir = os.path.join(STORAGE_PATH, "meeting_files")
        if os.path.exists(meeting_files_dir):
            for meeting_id in os.listdir(meeting_files_dir):
                meeting_dir = os.path.join(meeting_files_dir, meeting_id)
                if os.path.isdir(meeting_dir):
                    meeting_count += 1

                    # 计算会议目录大小
                    for root, _, files in os.walk(meeting_dir):
                        for file in files:
                            file_path = os.path.join(root, file)
                            if os.path.isfile(file_path):
                                total_size += os.path.getsize(file_path)
    except Exception as e:
        logger.error(f"获取存储使用情况出错: {str(e)}")

    return {
        "total_size": total_size,
        "meeting_count": meeting_count
    }

# API路由
@app.get("/api/config")
async def get_config_api():
    """获取当前配置"""
    return config

@app.post("/api/config")
async def update_config_api(new_config: dict):
    """更新配置"""
    global config, MAIN_SERVER_URL, SYNC_INTERVAL

    # 验证配置数据
    required_fields = ["mainServerIp", "mainServerPort", "syncInterval"]
    for field in required_fields:
        if field not in new_config:
            raise HTTPException(status_code=400, detail=f"缺少必要字段: {field}")

    # 验证端口号
    if not (1 <= new_config["mainServerPort"] <= 65535):
        raise HTTPException(status_code=400, detail="端口号必须在1-65535之间")

    # 验证同步间隔
    if not (10 <= new_config["syncInterval"] <= 3600):
        raise HTTPException(status_code=400, detail="同步间隔必须在10-3600秒之间")

    # 保存旧配置，用于比较变更
    old_config = config.copy()

    # 更新配置（保留节点ID）
    new_config["nodeId"] = config["nodeId"]
    config = new_config

    # 保存配置
    if not save_config(config):
        raise HTTPException(status_code=500, detail="保存配置失败")

    # 更新全局变量
    MAIN_SERVER_URL = get_main_server_url(config)
    SYNC_INTERVAL = config["syncInterval"]

    # 处理配置变更
    await handle_config_change(old_config, config)

    return {"status": "success", "message": "配置已更新"}

async def handle_config_change(old_config, new_config):
    """处理配置变更"""
    # 检查主控服务器地址是否变更
    old_server = get_main_server_url(old_config)
    new_server = get_main_server_url(new_config)

    if old_server != new_server:
        # 主控服务器地址变更，需要重新注册
        logger.info(f"主控服务器地址变更: {old_server} -> {new_server}")
        await unregister_node()  # 从旧服务器注销
        await register_node()    # 向新服务器注册

@app.post("/api/service/start")
async def start_service():
    """启动服务"""
    global service_running, start_time

    if service_running:
        return {"status": "success", "message": "服务已经在运行中"}

    # 启动服务
    service_running = True
    start_time = time.time()

    # 向主控服务器注册节点
    await register_node()

    return {"status": "success", "message": "服务已启动"}

@app.post("/api/service/stop")
async def stop_service():
    """停止服务"""
    global service_running

    if not service_running:
        return {"status": "success", "message": "服务已经停止"}

    # 从主控服务器注销节点
    await unregister_node()

    # 停止服务
    service_running = False

    return {"status": "success", "message": "服务已停止"}

@app.get("/api/status")
async def get_status():
    """获取节点状态"""
    global service_running, start_time, last_sync_time, last_sync_status, active_meetings, last_meeting_token

    # 获取存储使用情况
    storage_info = get_storage_usage()

    # 检查与主控服务器的连接状态
    # 如果最近同步成功，则认为连接正常
    connected = False
    if last_sync_status == "同步成功" and last_sync_time is not None:
        # 如果最近5分钟内同步成功，则认为连接正常
        if time.time() - last_sync_time < 300:
            connected = True
            logger.info("根据最近同步状态判断主控服务器连接正常")

    # 如果最近没有同步成功，则尝试连接主控服务器
    if not connected:
        try:
            # 简化连接检测，只检查根路径
            session = await get_http_session()
            try:
                async with session.get(f"{MAIN_SERVER_URL}/", timeout=2) as response:
                    if response.status in [200, 301, 302, 307, 308]:  # 重定向也表示服务器在线
                        connected = True
                        logger.debug(f"主控服务器连接正常: {MAIN_SERVER_URL}/")
                    else:
                        logger.debug(f"主控服务器连接异常: HTTP {response.status}")
            except Exception as e:
                logger.debug(f"主控服务器连接失败: {str(e)}")

            # 记录最终的连接状态
            if connected:
                logger.info(f"主控服务器连接正常: {MAIN_SERVER_URL}")
            else:
                logger.warning(f"主控服务器连接失败")
        except Exception as e:
            logger.warning(f"主控服务器连接检测出错: {str(e)}")
            connected = False
    else:
        logger.info(f"根据最近同步状态判断主控服务器连接正常")

    # 获取本机IP地址
    node_ip = "未知"
    try:
        host_name = socket.gethostname()
        node_ip = socket.gethostbyname(host_name)
    except Exception as e:
        logger.error(f"获取节点IP地址出错: {str(e)}")

    # 获取节点端口
    node_port = config.get("nodePort", 8001)

    # 获取会议详细信息
    meetings_with_details = []

    # 首先添加活动会议
    active_meeting_ids = set()

    # 打印活动会议列表，用于调试
    logger.info(f"API状态: 活动会议列表 = {active_meetings}")

    for meeting in active_meetings:
        meeting_id = meeting.get("id")
        if meeting_id:
            active_meeting_ids.add(meeting_id)
            # 获取会议文件夹路径
            meeting_folder = os.path.join(STORAGE_PATH, f"meeting_{meeting_id}")

            # 获取会议大小和文件数量
            meeting_size = 0
            file_count = 0
            if os.path.exists(meeting_folder) and os.path.isdir(meeting_folder):
                for root, _, files in os.walk(meeting_folder):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if os.path.isfile(file_path):
                            meeting_size += os.path.getsize(file_path)
                            file_count += 1

            # 创建会议详细信息
            meeting_detail = {
                "id": meeting_id,
                "title": meeting.get("title", "未命名会议"),
                "sync_time": last_sync_time,
                "size": meeting_size,
                "file_count": file_count,
                "status": "active"
            }

            # 打印会议详情，用于调试
            logger.info(f"API状态: 添加活动会议 = {meeting_detail}")

            meetings_with_details.append(meeting_detail)

    # 然后检查本地存储的会议
    meeting_files_dir = os.path.join(STORAGE_PATH, "meeting_files")
    if os.path.exists(meeting_files_dir):
        for meeting_id in os.listdir(meeting_files_dir):
            # 跳过已经添加的活动会议
            if meeting_id in active_meeting_ids:
                continue

            meeting_dir = os.path.join(meeting_files_dir, meeting_id)
            if os.path.isdir(meeting_dir):
                # 获取会议大小和文件数量
                meeting_size = 0
                file_count = 0
                for root, _, files in os.walk(meeting_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        if os.path.isfile(file_path):
                            meeting_size += os.path.getsize(file_path)
                            file_count += 1

                # 尝试获取会议标题
                title = "未命名会议"
                try:
                    # 尝试从包中提取会议标题
                    package_path = os.path.join(meeting_dir, "package.zip")
                    if os.path.exists(package_path):
                        # 这里简化处理，实际上可以从包中提取会议信息
                        title = f"已同步会议 {meeting_id[:8]}"
                except:
                    pass

                # 创建会议详细信息
                meeting_detail = {
                    "id": meeting_id,
                    "title": title,
                    "sync_time": os.path.getmtime(meeting_dir),  # 使用文件夹修改时间作为同步时间
                    "size": meeting_size,
                    "file_count": file_count,
                    "status": "synced"
                }

                meetings_with_details.append(meeting_detail)

    return {
        "node_id": NODE_ID,
        "running": service_running,
        "connected": connected,
        "main_server": MAIN_SERVER_URL,
        "node_ip": node_ip,
        "node_port": node_port,
        "start_time": start_time,
        "last_sync": last_sync_time,
        "sync_status": last_sync_status,
        "active_meetings": meetings_with_details,
        "meeting_count": storage_info["meeting_count"],
        "storage_usage": storage_info["total_size"],
        "meeting_token": last_meeting_token
    }

# 移除健康检查端点

@app.get("/api/v1/meetings/{meeting_id}/download-package")
async def download_meeting_package(meeting_id: str):
    """提供会议包下载，与主控服务器API兼容"""
    global service_running

    if not service_running:
        raise HTTPException(status_code=503, detail="服务未运行")

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



# 下载会议包API
@app.get("/api/meetings/{meeting_id}/download")
async def download_meeting_package_zip(meeting_id: str):
    """下载会议包

    这个API路由与前端页面的下载链接匹配，直接提供已经存在的package.zip文件。
    """
    global service_running

    if not service_running:
        raise HTTPException(status_code=503, detail="服务未运行")

    # 首先尝试使用meeting_files目录中的package.zip
    package_path = os.path.join(STORAGE_PATH, "meeting_files", meeting_id, "package.zip")

    # 如果不存在，尝试使用meeting_{meeting_id}目录中的package.zip
    if not os.path.exists(package_path):
        package_path = os.path.join(STORAGE_PATH, f"meeting_{meeting_id}", "package.zip")

    # 如果仍然不存在，尝试从主控服务器同步
    if not os.path.exists(package_path):
        logger.info(f"会议包不存在，尝试从主控服务器同步: {meeting_id}")
        synced = await sync_meeting_data(meeting_id)

        # 同步后再次检查文件是否存在
        if synced:
            package_path = os.path.join(STORAGE_PATH, "meeting_files", meeting_id, "package.zip")
            if not os.path.exists(package_path):
                package_path = os.path.join(STORAGE_PATH, f"meeting_{meeting_id}", "package.zip")

        # 如果仍然不存在，返回404错误
        if not synced or not os.path.exists(package_path):
            logger.error(f"会议包不存在且同步失败: {meeting_id}")
            raise HTTPException(status_code=404, detail="会议包不存在")

    logger.info(f"提供会议包下载: {package_path}")

    # 提供文件下载
    return FileResponse(
        path=package_path,
        filename=f"meeting_{meeting_id}.zip",
        media_type="application/zip"
    )

# 静态文件服务
app.mount("/static", StaticFiles(directory="static"), name="static")

# 根路径重定向到控制页面
@app.get("/")
async def root():
    """根路径重定向到控制页面"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/static/index.html")

# 使用lifespan上下文管理器替代on_event
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(_: FastAPI):
    """应用生命周期管理

    参数 _ 是FastAPI实例，但在此函数中不使用，使用下划线避免未使用变量的警告。
    """
    # 应用启动时执行
    # 初始化配置
    init_config()

    # 初始化存储目录
    init_storage()

    # 启动心跳任务
    asyncio.create_task(send_heartbeat())

    # 启动同步任务
    asyncio.create_task(sync_meetings())

    # 自动注册节点
    asyncio.create_task(register_node())

    logger.info(f"文件服务节点已启动 [ID: {NODE_ID}]")

    yield  # 这里是应用运行期间

    # 应用关闭时执行
    # 关闭HTTP会话
    await close_http_session()

    # 如果服务正在运行，从主控服务器注销节点
    if service_running:
        await unregister_node()

    logger.info("文件服务节点已关闭")

# 主程序入口
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=False
    )
