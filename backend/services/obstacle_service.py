"""
Service — Obstacle Business Logic
Core logic: auto-create (≥3 reports) + auto-remove (≥5 downvotes)
"""
import datetime
import math
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from database.models import Report, Obstacle

AUTO_CREATE_THRESHOLD = 3   # reports cùng target/vùng → tạo obstacle
AUTO_REMOVE_THRESHOLD = 5   # downvotes → gỡ obstacle
AREA_PROXIMITY_PX = 200     # khoảng cách pixel tối đa để gộp area reports

# Targeted types: chọn object cụ thể
TARGETED_TYPES = {"elevator_broken", "stairs_locked", "room_locked"}
# Area types: chọn vùng ảnh hưởng
AREA_TYPES = {"wet_floor", "construction", "debris", "other"}


class ObstacleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Auto-create logic ─────────────────────────────────
    async def check_auto_create(self, report: Report) -> Optional[Obstacle]:
        """
        Gọi sau khi tạo report. Đếm reports tương tự:
        - Targeted: cùng building + obstacle_type + target_item_id + status=pending
        - Area: cùng building + floor + obstacle_type + gần vị trí (< AREA_PROXIMITY_PX)
        Nếu >= AUTO_CREATE_THRESHOLD → tạo Obstacle(source='auto')
        """
        if report.obstacle_type in TARGETED_TYPES:
            return await self._check_targeted(report)
        else:
            return await self._check_area(report)

    async def _check_targeted(self, report: Report) -> Optional[Obstacle]:
        # Đếm pending reports cùng target
        query = select(func.count()).select_from(Report).where(
            Report.building_code == report.building_code,
            Report.obstacle_type == report.obstacle_type,
            Report.target_item_id == report.target_item_id,
            Report.status == "pending"
        )
        result = await self.db.execute(query)
        count = result.scalar()

        if count >= AUTO_CREATE_THRESHOLD:
            # Kiểm tra obstacle đã tồn tại chưa
            existing = await self.db.execute(
                select(Obstacle).where(
                    Obstacle.building_code == report.building_code,
                    Obstacle.obstacle_type == report.obstacle_type,
                    Obstacle.target_item_id == report.target_item_id,
                    Obstacle.status.in_(["active", "confirmed"])
                )
            )
            if existing.scalar_one_or_none():
                return None  # Đã có obstacle rồi

            # Tạo obstacle mới
            obstacle = Obstacle(
                building_code=report.building_code,
                floor=report.floor,
                obstacle_type=report.obstacle_type,
                target_item_id=report.target_item_id,
                source="auto",
                status="active",
                description=f"Tự động tạo từ {count} báo cáo",
                created_at=datetime.datetime.utcnow()
            )
            self.db.add(obstacle)

            # Cập nhật reports → aggregated
            await self.db.execute(
                update(Report).where(
                    Report.building_code == report.building_code,
                    Report.obstacle_type == report.obstacle_type,
                    Report.target_item_id == report.target_item_id,
                    Report.status == "pending"
                ).values(status="aggregated")
            )
            await self.db.commit()
            await self.db.refresh(obstacle)
            return obstacle

        return None

    async def _check_area(self, report: Report) -> Optional[Obstacle]:
        # Lấy tất cả pending reports cùng building + floor + type
        query = select(Report).where(
            Report.building_code == report.building_code,
            Report.floor == report.floor,
            Report.obstacle_type == report.obstacle_type,
            Report.status == "pending",
            Report.x.isnot(None),
            Report.y.isnot(None)
        )
        result = await self.db.execute(query)
        pending_reports = result.scalars().all()

        # Tìm cluster gần vị trí report hiện tại
        nearby = []
        for r in pending_reports:
            dist = math.sqrt((r.x - report.x) ** 2 + (r.y - report.y) ** 2)
            if dist < AREA_PROXIMITY_PX:
                nearby.append(r)

        if len(nearby) >= AUTO_CREATE_THRESHOLD:
            # Kiểm tra obstacle tương tự đã tồn tại chưa
            existing_obs = await self.db.execute(
                select(Obstacle).where(
                    Obstacle.building_code == report.building_code,
                    Obstacle.floor == report.floor,
                    Obstacle.obstacle_type == report.obstacle_type,
                    Obstacle.status.in_(["active", "confirmed"]),
                    Obstacle.x.isnot(None)
                )
            )
            for obs in existing_obs.scalars().all():
                dist = math.sqrt((obs.x - report.x) ** 2 + (obs.y - report.y) ** 2)
                if dist < AREA_PROXIMITY_PX:
                    return None  # Đã có obstacle gần đó

            # Tính trung bình vị trí + max radius
            avg_x = sum(r.x for r in nearby) / len(nearby)
            avg_y = sum(r.y for r in nearby) / len(nearby)
            max_radius = max((r.radius or 60) for r in nearby)

            obstacle = Obstacle(
                building_code=report.building_code,
                floor=report.floor,
                obstacle_type=report.obstacle_type,
                x=avg_x,
                y=avg_y,
                radius=max_radius,
                source="auto",
                status="active",
                description=f"Tự động tạo từ {len(nearby)} báo cáo",
                created_at=datetime.datetime.utcnow()
            )
            self.db.add(obstacle)

            # Cập nhật reports → aggregated
            report_ids = [r.id for r in nearby]
            await self.db.execute(
                update(Report).where(
                    Report.id.in_(report_ids)
                ).values(status="aggregated")
            )
            await self.db.commit()
            await self.db.refresh(obstacle)
            return obstacle

        return None

    # ─── Auto-remove logic ─────────────────────────────────
    async def check_auto_remove(self, obstacle: Obstacle) -> bool:
        """Nếu downvotes >= threshold → set status='removed'. Return True nếu đã gỡ."""
        if obstacle.downvotes >= AUTO_REMOVE_THRESHOLD:
            obstacle.status = "removed"
            obstacle.removed_at = datetime.datetime.utcnow()
            await self.db.commit()
            await self.db.refresh(obstacle)
            return True
        return False
