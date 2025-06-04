"""
地图生成模块，用于生成随机地图数据
"""

from .random_map import generate_random_points, generate_connected_map

__all__ = ['generate_random_points', 'generate_connected_map'] 