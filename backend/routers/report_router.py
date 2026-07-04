"""
Router — Report (SV gửi báo cáo sự cố)
POST /api/reports  — Tạo report + check auto-create obstacle
GET  /api/reports  — Admin xem danh sách reports
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from database.connection import get_db
from database.models import Report
from schemas.report_schemas import ReportCreate, ReportResponse, ReportListResponse
from services.obstacle_service import ObstacleService

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    data: ReportCreate,
    db: AsyncSession = Depends(get_db)
):
    """SV gửi báo cáo sự cố. Hệ thống tự kiểm tra auto-create obstacle."""
    report = Report(
        building_code=data.building_code,
        floor=data.floor,
        obstacle_type=data.obstacle_type,
        target_item_id=data.target_item_id,
        x=data.x,
        y=data.y,
        radius=data.radius,
        description=data.description,
        reporter_id=data.reporter_id,
        status="pending"
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Check auto-create obstacle
    service = ObstacleService(db)
    await service.check_auto_create(report)

    return report


@router.get("", response_model=ReportListResponse)
async def get_reports(
    building: str = Query(...),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Admin xem danh sách reports."""
    query = select(Report).where(Report.building_code == building)
    if status:
        query = query.where(Report.status == status)
    query = query.order_by(Report.created_at.desc())

    result = await db.execute(query)
    reports = result.scalars().all()
    return ReportListResponse(reports=reports, total=len(reports))
