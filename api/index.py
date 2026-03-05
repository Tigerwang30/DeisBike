import os
import io
import time
import httpx
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, StreamingResponse
from mangum import Mangum
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:3000")
IS_PROD    = os.getenv("NODE_ENV") == "production"
SECRET     = os.getenv("SESSION_SECRET", "deisbikes-dev-secret")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores (resets on cold start — acceptable for demo) ──
active_sessions: dict = {}
ride_history:    dict = {}
users:           dict = {}


# ── JWT helpers ──

def create_token(user: dict) -> str:
    payload = {**user, "exp": datetime.utcnow() + timedelta(hours=24)}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])
    except Exception:
        return None


def get_current_user(request: Request) -> dict:
    token = request.cookies.get("auth_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = decode_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


def get_admin_user(request: Request) -> dict:
    user = get_current_user(request)
    if not user.get("isAdmin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── LINKA helpers ──

def _linka_headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-Auth-Token": os.getenv("LINKA_ACCESS_TOKEN", ""),
        "X-User-Id":    os.getenv("LINKA_USER_ID", ""),
        "Origin":       "https://fleetview.linkalock.com",
        "Referer":      "https://fleetview.linkalock.com/",
    }


def _command_body() -> dict:
    return {
        "access_token":     os.getenv("LINKA_LOCK_TOKEN", ""),
        "mac_addr":         os.getenv("LINKA_MAC_ADDR", ""),
        "schedule":         True,
        "firmware_version": "2.6.15",
        "smartkey_mac":     "",
    }


async def call_linka(endpoint: str, body: Optional[dict] = None) -> dict:
    if not os.getenv("LINKA_API_KEY"):
        return {"success": True, "simulated": True}
    base   = os.getenv("LINKA_API_BASE_URL", "https://app.linkalock.com/api/merchant_api")
    method = "POST" if body else "GET"
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method, f"{base}{endpoint}",
            headers=_linka_headers(), json=body, timeout=10.0,
        )
    if not resp.is_success:
        raise HTTPException(status_code=502, detail=f"LINKA API error: {resp.status_code}")
    return resp.json() if resp.content else {}


# ── Auth routes ──

@app.get("/auth/dev-login")
async def dev_login():
    if os.getenv("NODE_ENV") != "development":
        raise HTTPException(status_code=404, detail="Not found")

    dev_user = {
        "id":              "dev-user-001",
        "email":           "devuser@brandeis.edu",
        "displayName":     "Dev User",
        "photo":           None,
        "hasSignedWaiver": True,
        "moodleApproved":  True,
        "isAdmin":         True,
    }
    users[dev_user["id"]] = dev_user

    token    = create_token(dev_user)
    redirect = RedirectResponse(url=f"{CLIENT_URL}/map", status_code=302)
    redirect.set_cookie("auth_token", token, httponly=True, samesite="lax",
                        secure=IS_PROD, max_age=86400)
    return redirect


@app.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id":              user["id"],
        "email":           user["email"],
        "displayName":     user["displayName"],
        "photo":           user.get("photo"),
        "hasSignedWaiver": user.get("hasSignedWaiver", False),
        "moodleApproved":  user.get("moodleApproved", False),
        "isAdmin":         user.get("isAdmin", False),
    }


@app.post("/auth/waiver")
async def sign_waiver(request: Request, response: Response,
                      user: dict = Depends(get_current_user)):
    body = await request.json()
    if not body.get("agreed"):
        raise HTTPException(status_code=400, detail="You must agree to the waiver")

    updated = {**user, "hasSignedWaiver": True}
    token   = create_token(updated)
    response.set_cookie("auth_token", token, httponly=True, samesite="lax",
                        secure=IS_PROD, max_age=86400)
    return {
        "success":  True,
        "message":  "Waiver signed successfully",
        "nextStep": "/map" if updated.get("moodleApproved") else "/safety-course",
    }


@app.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("auth_token")
    return {"success": True, "message": "Logged out successfully"}


@app.get("/auth/status")
async def auth_status(request: Request):
    token = request.cookies.get("auth_token")
    if not token:
        return {"authenticated": False, "user": None}
    user = decode_token(token)
    if not user:
        return {"authenticated": False, "user": None}
    return {
        "authenticated": True,
        "user": {
            "displayName":     user.get("displayName"),
            "hasSignedWaiver": user.get("hasSignedWaiver", False),
            "moodleApproved":  user.get("moodleApproved", False),
        },
    }


# ── Bike routes ──

BIKES = [
    {"id": "5000", "name": "Leo2 Pro — 125Q03004310", "location": "Main Campus", "available": True},
]


@app.get("/api/bikes")
async def list_bikes(user: dict = Depends(get_current_user)):
    return BIKES


