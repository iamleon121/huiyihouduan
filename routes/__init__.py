"""
路由模块包

此包包含所有API路由，按功能分组到不同的模块中。
"""

# 导出所有路由器，便于在main.py中导入
from routes.meetings import router as meetings_router
from routes.documents import router as documents_router
from routes.users import router as users_router
from routes.maintenance import router as maintenance_router
from routes.pdf_conversion import router as pdf_conversion_router
from routes.nodes import router as nodes_router
from routes.meetings_download import router as meetings_download_router
from routes.meetings_status import router as meetings_status_router

# 所有可用的路由器列表，用于在main.py中注册
__all__ = [
    "meetings_router",
    "documents_router",
    "users_router",
    "maintenance_router",
    "pdf_conversion_router",
    "nodes_router",
    "meetings_download_router",
    "meetings_status_router"
]
