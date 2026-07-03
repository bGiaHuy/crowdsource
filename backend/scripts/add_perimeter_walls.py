import json

DRAFT_PATH = "frontend/public/data/delta_draft.json"

with open(DRAFT_PATH, "r", encoding="utf-8") as f:
    draft = json.load(f)

for floor in draft["floors"]:
    fnum = floor["floor"]
    items = floor["items"]
    
    # Remove any existing programmatically added perimeter walls to avoid duplicates
    items = [i for i in items if not i.get("item_id", "").startswith("PERIMETER-")]
    
    # Left
    items.append({
        "item_id": f"PERIMETER-LEFT-F{fnum}",
        "item_type": "wall",
        "bbox": {"min_x": 0, "min_y": 0, "max_x": 120, "max_y": 1750},
        "is_clickable": False
    })
    
    # Right
    items.append({
        "item_id": f"PERIMETER-RIGHT-F{fnum}",
        "item_type": "wall",
        "bbox": {"min_x": 2460, "min_y": 0, "max_x": 2600, "max_y": 1750},
        "is_clickable": False
    })
    
    # Bottom
    items.append({
        "item_id": f"PERIMETER-BOTTOM-F{fnum}",
        "item_type": "wall",
        "bbox": {"min_x": 0, "min_y": 1670, "max_x": 2600, "max_y": 1750},
        "is_clickable": False
    })
    
    # Top
    if fnum == 1:
        # Floor 1 top, split into left and right of the main door
        # Main door area: x=895 to 1715
        items.append({
            "item_id": f"PERIMETER-TOP-LEFT-F{fnum}",
            "item_type": "wall",
            "bbox": {"min_x": 0, "min_y": 0, "max_x": 895, "max_y": 135},
            "is_clickable": False
        })
        items.append({
            "item_id": f"PERIMETER-TOP-RIGHT-F{fnum}",
            "item_type": "wall",
            "bbox": {"min_x": 1715, "min_y": 0, "max_x": 2600, "max_y": 135},
            "is_clickable": False
        })
    else:
        # Floor 2, 3, 4 top
        items.append({
            "item_id": f"PERIMETER-TOP-F{fnum}",
            "item_type": "wall",
            "bbox": {"min_x": 0, "min_y": 0, "max_x": 2600, "max_y": 275},
            "is_clickable": False
        })
        
    # Central Void Area
    items.append({
        "item_id": f"PERIMETER-CENTER-VOID-F{fnum}",
        "item_type": "block",
        "bbox": {"min_x": 670, "min_y": 475, "max_x": 1910, "max_y": 1380},
        "is_clickable": False
    })

    floor["items"] = items

with open(DRAFT_PATH, "w", encoding="utf-8") as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)

print("Perimeter walls added.")
