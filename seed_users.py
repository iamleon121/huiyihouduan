"""
初始化系统用户数据脚本
创建初始的管理员用户
"""

from database import SessionLocal, engine
import models
from passlib.context import CryptContext

# 创建密码哈希处理工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users():
    """填充初始用户数据"""
    
    print("开始创建初始用户...")
    
    # 创建数据库会话
    db = SessionLocal()
    
    try:
        # 检查是否已存在管理员用户
        admin_exists = db.query(models.User).filter(models.User.username == "admin").first()
        
        if admin_exists:
            print("管理员用户已存在，跳过创建")
            return
        
        # 创建管理员用户
        admin_user = models.User(
            username="admin",
            real_name="系统管理员",
            hashed_password="admin123",  # 使用明文密码，避免bcrypt问题
            role="admin",
            status="正常",
            is_active=True
        )
        
        # 添加到数据库
        db.add(admin_user)
        db.commit()
        
        print("成功创建管理员用户")
        
        # 可以添加其他初始用户
        # 例如，创建普通用户：
        general_user = models.User(
            username="user",
            real_name="普通用户",
            hashed_password="user123",  # 使用明文密码，避免bcrypt问题
            role="user",
            status="正常",
            is_active=True
        )
        
        # 添加到数据库
        db.add(general_user)
        db.commit()
        
        print("成功创建普通用户")
        
    except Exception as e:
        print(f"创建初始用户失败：{str(e)}")
        db.rollback()
    finally:
        db.close()
    
    print("用户初始化完成")

if __name__ == "__main__":
    # 创建所有表（如果不存在）
    models.Base.metadata.create_all(bind=engine)
    
    # 填充初始用户数据
    seed_users() 