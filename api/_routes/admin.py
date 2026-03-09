from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from api._state import users, ride_history
from api._auth import get_admin_user

router = APIRouter()


@router.get("/api/admin/users")
async def list_users(admin: dict = Depends(get_admin_user)):
    return {"users": [
        {
            "id":              u["id"],
            "email":           u["email"],
            "displayName":     u["displayName"],
            "hasSignedWaiver": u.get("hasSignedWaiver", False),
            "moodleApproved":  u.get("moodleApproved", False),
            "isAdmin":         u.get("isAdmin", False),
            "createdAt":       u.get("createdAt"),
        }
        for u in users.values()
    ]}


@router.get("/api/admin/pending-approvals")
async def pending_approvals(admin: dict = Depends(get_admin_user)):
    pending = [
        {
            "id":             u["id"],
            "email":          u["email"],
            "displayName":    u["displayName"],
            "waiverSignedAt": u.get("waiverSignedAt"),
            "createdAt":      u.get("createdAt"),
        }
        for u in users.values()
        if u.get("hasSignedWaiver") and not u.get("moodleApproved")
    ]
    return {"pendingApprovals": pending}


@router.post("/api/admin/users/{user_id}/approve-moodle")
async def approve_moodle(user_id: str, admin: dict = Depends(get_admin_user)):
    u = users.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.update({
        "moodleApproved":   True,
        "moodleApprovedAt": datetime.utcnow().isoformat(),
        "moodleApprovedBy": admin["id"],
    })
    return {"success": True, "message": f"Moodle course approved for {u['displayName']}"}


@router.post("/api/admin/users/{user_id}/revoke-moodle")
async def revoke_moodle(user_id: str, admin: dict = Depends(get_admin_user)):
    u = users.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u["moodleApproved"] = False
    return {"success": True, "message": f"Moodle approval revoked for {u['displayName']}"}


@router.post("/api/admin/users/{user_id}/grant-admin")
async def grant_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    u = users.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u["isAdmin"] = True
    return {"success": True, "message": f"Admin privileges granted to {u['displayName']}"}


@router.get("/api/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total_rides = sum(len(r) for r in ride_history.values())
    return {
        "totalUsers":    len(users),
        "approvedUsers": sum(1 for u in users.values() if u.get("moodleApproved")),
        "waiverSigned":  sum(1 for u in users.values() if u.get("hasSignedWaiver")),
        "totalRides":    total_rides,
        "timestamp":     datetime.utcnow().isoformat(),
    }
