"""
Router — Admin Dashboard
POST /api/admin/login   — Đăng nhập admin (hardcoded)
GET  /api/admin/reports  — Lấy TẤT CẢ reports
GET  /api/admin/obstacles — Lấy TẤT CẢ obstacles
PATCH /api/admin/reports/{id}/status — Admin cập nhật status report
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel
import datetime

from database.connection import get_db
from database.models import Report, Obstacle

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ── Hardcoded admin credentials ──
ADMIN_EMAIL = "buigiahuy092007@gmail.com"
ADMIN_PASSWORD = "123"


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class DirectObstacleCreate(BaseModel):
    building_code: str
    floor: int
    obstacle_type: str
    target_item_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    radius: Optional[float] = None
    description: Optional[str] = ""


class AdminLoginResponse(BaseModel):
    success: bool
    message: str
    token: str = ""  # simple token for session


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(data: AdminLoginRequest):
    """Admin đăng nhập. Chỉ chấp nhận email + password cố định."""
    if data.email == ADMIN_EMAIL and data.password == ADMIN_PASSWORD:
        return AdminLoginResponse(
            success=True,
            message="Đăng nhập thành công",
            token="fptu-admin-secret-token-2026"
        )
    raise HTTPException(status_code=401, detail="Sai email hoặc mật khẩu")


@router.get("/reports")
async def get_all_reports(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Admin xem TẤT CẢ reports."""
    query = select(Report)
    if status:
        query = query.where(Report.status == status)
    query = query.order_by(Report.created_at.desc())

    result = await db.execute(query)
    reports = result.scalars().all()

    return {
        "reports": [
            {
                "id": r.id,
                "building_code": r.building_code,
                "floor": r.floor,
                "obstacle_type": r.obstacle_type,
                "target_item_id": r.target_item_id,
                "x": r.x,
                "y": r.y,
                "radius": r.radius,
                "description": r.description,
                "reporter_id": r.reporter_id,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in reports
        ],
        "total": len(reports),
    }


@router.get("/obstacles")
async def get_all_obstacles(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Admin xem TẤT CẢ obstacles."""
    query = select(Obstacle)
    if status:
        query = query.where(Obstacle.status == status)
    query = query.order_by(Obstacle.created_at.desc())

    result = await db.execute(query)
    obstacles = result.scalars().all()

    return {
        "obstacles": [
            {
                "id": o.id,
                "building_code": o.building_code,
                "floor": o.floor,
                "obstacle_type": o.obstacle_type,
                "target_item_id": o.target_item_id,
                "x": o.x,
                "y": o.y,
                "radius": o.radius,
                "source": o.source,
                "status": o.status,
                "upvotes": o.upvotes,
                "downvotes": o.downvotes,
                "description": o.description,
                "confirmed_by": o.confirmed_by,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "removed_at": o.removed_at.isoformat() if o.removed_at else None,
            }
            for o in obstacles
        ],
        "total": len(obstacles),
    }


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Thống kê nhanh cho dashboard."""
    total_reports = (await db.execute(select(func.count()).select_from(Report))).scalar()
    pending_reports = (await db.execute(
        select(func.count()).select_from(Report).where(Report.status == "pending")
    )).scalar()
    active_obstacles = (await db.execute(
        select(func.count()).select_from(Obstacle).where(Obstacle.status == "active")
    )).scalar()
    total_obstacles = (await db.execute(select(func.count()).select_from(Obstacle))).scalar()

    return {
        "total_reports": total_reports,
        "pending_reports": pending_reports,
        "active_obstacles": active_obstacles,
        "total_obstacles": total_obstacles,
    }


@router.post("/obstacles/direct")
async def create_obstacle_direct(
    data: DirectObstacleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Test Menu: Tạo trực tiếp một Obstacle, bỏ qua Report."""
    obstacle = Obstacle(
        building_code=data.building_code,
        floor=data.floor,
        obstacle_type=data.obstacle_type,
        target_item_id=data.target_item_id,
        x=data.x,
        y=data.y,
        radius=data.radius,
        description=data.description or "Tạo trực tiếp từ Test Menu",
        source="admin",
        status="active",
        created_at=datetime.datetime.utcnow()
    )
    db.add(obstacle)
    await db.commit()
    await db.refresh(obstacle)
    return obstacle


@router.patch("/reports/{report_id}/status")
async def update_report_status(
    report_id: int,
    status: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Admin cập nhật status của report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if status == "aggregated" and report.status != "aggregated":
        # Check if obstacle already exists
        if report.target_item_id:
            obs_query = select(Obstacle).where(
                Obstacle.target_item_id == report.target_item_id,
                Obstacle.obstacle_type == report.obstacle_type,
                Obstacle.status.in_(["active", "confirmed"])
            )
        elif report.x is not None and report.y is not None:
            obs_query = select(Obstacle).where(
                Obstacle.obstacle_type == report.obstacle_type,
                Obstacle.status.in_(["active", "confirmed"]),
                Obstacle.x.isnot(None),
                Obstacle.y.isnot(None),
                func.abs(Obstacle.x - report.x) < 10,
                func.abs(Obstacle.y - report.y) < 10
            )
        else:
            obs_query = select(Obstacle).where(
                Obstacle.obstacle_type == report.obstacle_type,
                Obstacle.status.in_(["active", "confirmed"])
            )
        
        existing_obs = (await db.execute(obs_query)).scalars().first()
        if not existing_obs:
            obstacle = Obstacle(
                building_code=report.building_code,
                floor=report.floor,
                obstacle_type=report.obstacle_type,
                target_item_id=report.target_item_id,
                x=report.x,
                y=report.y,
                radius=report.radius,
                description=report.description or "Tạo từ Report được duyệt bởi Admin",
                source="admin",
                status="active",
                created_at=datetime.datetime.utcnow()
            )
            db.add(obstacle)

    report.status = status
    await db.commit()
    return {"id": report_id, "status": status}


@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Admin xóa report."""
    result = await db.execute(select(Report).where(Report.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await db.delete(report)
    await db.commit()
    return {"deleted": True, "id": report_id}
