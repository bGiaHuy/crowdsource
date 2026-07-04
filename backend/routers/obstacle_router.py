"""
Router — Obstacle (Vật cản trên bản đồ)
GET    /api/obstacles             — Lấy obstacles active
POST   /api/obstacles             — Admin tạo thủ công
PATCH  /api/obstacles/{id}        — Admin sửa
DELETE /api/obstacles/{id}        — Admin xóa
POST   /api/obstacles/{id}/upvote — SV xác nhận còn
POST   /api/obstacles/{id}/downvote — SV báo hết → auto-remove nếu đủ
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import datetime

from database.connection import get_db
from database.models import Obstacle
from schemas.obstacle_schemas import (
    ObstacleCreate, ObstacleUpdate, ObstacleResponse,
    ObstacleListResponse, VoteResponse, VoteRequest
)
from sqlalchemy.orm.attributes import flag_modified
from services.obstacle_service import ObstacleService

router = APIRouter(prefix="/api/obstacles", tags=["obstacles"])


@router.get("", response_model=ObstacleListResponse)
async def get_obstacles(
    building: str = Query(...),
    status: Optional[str] = Query("active"),
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách obstacles theo building + status."""
    query = select(Obstacle).where(Obstacle.building_code == building)
    if status:
        query = query.where(Obstacle.status == status)
    query = query.order_by(Obstacle.created_at.desc())

    result = await db.execute(query)
    obstacles = result.scalars().all()
    return ObstacleListResponse(obstacles=obstacles, total=len(obstacles))


@router.post("", response_model=ObstacleResponse, status_code=201)
async def create_obstacle(
    data: ObstacleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Admin tạo obstacle thủ công."""
    obstacle = Obstacle(
        building_code=data.building_code,
        floor=data.floor,
        obstacle_type=data.obstacle_type,
        target_item_id=data.target_item_id,
        x=data.x,
        y=data.y,
        radius=data.radius,
        source="admin",
        status="active",
        description=data.description,
        created_at=datetime.datetime.utcnow()
    )
    db.add(obstacle)
    await db.commit()
    await db.refresh(obstacle)
    return obstacle


@router.patch("/{obstacle_id}", response_model=ObstacleResponse)
async def update_obstacle(
    obstacle_id: int,
    data: ObstacleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Admin sửa obstacle (vị trí, phạm vi, trạng thái)."""
    result = await db.execute(
        select(Obstacle).where(Obstacle.id == obstacle_id)
    )
    obstacle = result.scalar_one_or_none()
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")

    if data.x is not None:
        obstacle.x = data.x
    if data.y is not None:
        obstacle.y = data.y
    if data.radius is not None:
        obstacle.radius = data.radius
    if data.description is not None:
        obstacle.description = data.description
    if data.status is not None:
        obstacle.status = data.status
        if data.status == "confirmed":
            obstacle.confirmed_by = "admin"
        if data.status == "removed":
            obstacle.removed_at = datetime.datetime.utcnow()

    await db.commit()
    await db.refresh(obstacle)
    return obstacle


@router.delete("/{obstacle_id}", status_code=204)
async def delete_obstacle(
    obstacle_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Admin xóa obstacle."""
    result = await db.execute(
        select(Obstacle).where(Obstacle.id == obstacle_id)
    )
    obstacle = result.scalar_one_or_none()
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")

    await db.delete(obstacle)
    await db.commit()


@router.post("/{obstacle_id}/upvote", response_model=VoteResponse)
async def upvote_obstacle(
    obstacle_id: int,
    data: VoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """SV xác nhận vật cản vẫn còn → upvote +1."""
    result = await db.execute(
        select(Obstacle).where(Obstacle.id == obstacle_id)
    )
    obstacle = result.scalar_one_or_none()
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")

    if not data.tester_mode and data.user_id:
        if not obstacle.votes_data:
            obstacle.votes_data = {}
        
        user_vote = obstacle.votes_data.get(data.user_id)
        if user_vote == "upvote":
            raise HTTPException(status_code=400, detail="Bạn đã upvote rồi")
        elif user_vote == "downvote":
            raise HTTPException(status_code=400, detail="Bạn đã downvote rồi, không thể upvote nữa")
            
        obstacle.votes_data[data.user_id] = "upvote"
        flag_modified(obstacle, "votes_data")

    obstacle.upvotes += 1
    await db.commit()
    await db.refresh(obstacle)
    return VoteResponse(
        id=obstacle.id,
        upvotes=obstacle.upvotes,
        downvotes=obstacle.downvotes,
        auto_removed=False
    )


@router.post("/{obstacle_id}/downvote", response_model=VoteResponse)
async def downvote_obstacle(
    obstacle_id: int,
    data: VoteRequest,
    db: AsyncSession = Depends(get_db)
):
    """SV báo vật cản hết rồi → downvote +1. Nếu ≥5 → auto-remove."""
    result = await db.execute(
        select(Obstacle).where(Obstacle.id == obstacle_id)
    )
    obstacle = result.scalar_one_or_none()
    if not obstacle:
        raise HTTPException(status_code=404, detail="Obstacle not found")

    if not data.tester_mode and data.user_id:
        if not obstacle.votes_data:
            obstacle.votes_data = {}
            
        user_vote = obstacle.votes_data.get(data.user_id)
        if user_vote == "downvote":
            raise HTTPException(status_code=400, detail="Bạn đã downvote rồi")
        elif user_vote == "upvote":
            raise HTTPException(status_code=400, detail="Bạn đã upvote rồi, không thể downvote nữa")
            
        obstacle.votes_data[data.user_id] = "downvote"
        flag_modified(obstacle, "votes_data")

    obstacle.downvotes += 1
    await db.commit()
    await db.refresh(obstacle)

    # Check auto-remove
    service = ObstacleService(db)
    auto_removed = await service.check_auto_remove(obstacle)

    return VoteResponse(
        id=obstacle.id,
        upvotes=obstacle.upvotes,
        downvotes=obstacle.downvotes,
        auto_removed=auto_removed
    )
