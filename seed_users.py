from sqlalchemy.orm import Session
from database import SessionLocal
import crud, schemas

def seed_users():
    """
    初始化系统用户
    
    在系统首次启动时，创建默认的管理员账户和其他基本用户账户
    """
    db = SessionLocal()
    try:
        # 检查是否已经存在管理员用户
        admin_user = crud.get_user_by_username(db, "admin")
        if not admin_user:
            print("创建默认管理员用户: admin")
            # 创建默认管理员用户
            admin = schemas.UserCreate(
                username="admin",
                password="admin123",  # 默认密码，建议在首次登录后修改
                real_name="系统管理员",
                role="admin"
            )
            crud.create_user(db, admin)
        else:
            print("管理员用户已存在，跳过创建")
            
        # 检查是否已经存在普通用户
        test_user = crud.get_user_by_username(db, "user")
        if not test_user:
            print("创建默认普通用户: user")
            # 创建默认普通用户
            user = schemas.UserCreate(
                username="user",
                password="user123",  # 默认密码，建议在首次登录后修改
                real_name="普通用户",
                role="user"
            )
            crud.create_user(db, user)
        else:
            print("普通用户已存在，跳过创建")
            
    finally:
        db.close()
        
if __name__ == "__main__":
    # 如果直接运行此脚本，则执行初始化
    seed_users()
