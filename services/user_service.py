"""
用户服务模块，包含用户认证和管理相关的业务逻辑

此模块提供用户认证、授权和管理的服务，包括用户登录、注册、信息更新等功能。
"""
from typing import List, Dict, Any, Optional, Union
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext

import models
import schemas
import crud

# 密钥和算法配置
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 密码流
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/users/login")

class UserService:
    """用户服务类，处理用户认证和管理相关的业务逻辑"""

    @staticmethod
    def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]:
        """
        获取用户列表

        Args:
            db (Session): 数据库会话对象
            skip (int, optional): 跳过的记录数，默认为0
            limit (int, optional): 返回的最大记录数，默认为100

        Returns:
            List[models.User]: 用户对象列表
        """
        return crud.get_users(db, skip=skip, limit=limit)

    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[models.User]:
        """
        获取单个用户详情

        Args:
            db (Session): 数据库会话对象
            user_id (int): 用户ID

        Returns:
            Optional[models.User]: 用户对象，如果不存在则返回None

        Raises:
            HTTPException: 当用户不存在时，返回404错误
        """
        user = crud.get_user(db, user_id=user_id)
        if user is None:
            raise HTTPException(status_code=404, detail="用户不存在")
        return user

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
        """
        通过用户名获取用户

        Args:
            db (Session): 数据库会话对象
            username (str): 用户名

        Returns:
            Optional[models.User]: 用户对象，如果不存在则返回None
        """
        return crud.get_user_by_username(db, username=username)

    @staticmethod
    def create_user(db: Session, user: schemas.UserCreate) -> models.User:
        """
        创建新用户

        Args:
            db (Session): 数据库会话对象
            user (schemas.UserCreate): 用户创建模型

        Returns:
            models.User: 创建的用户对象

        Raises:
            HTTPException: 当用户名已存在时，返回400错误
        """
        # 检查用户名是否已存在
        db_user = UserService.get_user_by_username(db, username=user.username)
        if db_user:
            raise HTTPException(status_code=400, detail="用户名已存在")
        return crud.create_user(db=db, user=user)

    @staticmethod
    def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate) -> models.User:
        """
        更新用户信息

        Args:
            db (Session): 数据库会话对象
            user_id (int): 用户ID
            user_update (schemas.UserUpdate): 用户更新模型

        Returns:
            models.User: 更新后的用户对象

        Raises:
            HTTPException: 当用户不存在时，返回404错误
        """
        db_user = crud.update_user(db=db, user_id=user_id, user_update=user_update)
        if db_user is None:
            raise HTTPException(status_code=404, detail="用户不存在")
        return db_user

    @staticmethod
    def delete_user(db: Session, user_id: int) -> Dict[str, str]:
        """
        删除用户

        Args:
            db (Session): 数据库会话对象
            user_id (int): 用户ID

        Returns:
            Dict[str, str]: 包含操作结果的字典

        Raises:
            HTTPException: 当用户不存在时，返回404错误
        """
        success = crud.delete_user(db=db, user_id=user_id)
        if not success:
            raise HTTPException(status_code=404, detail="用户不存在")
        return {"message": "用户已删除"}

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """
        验证密码

        Args:
            plain_password (str): 明文密码
            hashed_password (str): 哈希密码

        Returns:
            bool: 密码是否匹配
        """
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            # 如果哈希验证失败，尝试直接比较纯文本密码
            return plain_password == hashed_password

    @staticmethod
    def get_password_hash(password: str) -> str:
        """
        获取密码哈希

        Args:
            password (str): 明文密码

        Returns:
            str: 哈希密码
        """
        return pwd_context.hash(password)

    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Union[models.User, bool]:
        """
        用户认证

        Args:
            db (Session): 数据库会话对象
            username (str): 用户名
            password (str): 密码

        Returns:
            Union[models.User, bool]: 认证成功返回用户对象，失败返回False
        """
        user = UserService.get_user_by_username(db, username)
        if not user:
            return False
        if not UserService.verify_password(password, user.hashed_password):
            return False
        return user

    @staticmethod
    def login(db: Session, username: str, password: str) -> models.User:
        """
        用户登录

        Args:
            db (Session): 数据库会话对象
            username (str): 用户名
            password (str): 密码

        Returns:
            models.User: 登录成功的用户对象

        Raises:
            HTTPException: 当用户名或密码错误时，返回401错误
        """
        user = UserService.authenticate_user(db, username, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户名或密码错误",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """
        创建访问令牌

        Args:
            data (Dict[str, Any]): 要编码到令牌中的数据
            expires_delta (Optional[timedelta], optional): 令牌过期时间，默认为7天

        Returns:
            str: JWT令牌字符串
        """
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    @staticmethod
    def get_current_user(db: Session, token: str) -> models.User:
        """
        获取当前用户

        Args:
            db (Session): 数据库会话对象
            token (str): JWT令牌

        Returns:
            models.User: 当前用户对象

        Raises:
            HTTPException: 当令牌无效或用户不存在时，返回401错误
        """
        credentials_exception = HTTPException(
            status_code=401,
            detail="无法验证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise credentials_exception
            token_data = schemas.TokenData(username=username)
        except JWTError:
            raise credentials_exception
        user = UserService.get_user_by_username(db, username=token_data.username)
        if user is None:
            raise credentials_exception
        return user
