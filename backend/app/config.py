# =============================================================================
# 配置管理模块 - Config Management Module
# =============================================================================
import logging
import os
import sys
from pathlib import Path
from typing import List

from dotenv import load_dotenv

# 加载 .env 文件
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    """应用配置类"""

    # =========================================================================
    # 路径配置
    # =========================================================================
    BASE_DIR: Path = Path(__file__).parent.parent
    STATIC_DIR: Path = BASE_DIR / "static"
    UPLOADS_DIR: Path = STATIC_DIR / "uploads"

    # =========================================================================
    # 数据库配置
    # =========================================================================
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

    # =========================================================================
    # 安全配置
    # =========================================================================
    SECRET_KEY: str = os.getenv("SECRET_KEY", "haozhang-secret-key-change-this-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

    # =========================================================================
    # CORS 配置
    # =========================================================================
    @property
    def CORS_ORIGINS(self) -> List[str]:
        # 允许所有可能的前端来源（开发模式）
        origins_str = os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,http://127.0.0.1:3000"
        )
        return [origin.strip() for origin in origins_str.split(",")]

    # =========================================================================
    # 文件上传配置
    # =========================================================================
    @property
    def MAX_IMAGE_SIZE(self) -> int:
        """最大图片大小 (字节)"""
        mb = float(os.getenv("MAX_IMAGE_SIZE_MB", "2"))
        return int(mb * 1024 * 1024)

    @property
    def ALLOWED_IMAGE_TYPES(self) -> List[str]:
        types_str = os.getenv("ALLOWED_IMAGE_TYPES", "image/jpeg,image/png,image/webp")
        return [t.strip() for t in types_str.split(",")]

    def __init__(self):
        """确保必要的目录存在"""
        self.STATIC_DIR.mkdir(exist_ok=True)
        self.UPLOADS_DIR.mkdir(exist_ok=True)


# 创建全局配置实例
settings = Settings()


# =============================================================================
# 日志配置 - Logging Configuration
# =============================================================================
def setup_logging(name: str = None) -> logging.Logger:
    """
    配置并返回 logger 实例

    Args:
        name: logger 名称，通常使用 __name__

    Returns:
        配置好的 Logger 实例
    """
    logger = logging.getLogger(name or "haoexam")

    # 避免重复添加 handler
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    # 格式化器
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(formatter)

    logger.addHandler(console_handler)

    return logger


# 创建默认 logger
logger = setup_logging("haoexam")