@app.get("/api/bikes/locations/all")
async def bike_locations(user: dict = Depends(get_current_user)):
    return [
        {"id": b["id"], "lat": 42.3655, "lng": -71.2595, "available": b["available"]}
        for b in BIKES
    ]


# ── Command routes ──

@app.post("/api/command")
async def command(request: Request, user: dict = Depends(get_current_user)):
    body       = await request.json()
    action     = body.get("action")
    bike_id    = body.get("bikeId")
    session_id = body.get("sessionId")

    if action == "open":
        await call_linka("/command_unlock", _command_body())
        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        active_sessions[sid] = {
            "sessionId": sid, "bikeId": bike_id, "userId": user["id"],
            "startTime": datetime.utcnow().isoformat(), "status": "ride_active",
        }
        return {
            "success": True, "sessionId": sid, "bikeId": bike_id,
            "startTime": active_sessions[sid]["startTime"],
            "message": "Bike unlocked! Enjoy your ride.", "status": "ride_active",
        }

    if action == "unlock_chain":
        await call_linka("/command_unlock", _command_body())
        sid = f"session-{int(time.time() * 1000)}-{user['id']}"
        active_sessions[sid] = {
            "sessionId": sid, "bikeId": bike_id, "userId": user["id"],
            "chainUnlocked": True, "wheelUnlocked": False,
            "startTime": None, "status": "chain_unlocked",
        }
        return {
            "success": True, "sessionId": sid,
            "message": "Chain unlocked. Please secure the chain and confirm.",
            "nextStep": "confirm_chain_secured",
        }

    if action == "unlock_wheel":
        session = active_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session. Please start over.")
        await call_linka("/command_unlock", _command_body())
        session.update({
            "wheelUnlocked": True,
            "startTime": datetime.utcnow().isoformat(),
            "status": "ride_active",
        })
        return {
            "success": True, "sessionId": session_id, "bikeId": session["bikeId"],
            "startTime": session["startTime"],
            "message": "Bike unlocked! Enjoy your ride.", "status": "ride_active",
        }

    if action == "lock":
        session = active_sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=400, detail="Invalid session.")
        await call_linka("/command_lock", _command_body())
        end_time = datetime.utcnow()
        start    = datetime.fromisoformat(session["startTime"]) if session.get("startTime") else end_time
        duration = int((end_time - start).total_seconds() / 60)

        ride_record = {
            **session,
            "rideId":   session_id,
            "endTime":  end_time.isoformat(),
            "duration": duration,
            "status":   "completed",
        }
        ride_history.setdefault(session["userId"], []).insert(0, ride_record)
        del active_sessions[session_id]

        return {
            "success":   True,
            "rideId":    session_id,
            "bikeId":    ride_record["bikeId"],
            "startTime": ride_record["startTime"],
            "endTime":   ride_record["endTime"],
            "duration":  duration,
            "message":   f"Ride completed. Duration: {duration} minutes.",
        }

    raise HTTPException(status_code=400, detail="Invalid action")


# ── Ride routes ──

@app.get("/api/rides/active")
async def get_active_ride(user: dict = Depends(get_current_user)):
    for sid, session in active_sessions.items():
        if session["userId"] == user["id"] and session["status"] == "ride_active":
            start         = datetime.fromisoformat(session["startTime"])
            duration_mins = int((datetime.utcnow() - start).total_seconds() / 60)
            return {
                "active": True, "sessionId": sid, "bikeId": session["bikeId"],
                "startTime": session["startTime"], "currentDuration": duration_mins,
            }
    return {"active": False}


@app.get("/api/rides/history")
async def get_ride_history(user: dict = Depends(get_current_user)):
    return ride_history.get(user["id"], [])


# ── Report routes ──

@app.get("/api/reports/ride/{ride_id}/pdf")
async def ride_pdf(ride_id: str, user: dict = Depends(get_current_user)):
    rides = ride_history.get(user["id"], [])
    ride  = next((r for r in rides if r.get("rideId") == ride_id), None)
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    pdf = _generate_ride_pdf(ride, user)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=ride-{ride_id}.pdf"})


@app.get("/api/reports/history/pdf")
async def history_pdf(user: dict = Depends(get_current_user)):
    rides = ride_history.get(user["id"], [])
    if not rides:
        raise HTTPException(status_code=404, detail="No rides found")
    pdf = _generate_history_pdf(rides, user)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=ride-history-{int(time.time())}.pdf"})


@app.get("/api/reports/summary")
async def report_summary(user: dict = Depends(get_current_user)):
    rides          = ride_history.get(user["id"], [])
    total          = len(rides)
    total_duration = sum(r.get("duration", 0) for r in rides)
    return {
        "totalRides":      total,
        "totalDuration":   total_duration,
        "averageDuration": round(total_duration / total) if total else 0,
        "firstRide":       rides[-1]["startTime"] if rides else None,
        "lastRide":        rides[0]["startTime"]  if rides else None,
    }


# ── Admin routes ──

