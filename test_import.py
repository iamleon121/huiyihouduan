"""
测试导入routes/meetings.py
"""

try:
    from routes.meetings import router
    print("成功导入routes.meetings模块")
except Exception as e:
    print(f"导入routes.meetings模块时出错: {e}")
    import traceback
    traceback.print_exc()
