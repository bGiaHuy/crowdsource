"""Pydantic Schemas — Obstacle (Vật cản trên bản đồ)"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ObstacleCreate(BaseModel):
    building_code: str = Field(..., max_length=20)
    floor: int = Field(..., ge=1, le=10)
    obstacle_type: str
    target_item_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = Field(default=None, ge=10, le=300)
    description: str = Field(default="", max_length=500)


class ObstacleUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = Field(default=None, ge=10, le=300)
    description: Optional[str] = Field(default=None, max_length=500)
    status: Optional[str] = None  # active | confirmed | removed


class ObstacleResponse(BaseModel):
    id: int
    building_code: str
    floor: int
    obstacle_type: str
    target_item_id: Optional[str]
    x: Optional[float]
    y: Optional[float]
    radius: Optional[float]
    source: str
    status: str
    upvotes: int
    downvotes: int
    description: str
    confirmed_by: Optional[str]
    created_at: datetime
    removed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ObstacleListResponse(BaseModel):
    obstacles: List[ObstacleResponse]
    total: int


class VoteResponse(BaseModel):
    id: int
    upvotes: int
    downvotes: int
    auto_removed: bool = False

class VoteRequest(BaseModel):
    user_id: Optional[str] = None
    tester_mode: Optional[bool] = False
