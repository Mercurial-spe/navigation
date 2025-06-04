import math
from typing import List, Dict, Tuple, Set
from ..models.graph import Graph
from ..models.vertex import Vertex
from ..models.edge import Edge
from .traffic_simulate import calculate_travel_time

def heuristic(vertex1: Vertex, vertex2: Vertex) -> float:
    """
    计算两个顶点之间的欧几里得距离作为启发式函数
    
    参数:
        vertex1: 第一个顶点
        vertex2: 第二个顶点
        
    返回:
        两点之间的欧几里得距离
    """
    return math.sqrt((vertex1.x - vertex2.x) ** 2 + (vertex1.y - vertex2.y) ** 2)

def get_path_from_came_from(came_from: Dict[Vertex, Vertex], current: Vertex) -> List[Vertex]:
    """
    从came_from字典中重建路径
    
    参数:
        came_from: 记录每个顶点的前驱顶点
        current: 当前顶点
        
    返回:
        从起点到终点的顶点列表
    """
    path = [current]
    while current in came_from:
        current = came_from[current]
        path.append(current)
    return list(reversed(path))

def get_path_edges(path: List[Vertex], graph: Graph) -> List[Edge]:
    """
    获取路径上的所有边
    
    参数:
        path: 顶点路径
        graph: 图实例
        
    返回:
        路径上的边列表
    """
    edges = []
    for i in range(len(path) - 1):
        edge = graph.get_edge_between(path[i], path[i + 1])
        if edge:
            edges.append(edge)
    return edges

def find_shortest_path(graph: Graph, start: Vertex, end: Vertex) -> Tuple[List[Vertex], List[Edge], float]:
    """
    使用A*算法找到两点之间的最短路径（基于几何距离）
    
    参数:
        graph: 图实例
        start: 起点
        end: 终点
        
    返回:
        (顶点路径, 边路径, 总距离)
    """
    # 初始化开放列表和关闭列表
    open_set: Set[Vertex] = {start}
    closed_set: Set[Vertex] = set()
    
    # 初始化距离和父节点记录
    g_score: Dict[Vertex, float] = {start: 0}
    f_score: Dict[Vertex, float] = {start: heuristic(start, end)}
    came_from: Dict[Vertex, Vertex] = {}
    
    while open_set:
        # 找到f_score最小的顶点
        current = min(open_set, key=lambda v: f_score.get(v, float('inf')))
        
        if current == end:
            # 找到路径，重建并返回
            path = get_path_from_came_from(came_from, current)
            edges = get_path_edges(path, graph)
            total_distance = g_score[current]
            return path, edges, total_distance
        
        open_set.remove(current)
        closed_set.add(current)
        
        # 检查所有邻居
        for neighbor in current.get_neighbors():
            if neighbor in closed_set:
                continue
                
            # 计算从起点到邻居的新距离
            edge = graph.get_edge_between(current, neighbor)
            if not edge:
                continue
                
            tentative_g_score = g_score[current] + edge.length
            
            if neighbor not in open_set:
                open_set.add(neighbor)
            elif tentative_g_score >= g_score.get(neighbor, float('inf')):
                continue
                
            # 更新路径信息
            came_from[neighbor] = current
            g_score[neighbor] = tentative_g_score
            f_score[neighbor] = g_score[neighbor] + heuristic(neighbor, end)
    
    # 如果没有找到路径
    return [], [], float('inf')

def find_fastest_path(graph: Graph, start: Vertex, end: Vertex, use_traffic: bool = True) -> Tuple[List[Vertex], List[Edge], float]:
    """
    使用A*算法找到两点之间的最短路径
    
    参数:
        graph: 图实例
        start: 起点
        end: 终点
        use_traffic: 是否考虑路况，True表示基于通行时间，False表示基于路径长度
        
    返回:       
        (顶点路径, 边路径, 总时间/距离)
    """
    # 如果考虑路况，计算所有边的行驶时间
    if use_traffic:
        travel_times = calculate_travel_time(graph)
    
    # 初始化开放列表和关闭列表
    open_set: Set[Vertex] = {start}
    closed_set: Set[Vertex] = set()
    
    # 初始化时间和父节点记录
    g_score: Dict[Vertex, float] = {start: 0}
    f_score: Dict[Vertex, float] = {start: heuristic(start, end)}
    came_from: Dict[Vertex, Vertex] = {}
    
    while open_set:
        # 找到f_score最小的顶点
        current = min(open_set, key=lambda v: f_score.get(v, float('inf')))
        
        if current == end:
            # 找到路径，重建并返回
            path = get_path_from_came_from(came_from, current)
            edges = get_path_edges(path, graph)
            total_cost = g_score[current]
            return path, edges, total_cost
        
        open_set.remove(current)
        closed_set.add(current)
        
        # 检查所有邻居
        for neighbor in current.get_neighbors():
            if neighbor in closed_set:
                continue
                
            # 计算从起点到邻居的新成本
            edge = graph.get_edge_between(current, neighbor)
            if not edge:
                continue
                
            # 根据use_traffic参数决定使用哪种成本计算方式
            if use_traffic:
                tentative_g_score = g_score[current] + travel_times[edge.id]
            else:
                tentative_g_score = g_score[current] + edge.length
            
            if neighbor not in open_set:
                open_set.add(neighbor)
            elif tentative_g_score >= g_score.get(neighbor, float('inf')):
                continue
                
            # 更新路径信息
            came_from[neighbor] = current
            g_score[neighbor] = tentative_g_score
            f_score[neighbor] = g_score[neighbor] + heuristic(neighbor, end)
    
    # 如果没有找到路径
    return [], [], float('inf')

def print_path_info(path: List[Vertex], edges: List[Edge], total_cost: float, is_time: bool = False):
    """
    打印路径信息
    
    参数:
        path: 顶点路径
        edges: 边路径
        total_cost: 总成本（距离或时间）
        is_time: 是否显示时间信息
    """
    print(f"\n找到{'最快' if is_time else '最短'}路径:")
    print(f"总{'时间' if is_time else '距离'}: {total_cost:.2f}")
    
    print("\n路径详情:")
    for i, (vertex, edge) in enumerate(zip(path[:-1], edges)):
        print(f"  {i+1}. 顶点 {vertex.id} ({vertex.x:.1f}, {vertex.y:.1f})")
        print(f"     → 边 {edge.id} (长度: {edge.length:.1f}, 当前车辆: {edge.current_vehicles}, 容量: {edge.capacity})")
    
    print(f"  {len(path)}. 顶点 {path[-1].id} ({path[-1].x:.1f}, {path[-1].y:.1f})")