@app.get("/api/admin/users")
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


@app.get("/api/admin/pending-approvals")
async def pending_approvals(admin: dict = Depends(get_admin_user)):
    pending = [
        {
            "id":            u["id"],
            "email":         u["email"],
            "displayName":   u["displayName"],
            "waiverSignedAt": u.get("waiverSignedAt"),
            "createdAt":     u.get("createdAt"),
        }
        for u in users.values()
        if u.get("hasSignedWaiver") and not u.get("moodleApproved")
    ]
    return {"pendingApprovals": pending}


@app.post("/api/admin/users/{user_id}/approve-moodle")
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


@app.post("/api/admin/users/{user_id}/revoke-moodle")
async def revoke_moodle(user_id: str, admin: dict = Depends(get_admin_user)):
    u = users.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u["moodleApproved"] = False
    return {"success": True, "message": f"Moodle approval revoked for {u['displayName']}"}


@app.post("/api/admin/users/{user_id}/grant-admin")
async def grant_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    u = users.get(user_id)
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u["isAdmin"] = True
    return {"success": True, "message": f"Admin privileges granted to {u['displayName']}"}


@app.get("/api/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total_rides = sum(len(r) for r in ride_history.values())
    return {
        "totalUsers":    len(users),
        "approvedUsers": sum(1 for u in users.values() if u.get("moodleApproved")),
        "waiverSigned":  sum(1 for u in users.values() if u.get("hasSignedWaiver")),
        "totalRides":    total_rides,
        "timestamp":     datetime.utcnow().isoformat(),
    }


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ── PDF helpers ──

def _generate_ride_pdf(ride: dict, user: dict) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as rl_canvas

    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=letter)
    w, h = letter

    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w / 2, h - inch, "DeisBikes")
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 1.4 * inch, "Brandeis University Bike Share")
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 2.2 * inch, "Ride Receipt")
    c.moveTo(50, h - 2.6 * inch)
    c.lineTo(w - 50, h - 2.6 * inch)
    c.stroke()

    y = h - 3 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Rider Information")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    c.drawString(inch, y, f"Name: {user.get('displayName', 'N/A')}")
    y -= 0.25 * inch
    c.drawString(inch, y, f"Email: {user.get('email', 'N/A')}")
    y -= 0.45 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Ride Details")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    for label, val in [
        ("Ride ID",    ride.get("rideId",    "N/A")),
        ("Bike ID",    ride.get("bikeId",    "N/A")),
        ("Start Time", str(ride.get("startTime", "N/A"))),
        ("End Time",   str(ride.get("endTime",   "N/A"))),
        ("Duration",   f"{ride.get('duration', 0)} minutes"),
    ]:
        c.drawString(inch, y, f"{label}: {val}")
        y -= 0.25 * inch

    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, inch, f"Generated on {datetime.utcnow().strftime('%B %d, %Y %I:%M %p')}")
    c.drawCentredString(w / 2, 0.75 * inch, "Thank you for using DeisBikes!")
    c.save()
    return buf.getvalue()


def _generate_history_pdf(rides: list, user: dict) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas as rl_canvas

    buf = io.BytesIO()
    c   = rl_canvas.Canvas(buf, pagesize=letter)
    w, h = letter

    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w / 2, h - inch, "DeisBikes")
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 1.4 * inch, "Brandeis University Bike Share")
    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(w / 2, h - 2.2 * inch, "Ride History Report")

    total_duration = sum(r.get("duration", 0) for r in rides)
    y = h - 3 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Summary")
    y -= 0.3 * inch
    c.setFont("Helvetica", 12)
    c.drawString(inch, y, f"Name: {user.get('displayName', 'N/A')}")
    y -= 0.25 * inch
    c.drawString(inch, y, f"Total Rides: {len(rides)}  |  Total Time: {total_duration} minutes")
    y -= 0.5 * inch

    c.setFont("Helvetica-Bold", 12)
    c.drawString(inch, y, "Ride History")
    y -= 0.35 * inch

    for i, ride in enumerate(rides):
        if y < 1.5 * inch:
            c.showPage()
            y = h - inch
        c.setFont("Helvetica-Bold", 11)
        c.drawString(inch, y, f"Ride {i + 1}")
        y -= 0.25 * inch
        c.setFont("Helvetica", 11)
        c.drawString(inch, y,
                     f"  Bike: {ride.get('bikeId', 'N/A')} | "
                     f"Duration: {ride.get('duration', 0)} min | "
                     f"{str(ride.get('startTime', 'N/A'))[:19]}")
        y -= 0.35 * inch

    c.setFont("Helvetica", 10)
    c.drawCentredString(w / 2, inch, f"Generated on {datetime.utcnow().strftime('%B %d, %Y %I:%M %p')}")
    c.save()
    return buf.getvalue()


# ── Vercel ASGI handler ──
handler = Mangum(app)
