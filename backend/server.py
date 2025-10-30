from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class RoomCreate(BaseModel):
    name: str
    has_camera: bool = False

class Room(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    has_camera: bool
    is_occupied: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeviceCreate(BaseModel):
    room_id: str
    name: str
    power_rating: float  # in watts
    device_type: str  # fan, light, ac, etc.

class Device(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    name: str
    power_rating: float
    device_type: str
    is_on: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OccupancyUpdate(BaseModel):
    room_id: str
    is_occupied: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PowerLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    device_id: str
    energy_consumed: float  # in Wh
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EnergySaving(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    energy_saved: float  # in Wh
    devices_affected: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardStats(BaseModel):
    total_rooms: int
    occupied_rooms: int
    unoccupied_rooms: int
    total_devices: int
    devices_on: int
    devices_off: int
    total_energy_consumed: float
    total_energy_saved: float
    current_power_usage: float

# Auth helpers
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(**user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# Auth routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(email=user_data.email, name=user_data.name)
    user_dict = user.model_dump()
    user_dict['timestamp'] = user_dict['created_at'].isoformat()
    user_dict['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_dict)
    
    token = create_access_token({"sub": user.id})
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_dict = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_dict or not verify_password(credentials.password, user_dict['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = User(**{k: v for k, v in user_dict.items() if k != 'password'})
    token = create_access_token({"sub": user.id})
    return Token(access_token=token, token_type="bearer", user=user)

# Room routes
@api_router.post("/rooms", response_model=Room)
async def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user)):
    room = Room(**room_data.model_dump())
    room_dict = room.model_dump()
    room_dict['created_at'] = room_dict['created_at'].isoformat()
    if room_dict['last_seen']:
        room_dict['last_seen'] = room_dict['last_seen'].isoformat()
    
    await db.rooms.insert_one(room_dict)
    return room

@api_router.get("/rooms", response_model=List[Room])
async def get_rooms(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(1000)
    for room in rooms:
        if isinstance(room['created_at'], str):
            room['created_at'] = datetime.fromisoformat(room['created_at'])
        if room.get('last_seen') and isinstance(room['last_seen'], str):
            room['last_seen'] = datetime.fromisoformat(room['last_seen'])
    return rooms

@api_router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, current_user: User = Depends(get_current_user)):
    await db.rooms.delete_one({"id": room_id})
    await db.devices.delete_many({"room_id": room_id})
    return {"message": "Room deleted"}

# Device routes
@api_router.post("/devices", response_model=Device)
async def create_device(device_data: DeviceCreate, current_user: User = Depends(get_current_user)):
    device = Device(**device_data.model_dump())
    device_dict = device.model_dump()
    device_dict['created_at'] = device_dict['created_at'].isoformat()
    
    await db.devices.insert_one(device_dict)
    return device

@api_router.get("/devices", response_model=List[Device])
async def get_devices(room_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"room_id": room_id} if room_id else {}
    devices = await db.devices.find(query, {"_id": 0}).to_list(1000)
    for device in devices:
        if isinstance(device['created_at'], str):
            device['created_at'] = datetime.fromisoformat(device['created_at'])
    return devices

@api_router.delete("/devices/{device_id}")
async def delete_device(device_id: str, current_user: User = Depends(get_current_user)):
    await db.devices.delete_one({"id": device_id})
    return {"message": "Device deleted"}

# Occupancy routes
@api_router.post("/occupancy/update")
async def update_occupancy(update: OccupancyUpdate, current_user: User = Depends(get_current_user)):
    room = await db.rooms.find_one({"id": update.room_id}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    update_data = {
        "is_occupied": update.is_occupied,
        "last_seen": update.timestamp.isoformat()
    }
    
    # If room becomes unoccupied, check if we should turn off devices
    if not update.is_occupied:
        # Get last_seen time
        last_seen = datetime.fromisoformat(room.get('last_seen', update.timestamp.isoformat()))
        time_diff = (update.timestamp - last_seen).total_seconds()
        
        # If unoccupied for more than 5 minutes (300 seconds), turn off devices
        if time_diff >= 300 or not room.get('is_occupied', True):
            devices = await db.devices.find({"room_id": update.room_id, "is_on": True}, {"_id": 0}).to_list(1000)
            
            energy_saved = 0
            affected_device_ids = []
            
            for device in devices:
                # Keep one light on for safety
                if device['device_type'] == 'light' and not affected_device_ids:
                    continue
                
                # Calculate energy that would have been consumed
                energy_saved += (device['power_rating'] / 1000) * (time_diff / 3600)  # Convert to kWh
                affected_device_ids.append(device['id'])
                
                # Turn off device
                await db.devices.update_one(
                    {"id": device['id']},
                    {"$set": {"is_on": False}}
                )
            
            # Log energy savings
            if energy_saved > 0:
                saving = EnergySaving(
                    room_id=update.room_id,
                    energy_saved=energy_saved,
                    devices_affected=affected_device_ids
                )
                saving_dict = saving.model_dump()
                saving_dict['timestamp'] = saving_dict['timestamp'].isoformat()
                await db.energy_savings.insert_one(saving_dict)
    else:
        # Room is occupied, turn on devices
        await db.devices.update_many(
            {"room_id": update.room_id},
            {"$set": {"is_on": True}}
        )
    
    await db.rooms.update_one({"id": update.room_id}, {"$set": update_data})
    return {"message": "Occupancy updated", "devices_turned_off": not update.is_occupied}

# Dashboard routes
@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(1000)
    devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
    
    occupied = sum(1 for r in rooms if r.get('is_occupied', False))
    devices_on = sum(1 for d in devices if d.get('is_on', True))
    
    # Calculate total energy consumed (simulated)
    total_consumed = 0
    for device in devices:
        if device.get('is_on', True):
            # Assume device has been running for 1 hour for simulation
            total_consumed += (device['power_rating'] / 1000)  # Convert to kWh
    
    # Get total energy saved
    savings = await db.energy_savings.find({}, {"_id": 0}).to_list(1000)
    total_saved = sum(s['energy_saved'] for s in savings)
    
    # Current power usage (sum of all devices that are on)
    current_power = sum(d['power_rating'] for d in devices if d.get('is_on', True))
    
    return DashboardStats(
        total_rooms=len(rooms),
        occupied_rooms=occupied,
        unoccupied_rooms=len(rooms) - occupied,
        total_devices=len(devices),
        devices_on=devices_on,
        devices_off=len(devices) - devices_on,
        total_energy_consumed=total_consumed,
        total_energy_saved=total_saved,
        current_power_usage=current_power
    )

@api_router.get("/dashboard/energy-trend")
async def get_energy_trend(current_user: User = Depends(get_current_user)):
    # Get last 7 days of data
    savings = await db.energy_savings.find({}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    
    # Group by date
    daily_data = {}
    for saving in savings:
        ts = datetime.fromisoformat(saving['timestamp']) if isinstance(saving['timestamp'], str) else saving['timestamp']
        date_key = ts.strftime('%Y-%m-%d')
        if date_key not in daily_data:
            daily_data[date_key] = 0
        daily_data[date_key] += saving['energy_saved']
    
    return [{"date": k, "energy_saved": v} for k, v in sorted(daily_data.items())]

@api_router.get("/dashboard/room-consumption")
async def get_room_consumption(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(1000)
    result = []
    
    for room in rooms:
        devices = await db.devices.find({"room_id": room['id']}, {"_id": 0}).to_list(1000)
        total_power = sum(d['power_rating'] for d in devices if d.get('is_on', True))
        result.append({
            "room_name": room['name'],
            "power_consumption": total_power
        })
    
    return sorted(result, key=lambda x: x['power_consumption'], reverse=True)

# Simulated occupancy for non-camera rooms
@api_router.post("/simulate-occupancy")
async def simulate_occupancy(current_user: User = Depends(get_current_user)):
    rooms = await db.rooms.find({"has_camera": False}, {"_id": 0}).to_list(1000)
    
    for room in rooms:
        # Randomly simulate occupancy
        is_occupied = random.choice([True, False, False])  # 33% chance occupied
        
        await db.rooms.update_one(
            {"id": room['id']},
            {"$set": {
                "is_occupied": is_occupied,
                "last_seen": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update devices accordingly
        if is_occupied:
            await db.devices.update_many(
                {"room_id": room['id']},
                {"$set": {"is_on": True}}
            )
        else:
            devices = await db.devices.find({"room_id": room['id'], "is_on": True}, {"_id": 0}).to_list(1000)
            for idx, device in enumerate(devices):
                # Keep first light on
                if idx == 0 and device['device_type'] == 'light':
                    continue
                await db.devices.update_one(
                    {"id": device['id']},
                    {"$set": {"is_on": False}}
                )
    
    return {"message": "Simulated occupancy updated"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
