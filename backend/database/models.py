from sqlalchemy import (
    Column, Integer, String, Float, Text, ForeignKey, JSON, Index, DateTime, Boolean
)
from sqlalchemy.orm import DeclarativeBase, relationship
from pgvector.sqlalchemy import Vector
import datetime
import datetime

class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


# ─── Campus ──────────────────────────────────────────────
class Campus(Base):
    __tablename__ = "campuses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)  # e.g. "HCM", "HN", "DN"
    latitude = Column(Float)
    longitude = Column(Float)

    buildings = relationship("Building", back_populates="campus", lazy="selectin")


# ─── Building ────────────────────────────────────────────
class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    campus_id = Column(Integer, ForeignKey("campuses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=False)  # e.g. "DELTA", "ALPHA"
    description = Column(Text, default="")

    campus = relationship("Campus", back_populates="buildings")
    floors = relationship("Floor", back_populates="building", lazy="selectin",
                          order_by="Floor.floor_number")


# ─── Floor ───────────────────────────────────────────────
class Floor(Base):
    __tablename__ = "floors"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id"), nullable=False)
    floor_number = Column(Integer, nullable=False)  # 1, 2, 3, ...
    name = Column(String(50), default="")  # e.g. "Tầng 1"
    map_image_url = Column(String(255), default="")  # URL to floor plan image
    bounds = Column(JSON)  # [[y_min, x_min], [y_max, x_max]] for Leaflet CRS.Simple

    building = relationship("Building", back_populates="floors")
    rooms = relationship("Room", back_populates="floor", lazy="selectin")
    nodes = relationship("Node", back_populates="floor", lazy="selectin")
    edges = relationship("Edge", back_populates="floor", lazy="selectin")


# ─── Room ────────────────────────────────────────────────
class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(String(200), unique=True, index=True, nullable=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)
    room_code = Column(String(50), nullable=False, index=True)  # e.g. "DE-201"
    name = Column(String(100), default="")
    item_type = Column(String(50), nullable=False)  # room, office, door, lobby, etc.
    description = Column(Text, default="")
    photos = Column(JSON, default=list)  # list of image URLs
    center_x = Column(Float, nullable=False)  # center coordinate for marker
    center_y = Column(Float, nullable=False)
    polygon = Column(JSON, default=list)  # [[x,y], ...] polygon vertices for GeoJSON
    
    aliases = Column(JSON, default=list)
    searchable = Column(Boolean, default=True)
    highlightable = Column(Boolean, default=True)
    needs_human_confirmation = Column(Boolean, default=False)
    extra_data = Column(JSON, default=dict)

    floor = relationship("Floor", back_populates="rooms")

    __table_args__ = (
        Index("ix_rooms_room_code_floor", "room_code", "floor_id"),
    )


# ─── Node (Graph vertex for routing) ────────────────────
class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=False)
    node_id = Column(String(50), unique=True, nullable=False)  # e.g. "N1"
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    type = Column(String(50), default="waypoint")  # hallway, room, stair, entrance
    linked_room_code = Column(String(50), default=None)  # FK-like reference to room_code

    floor = relationship("Floor", back_populates="nodes")


# ─── Edge (Graph edge for routing) ──────────────────────
class Edge(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    floor_id = Column(Integer, ForeignKey("floors.id"), nullable=True)  # null for cross-floor edges
    from_node_id = Column(String(50), nullable=False)
    to_node_id = Column(String(50), nullable=False)
    weight = Column(Float, nullable=False)  # distance / cost
    edge_type = Column(String(20), default="walk")  # walk, stairs, elevator

    floor = relationship("Floor", back_populates="edges", foreign_keys=[floor_id])

    __table_args__ = (
        Index("ix_graph_edges_from_to", "from_node_id", "to_node_id"),
    )


# ─── ChatRequest (For Rate Limiting) ────────────────────
class ChatRequest(Base):
    __tablename__ = "chat_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True) # Supabase UUID
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    message_length = Column(Integer, default=0)

# ─── New Content Models ──────────────────────────────────────
class ChatbotKnowledge(Base):
    __tablename__ = "chatbot_knowledge"
    id = Column(Integer, primary_key=True, index=True)
    intent = Column(String(100), index=True)
    question_examples = Column(Text)
    approved_answer = Column(Text)
    source_name = Column(String(200))
    source_url = Column(String(500))
    verified_by = Column(String(100))
    verified_at = Column(String(50))
    review_status = Column(String(20))
    published = Column(Boolean, default=False)
    related_actions = Column(String(100))
    notes = Column(Text)
    embedding = Column(Vector(384))

class FAQ(Base):
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text)
    answer = Column(Text)
    category = Column(String(100))
    source_name = Column(String(200))
    source_url = Column(String(500))
    verified_by = Column(String(100))
    verified_at = Column(String(50))
    review_status = Column(String(20))
    published = Column(Boolean, default=False)
    embedding = Column(Vector(384))

class Article(Base):
    __tablename__ = "articles"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500))
    content = Column(Text)
    category = Column(String(100))
    source_name = Column(String(200))
    source_url = Column(String(500))
    verified_by = Column(String(100))
    verified_at = Column(String(50))
    review_status = Column(String(20))
    published = Column(Boolean, default=False)
    embedding = Column(Vector(384))

class RoomMetadata(Base):
    __tablename__ = "room_metadata"
    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String(50), index=True)
    item_id = Column(String(200))
    floor = Column(Integer)
    display_name = Column(String(200))
    description = Column(Text)
    tags = Column(String(200))
    photos = Column(Text) 
    opening_hours = Column(String(200))
    contact = Column(String(200))
    source_name = Column(String(200))
    source_url = Column(String(500))
    verified_by = Column(String(100))
    verified_at = Column(String(50))
    review_status = Column(String(20))
    published = Column(Boolean, default=False)


# ─── Report (Báo cáo sự cố từ sinh viên) ────────────────
class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    building_code = Column(String(20), nullable=False, index=True)
    floor = Column(Integer, nullable=False)
    obstacle_type = Column(String(50), nullable=False)
    # Targeted types: item_id cụ thể (elevator, stair, room)
    target_item_id = Column(String(200), nullable=True)
    # Area types: tọa độ pixel + bán kính
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    radius = Column(Float, nullable=True)
    description = Column(Text, default="")
    reporter_id = Column(String(100), nullable=True)
    status = Column(String(20), default="pending", index=True)  # pending | aggregated | dismissed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        Index("ix_reports_building_type", "building_code", "obstacle_type"),
    )


# ─── Obstacle (Vật cản trên bản đồ) ─────────────────────
class Obstacle(Base):
    __tablename__ = "obstacles"

    id = Column(Integer, primary_key=True, index=True)
    building_code = Column(String(20), nullable=False, index=True)
    floor = Column(Integer, nullable=False)
    obstacle_type = Column(String(50), nullable=False)
    target_item_id = Column(String(200), nullable=True)
    x = Column(Float, nullable=True)
    y = Column(Float, nullable=True)
    radius = Column(Float, nullable=True)
    source = Column(String(20), default="auto")  # auto | admin
    status = Column(String(20), default="active", index=True)  # active | confirmed | removed
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    description = Column(Text, default="")
    confirmed_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    removed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_obstacles_building_status", "building_code", "status"),
    )

