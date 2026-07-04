"""
Router — Report (SV gửi báo cáo sự cố)
"""
from sqlalchemy import select, func
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
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
    # Check duplicate if not tester mode and reporter_id is provided
    if not data.tester_mode and data.reporter_id:
        if data.target_item_id:
            dup_query = select(Report).where(
                Report.reporter_id == data.reporter_id,
                Report.obstacle_type == data.obstacle_type.value,
                Report.target_item_id == data.target_item_id,
                Report.status.in_(["pending", "aggregated"])
            )
        elif data.x is not None and data.y is not None:
            dup_query = select(Report).where(
                Report.reporter_id == data.reporter_id,
                Report.obstacle_type == data.obstacle_type.value,
                Report.x.isnot(None),
                Report.y.isnot(None),
                func.abs(Report.x - data.x) < 20,
                func.abs(Report.y - data.y) < 20,
                Report.status.in_(["pending", "aggregated"])
            )
        else:
            dup_query = None

        if dup_query is not None:
            existing_report = (await db.execute(dup_query)).scalars().first()
            if existing_report:
                raise HTTPException(status_code=400, detail="Bạn đã báo cáo lỗi này rồi")

    report = Report(
        building_code=data.building_code,
        floor=data.floor,
        obstacle_type=data.obstacle_type.value,
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
    created_obstacle = await service.check_auto_create(report)

    # Build response with obstacle_created flag
    response = ReportResponse.model_validate(report)
    response.obstacle_created = created_obstacle is not None
    return response


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
