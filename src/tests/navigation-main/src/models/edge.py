"""
边类，表示地图中的一条道路
"""
import math
import random
from .vertex import Vertex
from ..algorithms.traffic_simulate import *

class Edge:
    """
    边类，表示地图中的一条道路
    
    属性:
        id: 边的唯一标识符
        vertex1: 第一个顶点
        vertex2: 第二个顶点
        length: 边的长度（两顶点间的欧几里得距离）
        capacity: 道路容量（饱和状态下可容纳的车辆数量）
        current_vehicles: 当前道路上的车辆数
        is_mall_connection: 是否连接商场
    """
    
    def __init__(self, id, vertex1, vertex2, capacity=100, is_mall_connection=False):
        """
        初始化边
        
        参数:
            id: 边的唯一标识符
            vertex1: 第一个顶点
            vertex2: 第二个顶点
            capacity: 道路容量，理想化为边长度的100倍
            is_mall_connection: 是否连接商场
        """
        self.id = id
        self.vertex1 = vertex1
        self.vertex2 = vertex2
        self.length = self._calculate_length()
        self.capacity : int = int(self.length *100)
        self.current_vehicles : int = random.randint(min(100,int(self.capacity)), int(self.capacity))
        self.is_mall_connection = is_mall_connection
        
        # 将边添加到两个顶点
        vertex1.add_edge(self)
        vertex2.add_edge(self)
    
    
    def _calculate_length(self):
        """
        计算边的长度（两顶点间的欧几里得距离）
        
        返回:
            边的长度
        """
        return ((self.vertex1.x - self.vertex2.x) ** 2 + 
                (self.vertex1.y - self.vertex2.y) ** 2) ** 0.5
    
    def get_other_vertex(self, vertex):
        """
        给定边的一个顶点，返回另一个顶点
        
        参数:
            vertex: 给定的顶点
            
        返回:
            另一个顶点，如果给定的顶点不是边的顶点则返回None
        """
        if vertex == self.vertex1:
            return self.vertex2
        elif vertex == self.vertex2:
            return self.vertex1
        return None
    
    def __str__(self):
        """返回边的字符串表示"""
        return f"Edge(id={self.id}, length={self.length:.2f}, congestion={self.get_congestion_level()})"
    
    def __repr__(self):
        """返回边的详细表示"""
        return self.__str__()
    
    def __eq__(self, other):
        """判断两条边是否相等"""
        if not isinstance(other, Edge):
            return False
        return self.id == other.id
    
    def __hash__(self):
        """返回边的哈希值，用于集合和字典操作"""
        return hash(self.id) 