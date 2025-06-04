"""
顶点类，表示地图中的一个地点
"""
import random

class Vertex:
    """
    顶点类，表示地图中的一个地点
    
    属性:
        id: 顶点的唯一标识符
        x: x坐标
        y: y坐标
        edges: 与该顶点相连的边列表
        is_gas_station: 是否是加油站
        is_restaurant: 是否是餐厅
        is_parking_lot: 是否是停车场
    """
    
    def __init__(self, id, x, y):
        """
        初始化顶点
        
        参数:
            id: 顶点的唯一标识符
            x: x坐标
            y: y坐标
        """
        self.id = id
        self.x = x
        self.y = y
        self.edges = []
        self.is_gas_station = False
        self.is_shopping_mall = False
        self.is_parking_lot = False
        
        # 随机分配属性（1%的概率）
        self._assign_random_attribute()
    
    def _assign_random_attribute(self):
        """
        随机分配顶点属性（加油站、商场、停车场）
        每个顶点有1%的概率被分配为其中一种属性
        """
        if random.random() < 0.01:  # 1%的概率
            # 随机选择一种属性
            attribute = random.choice(['gas_station', 'shopping_mall', 'parking_lot'])
            if attribute == 'gas_station':
                self.is_gas_station = True
            elif attribute == 'shopping_mall':
                self.is_shopping_mall = True
            else:  # parking_lot
                self.is_parking_lot = True
    
    def get_attribute_type(self) -> str:
        """
        获取顶点的属性类型
        
        返回:
            属性类型字符串：'gas_station', 'shopping_mall', 'parking_lot' 或 'normal'
        """
        if self.is_gas_station:
            return 'gas_station'
        elif self.is_shopping_mall:
            return 'shopping_mall'
        elif self.is_parking_lot:
            return 'parking_lot'
        return 'normal'
    
    def add_edge(self, edge):
        """
        添加一条与该顶点相连的边
        
        参数:
            edge: 要添加的边
        """
        if edge not in self.edges:
            self.edges.append(edge)
    
    def get_neighbors(self):
        """
        获取与该顶点相邻的所有顶点
        
        返回:
            相邻顶点列表
        """
        neighbors = []
        for edge in self.edges:
            neighbor = edge.get_other_vertex(self)
            if neighbor:
                neighbors.append(neighbor)
        return neighbors
    
    def distance_to(self, other_vertex):
        """
        计算到另一个顶点的欧几里得距离
        
        参数:
            other_vertex: 另一个顶点
            
        返回:
            欧几里得距离
        """
        return ((self.x - other_vertex.x) ** 2 + (self.y - other_vertex.y) ** 2) ** 0.5
    
    def __str__(self):
        """返回顶点的字符串表示"""
        return f"Vertex(id={self.id}, x={self.x:.2f}, y={self.y:.2f}, edges={len(self.edges)})"
    
    def __repr__(self):
        """返回顶点的详细表示"""
        return self.__str__()
    
    def __eq__(self, other):
        """判断两个顶点是否相等"""
        if not isinstance(other, Vertex):
            return False
        return self.id == other.id
    
    def __hash__(self):
        """返回顶点的哈希值，用于集合和字典操作"""
        return hash(self.id) 