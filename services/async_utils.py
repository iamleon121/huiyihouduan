"""
异步工具模块，提供异步操作相关的工具函数

此模块提供了一系列工具函数，用于处理异步操作，包括在同步环境中执行异步函数、
并行执行多个异步任务等。
"""
import asyncio
import functools
from typing import Any, Callable, Coroutine, List, TypeVar, Optional

T = TypeVar('T')

class AsyncUtils:
    """异步工具类，提供异步操作相关的工具函数"""

    @staticmethod
    async def gather_with_concurrency(n: int, *tasks) -> List[Any]:
        """
        限制并发数量的异步任务收集器

        与asyncio.gather类似，但限制了同时运行的任务数量，
        适用于需要控制资源使用的场景（如文件I/O、网络请求等）。

        Args:
            n (int): 最大并发数量
            *tasks: 要执行的异步任务列表

        Returns:
            List[Any]: 所有任务的结果列表
        """
        semaphore = asyncio.Semaphore(n)
        
        async def sem_task(task):
            async with semaphore:
                return await task
        
        return await asyncio.gather(*(sem_task(task) for task in tasks))

    @staticmethod
    def run_sync(func: Callable[..., Coroutine[Any, Any, T]], *args, **kwargs) -> T:
        """
        在同步环境中运行异步函数

        这是一个更安全的替代方案，用于替换创建新事件循环的模式。
        它使用当前线程的事件循环（如果存在），或创建一个新的事件循环。

        Args:
            func (Callable): 要执行的异步函数
            *args: 传递给异步函数的位置参数
            **kwargs: 传递给异步函数的关键字参数

        Returns:
            Any: 异步函数的返回值
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # 如果当前线程没有事件循环，创建一个新的
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            should_close = True
        else:
            should_close = False

        try:
            return loop.run_until_complete(func(*args, **kwargs))
        finally:
            if should_close:
                loop.close()

    @staticmethod
    def to_sync(async_func: Callable[..., Coroutine[Any, Any, T]]) -> Callable[..., T]:
        """
        将异步函数转换为同步函数的装饰器

        用于创建异步函数的同步版本，便于在同步环境中调用。

        Args:
            async_func (Callable): 要转换的异步函数

        Returns:
            Callable: 转换后的同步函数
        """
        @functools.wraps(async_func)
        def sync_func(*args, **kwargs):
            return AsyncUtils.run_sync(async_func, *args, **kwargs)
        return sync_func

    @staticmethod
    async def run_in_threadpool(func: Callable[..., T], *args, **kwargs) -> T:
        """
        在线程池中运行同步函数

        用于在异步环境中执行可能阻塞的同步操作，避免阻塞事件循环。

        Args:
            func (Callable): 要执行的同步函数
            *args: 传递给同步函数的位置参数
            **kwargs: 传递给同步函数的关键字参数

        Returns:
            Any: 同步函数的返回值
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, lambda: func(*args, **kwargs)
        )

    @staticmethod
    def to_async(sync_func: Callable[..., T]) -> Callable[..., Coroutine[Any, Any, T]]:
        """
        将同步函数转换为异步函数的装饰器

        用于创建同步函数的异步版本，便于在异步环境中调用。

        Args:
            sync_func (Callable): 要转换的同步函数

        Returns:
            Callable: 转换后的异步函数
        """
        @functools.wraps(sync_func)
        async def async_func(*args, **kwargs):
            return await AsyncUtils.run_in_threadpool(sync_func, *args, **kwargs)
        return async_func
