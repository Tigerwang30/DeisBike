import os
import sys
from datetime import datetime

# Ensure project root is in sys.path so "from api._routes import ..." works on Vercel
_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from api._routes import auth, bikes, command, rides, reports, admin

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("CLIENT_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
)

app.include_router(auth.router)
app.include_router(bikes.router)
app.include_router(command.router)
app.include_router(rides.router)
app.include_router(reports.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
