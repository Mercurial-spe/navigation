"""
JSON导出模块
用于将Graph对象转换为visjs兼容的JSON格式
"""
import json
from ..models.graph import Graph

def graph_to_visjs(graph: Graph) -> dict:
    """
    将Graph对象转换为visjs兼容的JSON格式，包含所有重要属性
    
    参数:
        graph: Graph对象
        
    返回:
        包含nodes和edges的字典，可直接转换为JSON
    """
    nodes = []
    edges = []
    
    # 转换顶点，包含所有重要属性
    for vertex_id, vertex in graph.vertices.items():
        node_data = {
            "id": vertex_id,
            "label": f"Node {vertex_id}",
            "x": vertex.x,
            "y": vertex.y,
            "size": 0.5,  # 添加size属性，用于Sigma.js
            "fixed": True,
            # 添加点的属性
            "is_gas_station": vertex.is_gas_station,
            "is_shopping_mall": vertex.is_shopping_mall,
            "is_parking_lot": vertex.is_parking_lot,
            "attribute_type": vertex.get_attribute_type()
        }
        nodes.append(node_data)
    
    # 转换边，包含所有重要属性
    for edge_id, edge in graph.edges.items():
        edge_data = {
            "id": f"{edge.vertex1.id}-{edge.vertex2.id}",
            "source": edge.vertex1.id,  # 改为source
            "target": edge.vertex2.id,  # 改为target
            "size": 0.1,  # 添加size属性，用于Sigma.js
            # 添加边的属性
            "length": edge.length,
            "capacity": edge.capacity,
            "current_vehicles": edge.current_vehicles,
            "is_mall_connection": edge.is_mall_connection
        }
        edges.append(edge_data)
    
    return {
        "nodes": nodes,
        "edges": edges
    }

def export_graph_to_json(graph: Graph, filepath: str) -> None:
    """
    将Graph对象导出为JSON文件
    
    参数:
        graph: Graph对象
        filepath: 导出的JSON文件路径
    """
    data = graph_to_visjs(graph)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"地图数据已导出到: {filepath}") 