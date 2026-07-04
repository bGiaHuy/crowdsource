"""Pydantic Schemas — Report (Crowdsourcing Report)"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ObstacleType(str, Enum):
    ELEVATOR_BROKEN = "elevator_broken"
    STAIRS_LOCKED = "stairs_locked"
    ROOM_LOCKED = "room_locked"
    WET_FLOOR = "wet_floor"
    CONSTRUCTION = "construction"
    DEBRIS = "debris"
    OTHER = "other"


class ReportCreate(BaseModel):
    building_code: str = Field(..., max_length=20)
    floor: int = Field(..., ge=1, le=10)
    obstacle_type: ObstacleType
    target_item_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = Field(default=None, ge=10, le=300)
    description: str = Field(default="", max_length=500)
    reporter_id: Optional[str] = None
    tester_mode: Optional[bool] = False


class ReportResponse(BaseModel):
    id: int
    building_code: str
    floor: int
    obstacle_type: str
    target_item_id: Optional[str]
    x: Optional[float]
    y: Optional[float]
    radius: Optional[float]
    description: str
    reporter_id: Optional[str]
    status: str
    created_at: datetime
    obstacle_created: bool = False  # True khi report này gây tạo obstacle tự động

    class Config:
        from_attributes = True


class ReportListResponse(BaseModel):
    reports: List[ReportResponse]
    total: int
