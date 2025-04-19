"""
用户相关路由

此模块包含所有与用户管理相关的路由，包括用户的认证、授权、查询和管理。
"""

from fastapi import APIRouter, Depends, HTTPException, Form, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

# 导入数据库模型、模式和CRUD操作
import models, schemas, crud
from database import SessionLocal, get_db

# 导入服务层
from services.user_service import UserService, oauth2_scheme

# 创建路由器
router = APIRouter(
    prefix="/api/v1/users",  # 使用不同的前缀避免与main.py中的路由冲突
    tags=["users"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取用户列表"""
    # 使用UserService获取用户列表
    users = UserService.get_users(db, skip=skip, limit=limit)
    return users

@router.post("/", response_model=schemas.User)
def create_user_endpoint(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """创建新用户"""
    # 使用UserService创建新用户
    return UserService.create_user(db=db, user=user)

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: int, db: Session = Depends(get_db)):
    """获取单个用户详情"""
    # 使用UserService获取单个用户详情
    return UserService.get_user(db, user_id=user_id)

@router.put("/{user_id}", response_model=schemas.User)
def update_user_endpoint(user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db)):
    """更新用户信息"""
    # 使用UserService更新用户信息
    return UserService.update_user(db=db, user_id=user_id, user_update=user_update)

@router.delete("/{user_id}", response_model=dict)
def delete_user_endpoint(user_id: int, db: Session = Depends(get_db)):
    """删除用户"""
    # 使用UserService删除用户
    return UserService.delete_user(db=db, user_id=user_id)

@router.post("/login", response_model=schemas.User)
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """用户登录"""
    # 使用UserService进行用户登录
    return UserService.login(db, username, password)

@router.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """用户登录并获取访问令牌"""
    # 使用UserService进行用户认证
    user = UserService.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # 使用UserService创建访问令牌
    from datetime import timedelta
    access_token_expires = timedelta(minutes=UserService.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = UserService.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.User)
def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """获取当前用户信息"""
    # 使用UserService获取当前用户
    return UserService.get_current_user(db, token)
