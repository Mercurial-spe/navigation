import math
import time
from typing import Dict, List, Tuple
import numpy as np
from ..models.vertex import Vertex
from ..models.graph import Graph

# 全局变量
threshold: float = 0.5  # 拥堵阈值
update_interval: int = 10  # 更新间隔（毫秒）
running: bool = False

def calculate_travel_time(graph: Graph) -> Dict[str, float]:
    """
    计算所有边的行驶时间
    
    参数:
        graph: 图实例
        
    返回:
        每条边的行驶时间字典 {edge_id: travel_time}
    """
    travel_times = {}
    for edge_id, edge in graph.edges.items():
        ratio = max(edge.current_vehicles, 1) / edge.capacity
        if ratio <= threshold:
            f = 1
        elif ratio <= 0.7:
            f = math.exp(ratio)
        else:
            f = 1.2 + math.exp(ratio)
        travel_times[edge_id] = edge.length * f
    return travel_times

def distribute_vehicles(graph: Graph):
    """
    将车辆分配到相邻的边
    
    参数:
        graph: 图实例
    """
    for edge_id, edge in graph.edges.items():
        if edge.current_vehicles <= 0:
            continue
            
        # 获取相邻的边
        v1, v2 = edge.vertex1, edge.vertex2
        v1_edges = [e for e in v1.edges if e != edge]
        v2_edges = [e for e in v2.edges if e != edge]
        
        # 计算可分配的车辆数
        vehicles_to_distribute = min(edge.current_vehicles, 5)  # 每次最多分配5辆车
        edge.current_vehicles -= vehicles_to_distribute
        
        # 计算相邻边的权重（基于容量和当前车辆数）
        def get_edge_weight(e):
            return e.capacity / max(e.current_vehicles, 1)
        
        # 分配车辆到相邻边
        all_adjacent_edges = v1_edges + v2_edges
        if not all_adjacent_edges:
            continue
            
        weights = [get_edge_weight(e) for e in all_adjacent_edges]
        total_weight = sum(weights)
        
        if total_weight > 0:
            # 按权重分配车辆
            for e, w in zip(all_adjacent_edges, weights):
                vehicles = int(vehicles_to_distribute * (w / total_weight))
                e.current_vehicles += vehicles

def update_traffic_flow(graph: Graph):
    """
    更新所有边的交通流量
    
    参数:
        graph: 图实例
    """
    for edge_id, edge in graph.edges.items():
        # 随机增减车辆数量
        change = np.random.randint(-2, 3)  # -2到2的随机数
        
        # 如果是连接商场的边，增加车流量
        if edge.is_mall_connection:
            # 增加50%的车流量，但不超过容量
            change = int(change * 1.5)
            # 确保不超过容量
            new_vehicles = min(edge.current_vehicles + change, edge.capacity)
            edge.current_vehicles = max(0, new_vehicles)
        else:
            # 普通边的正常更新
            edge.current_vehicles = max(0, edge.current_vehicles + change)
            # 确保不超过容量
            edge.current_vehicles = min(edge.current_vehicles, edge.capacity * 1.05)
    
    # 分配车辆到相邻边
    distribute_vehicles(graph)

def get_traffic_level(graph: Graph) -> Dict[str, int]:
    """
    获取所有边的交通流量等级
    
    参数:
        graph: 图实例
        
    返回:
        每条边的交通流量等级字典 {edge_id: level}
    """
    levels = {}
    for edge_id, edge in graph.edges.items():
        ratio = edge.current_vehicles / edge.capacity
        if ratio < 0.5:
            levels[edge_id] = 0  # 畅通
        elif ratio < 0.7:
            levels[edge_id] = 1  # 轻微拥堵
        elif ratio < 0.8:
            levels[edge_id] = 2  # 中度拥堵
        elif ratio < 0.9:
            levels[edge_id] = 3  # 严重拥堵
        else:
            levels[edge_id] = 4  # 极度拥堵
    return levels

def get_traffic_color(graph: Graph) -> Dict[str, str]:
    """
    获取所有边的交通颜色
    
    参数:
        graph: 图实例
        
    返回:
        每条边的颜色字典 {edge_id: color}
    """
    colors = {
        0: "#00FF00",  # 绿色 - 畅通
        1: "#90EE90",  # 浅绿色 - 轻微拥堵
        2: "#FFFF00",  # 黄色 - 中度拥堵
        3: "#FFA500",  # 橙色 - 严重拥堵
        4: "#FF0000"   # 红色 - 极度拥堵
    }
    
    levels = get_traffic_level(graph)
    return {edge_id: colors.get(level, "#808080") for edge_id, level in levels.items()}

def run_simulation(graph: Graph, steps: int = -1):
    """
    运行交通流模拟
    
    参数:
        graph: 图实例
        steps: 模拟步数，-1表示无限运行
    """
    step = 0
    while steps == -1 or step < steps:
        update_traffic_flow(graph)
        time.sleep(update_interval)
        step += 1

def init_traffic_simulation(graph: Graph, congestion_threshold: float = 0.5, interval: int = 10):
    """
    初始化交通流模拟
    
    参数:
        graph: 图实例
        congestion_threshold: 拥堵阈值
        interval: 更新间隔（毫秒）
    """
    global threshold, update_interval
    threshold = congestion_threshold
    update_interval = interval
    
    for edge_id, edge in graph.edges.items():
        # 检查边的顶点是否为商场
        if edge.vertex1.is_mall or edge.vertex2.is_mall:
            # 如果是商场连接的边，设置初始车流量为普通边的1.5倍
            edge.current_vehicles = min(edge.current_vehicles * 1.5, edge.capacity)