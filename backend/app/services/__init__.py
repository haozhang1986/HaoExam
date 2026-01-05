# =============================================================================
# Services 模块
# =============================================================================
"""
业务逻辑服务层
"""

from .validator import SyllabusValidator, ValidationError

__all__ = ['SyllabusValidator', 'ValidationError']
