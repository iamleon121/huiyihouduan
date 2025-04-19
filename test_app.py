"""
测试应用程序启动
"""

try:
    import main
    print("成功导入main模块")
    
    # 检查路由
    app = main.app
    routes = app.routes
    print(f"应用程序共有 {len(routes)} 个路由")
    
    # 检查是否有会议相关路由
    meeting_routes = [route for route in routes if hasattr(route, 'path') and str(route.path).startswith("/api/meetings")]
    print(f"会议相关路由数量: {len(meeting_routes)}")
    
    # 检查是否有v1会议相关路由
    v1_meeting_routes = [route for route in routes if hasattr(route, 'path') and str(route.path).startswith("/api/v1/meetings")]
    print(f"v1会议相关路由数量: {len(v1_meeting_routes)}")
    
    # 打印所有路由
    print("\n所有路由:")
    for route in routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', set())
            print(f"- {route.path} [{methods}]")
        else:
            print(f"- {route} (Mount)")
    
except Exception as e:
    print(f"导入main模块时出错: {e}")
    import traceback
    traceback.print_exc()
