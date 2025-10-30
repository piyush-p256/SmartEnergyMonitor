from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import random
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import asyncio
from mistralai import Mistral

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Mistral AI setup
mistral_api_key = os.environ.get('MISTRAL_API_KEY', '')
mistral_client = Mistral(api_key=mistral_api_key) if mistral_api_key else None

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Scheduler for hourly tasks
scheduler = AsyncIOScheduler()

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
    last_state_change: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DeviceStateChange(BaseModel):
    device_id: str
    is_on: bool

class OccupancyUpdate(BaseModel):
    room_id: str
    is_occupied: bool
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HourlyPowerLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    room_id: str
    device_id: str
    device_name: str
    power_rating: float
    energy_consumed_wh: float  # Watt-hours for this hour
    hour_start: datetime
    hour_end: datetime
    was_on: bool
    minutes_on: float  # Minutes device was on during this hour

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

class HourlyConsumptionResponse(BaseModel):
    hour: str
    total_consumption_wh: float
    total_consumption_kwh: float
    room_breakdown: List[Dict]

class AIInsight(BaseModel):
    insight_type: str  # 'prediction', 'anomaly', 'cost', 'recommendation'
    content: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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

# Background task: Log hourly power consumption
async def log_hourly_consumption():
    """Background task that runs every hour to log power consumption"""
    try:
        logging.info("Starting hourly power consumption logging...")
        
        now = datetime.now(timezone.utc)
        hour_start = now.replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
        hour_end = now.replace(minute=0, second=0, microsecond=0)
        
        # Get all devices
        devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
        
        for device in devices:
            # Get device state changes during this hour
            last_state_change = device.get('last_state_change')
            if isinstance(last_state_change, str):
                last_state_change = datetime.fromisoformat(last_state_change)
            
            is_on = device.get('is_on', True)
            
            # Calculate how long the device was on during this hour
            if is_on:
                # Device is currently on
                if last_state_change and last_state_change > hour_start:
                    # Device was turned on during this hour
                    minutes_on = (hour_end - last_state_change).total_seconds() / 60
                else:
                    # Device was on for the entire hour
                    minutes_on = 60
            else:
                # Device is currently off
                if last_state_change and last_state_change > hour_start and last_state_change < hour_end:
                    # Device was turned off during this hour
                    minutes_on = (last_state_change - hour_start).total_seconds() / 60
                else:
                    # Device was off for the entire hour
                    minutes_on = 0
            
            # Calculate energy consumed
            power_rating = device['power_rating']  # in watts
            energy_consumed_wh = (power_rating * minutes_on) / 60  # Watt-hours
            
            # Create hourly log
            log = HourlyPowerLog(
                room_id=device['room_id'],
                device_id=device['id'],
                device_name=device['name'],
                power_rating=power_rating,
                energy_consumed_wh=energy_consumed_wh,
                hour_start=hour_start,
                hour_end=hour_end,
                was_on=minutes_on > 0,
                minutes_on=minutes_on
            )
            
            log_dict = log.model_dump()
            log_dict['hour_start'] = log_dict['hour_start'].isoformat()
            log_dict['hour_end'] = log_dict['hour_end'].isoformat()
            
            await db.hourly_power_logs.insert_one(log_dict)
        
        logging.info(f"Logged consumption for {len(devices)} devices")
        
    except Exception as e:
        logging.error(f"Error in hourly consumption logging: {e}")

# AI Helper Functions
async def get_ai_prediction(consumption_data: List[float], days_ahead: int = 7) -> str:
    """Get AI prediction for future consumption"""
    if not mistral_client:
        return "AI predictions not available (API key not configured)"
    
    try:
        avg_consumption = sum(consumption_data) / len(consumption_data) if consumption_data else 0
        max_consumption = max(consumption_data) if consumption_data else 0
        min_consumption = min(consumption_data) if consumption_data else 0
        
        prompt = f"""Based on the following energy consumption data:
- Average daily consumption: {avg_consumption:.2f} kWh
- Peak consumption: {max_consumption:.2f} kWh
- Minimum consumption: {min_consumption:.2f} kWh

Predict the energy consumption for the next {days_ahead} days and provide:
1. Expected average daily consumption
2. Factors that might increase consumption
3. Recommendations to optimize usage

Keep response concise and actionable."""

        response = mistral_client.chat.complete(
            model=os.environ.get('MISTRAL_MODEL', 'mistral-large-latest'),
            messages=[{"role": "user", "content": prompt}]
        )
        
        if response.choices:
            return response.choices[0].message.content
        return "Unable to generate prediction"
    
    except Exception as e:
        logging.error(f"AI prediction error: {e}")
        return f"Error generating prediction: {str(e)}"

async def detect_anomalies_ai(consumption_data: List[Dict]) -> str:
    """Use AI to detect anomalies in consumption patterns"""
    if not mistral_client:
        return "AI anomaly detection not available (API key not configured)"
    
    try:
        # Find unusual spikes
        values = [d['consumption'] for d in consumption_data]
        avg = sum(values) / len(values) if values else 0
        anomalies = [d for d in consumption_data if d['consumption'] > avg * 1.5]
        
        if not anomalies:
            return "No significant anomalies detected in recent consumption patterns."
        
        prompt = f"""Analyze these energy consumption anomalies:
- Average consumption: {avg:.2f} kWh
- Anomalies detected: {len(anomalies)}
- Spike values: {[a['consumption'] for a in anomalies[:3]]}

Provide:
1. Possible causes for these anomalies
2. Risk assessment
3. Immediate action items

Be specific and concise."""

        response = mistral_client.chat.complete(
            model=os.environ.get('MISTRAL_MODEL', 'mistral-large-latest'),
            messages=[{"role": "user", "content": prompt}]
        )
        
        if response.choices:
            return response.choices[0].message.content
        return "Unable to analyze anomalies"
    
    except Exception as e:
        logging.error(f"AI anomaly detection error: {e}")
        return f"Error detecting anomalies: {str(e)}"

async def estimate_costs_ai(consumption_kwh: float, rate_per_kwh: float = 0.12) -> str:
    """Estimate costs and provide AI recommendations"""
    if not mistral_client:
        return f"Estimated cost: ${consumption_kwh * rate_per_kwh:.2f} (AI insights not available)"
    
    try:
        current_cost = consumption_kwh * rate_per_kwh
        
        prompt = f"""Current energy consumption and cost:
- Monthly consumption: {consumption_kwh:.2f} kWh
- Rate: ${rate_per_kwh}/kWh
- Current monthly cost: ${current_cost:.2f}

Provide:
1. Cost-saving strategies
2. Expected savings from each strategy
3. Payback period for any investments
4. Priority ranking of recommendations

Keep it concise and actionable."""

        response = mistral_client.chat.complete(
            model=os.environ.get('MISTRAL_MODEL', 'mistral-large-latest'),
            messages=[{"role": "user", "content": prompt}]
        )
        
        if response.choices:
            return f"Current Cost: ${current_cost:.2f}\n\n{response.choices[0].message.content}"
        return f"Estimated cost: ${current_cost:.2f}"
    
    except Exception as e:
        logging.error(f"AI cost estimation error: {e}")
        return f"Estimated cost: ${consumption_kwh * rate_per_kwh:.2f} (AI error: {str(e)})"

async def get_smart_recommendations_ai(
    rooms: List[Dict],
    devices: List[Dict],
    consumption_data: List[Dict]
) -> str:
    """Get smart recommendations based on usage patterns"""
    if not mistral_client:
        return "AI recommendations not available (API key not configured)"
    
    try:
        total_devices = len(devices)
        devices_on = sum(1 for d in devices if d.get('is_on', True))
        avg_consumption = sum(d['consumption'] for d in consumption_data) / len(consumption_data) if consumption_data else 0
        
        prompt = f"""Smart home energy analysis:
- Total rooms: {len(rooms)}
- Total devices: {total_devices}
- Devices currently on: {devices_on}
- Average consumption: {avg_consumption:.2f} kWh

Provide smart recommendations:
1. Optimal scheduling for devices
2. Room-specific optimizations
3. Automation suggestions
4. Expected impact of each recommendation

Prioritize by potential savings."""

        response = mistral_client.chat.complete(
            model=os.environ.get('MISTRAL_MODEL', 'mistral-large-latest'),
            messages=[{"role": "user", "content": prompt}]
        )
        
        if response.choices:
            return response.choices[0].message.content
        return "Unable to generate recommendations"
    
    except Exception as e:
        logging.error(f"AI recommendations error: {e}")
        return f"Error generating recommendations: {str(e)}"

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
    device_dict['last_state_change'] = device_dict['last_state_change'].isoformat()
    
    await db.devices.insert_one(device_dict)
    return device

@api_router.get("/devices", response_model=List[Device])
async def get_devices(room_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"room_id": room_id} if room_id else {}
    devices = await db.devices.find(query, {"_id": 0}).to_list(1000)
    for device in devices:
        if isinstance(device['created_at'], str):
            device['created_at'] = datetime.fromisoformat(device['created_at'])
        if 'last_state_change' in device and isinstance(device['last_state_change'], str):
            device['last_state_change'] = datetime.fromisoformat(device['last_state_change'])
    return devices

@api_router.put("/devices/{device_id}/state")
async def update_device_state(
    device_id: str,
    state_change: DeviceStateChange,
    current_user: User = Depends(get_current_user)
):
    """Update device on/off state and track state change time"""
    await db.devices.update_one(
        {"id": device_id},
        {"$set": {
            "is_on": state_change.is_on,
            "last_state_change": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Device state updated", "device_id": device_id, "is_on": state_change.is_on}

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
    
    # If room becomes unoccupied, turn off ALL devices immediately
    if not update.is_occupied:
        devices = await db.devices.find({"room_id": update.room_id, "is_on": True}, {"_id": 0}).to_list(1000)
        
        energy_saved = 0
        affected_device_ids = []
        
        # Turn off ALL devices when room is unoccupied
        for device in devices:
            # Calculate potential energy saved (estimate 1 hour)
            energy_saved += (device['power_rating'] / 1000)  # 1 hour worth in kWh
            affected_device_ids.append(device['id'])
            
            # Turn off device
            await db.devices.update_many(
                {"room_id": update.room_id, "is_on": True},
                {"$set": {
                    "is_on": False,
                    "last_state_change": datetime.now(timezone.utc).isoformat()
                }}
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
            {"$set": {
                "is_on": True,
                "last_state_change": datetime.now(timezone.utc).isoformat()
            }}
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
    
    # Calculate total energy consumed from hourly logs
    logs = await db.hourly_power_logs.find({}, {"_id": 0}).to_list(10000)
    total_consumed = sum(log['energy_consumed_wh'] for log in logs) / 1000  # Convert to kWh
    
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

# Hourly consumption endpoints
@api_router.get("/consumption/hourly")
async def get_hourly_consumption(
    date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get hourly consumption - optionally for a specific date or last 24 hours"""
    try:
        if date:
            # Parse the date and get consumption for that specific day
            target_date = datetime.fromisoformat(date)
            start_time = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_time = start_time + timedelta(days=1)
        else:
            # Get last 24 hours
            end_time = datetime.now(timezone.utc)
            start_time = end_time - timedelta(hours=24)
        
        # Get logs for the time period
        logs = await db.hourly_power_logs.find({
            "hour_start": {
                "$gte": start_time.isoformat(),
                "$lt": end_time.isoformat()
            }
        }, {"_id": 0}).to_list(10000)
        
        # Group by hour
        hourly_data = {}
        for log in logs:
            hour_start = log['hour_start']
            if hour_start not in hourly_data:
                hourly_data[hour_start] = {
                    "total_wh": 0,
                    "rooms": {}
                }
            
            room_id = log['room_id']
            if room_id not in hourly_data[hour_start]["rooms"]:
                # Get room name
                room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
                room_name = room['name'] if room else "Unknown Room"
                hourly_data[hour_start]["rooms"][room_id] = {
                    "room_name": room_name,
                    "consumption_wh": 0,
                    "devices": []
                }
            
            hourly_data[hour_start]["total_wh"] += log['energy_consumed_wh']
            hourly_data[hour_start]["rooms"][room_id]["consumption_wh"] += log['energy_consumed_wh']
            hourly_data[hour_start]["rooms"][room_id]["devices"].append({
                "device_name": log['device_name'],
                "consumption_wh": log['energy_consumed_wh'],
                "minutes_on": log['minutes_on']
            })
        
        # Format response
        result = []
        for hour_start, data in sorted(hourly_data.items()):
            room_breakdown = [
                {
                    "room_id": room_id,
                    "room_name": room_data["room_name"],
                    "consumption_wh": room_data["consumption_wh"],
                    "consumption_kwh": room_data["consumption_wh"] / 1000,
                    "devices": room_data["devices"]
                }
                for room_id, room_data in data["rooms"].items()
            ]
            
            result.append({
                "hour": hour_start,
                "total_consumption_wh": data["total_wh"],
                "total_consumption_kwh": data["total_wh"] / 1000,
                "room_breakdown": room_breakdown
            })
        
        return {
            "period_start": start_time.isoformat(),
            "period_end": end_time.isoformat(),
            "hourly_data": result,
            "total_consumption_kwh": sum(h["total_consumption_kwh"] for h in result)
        }
    
    except Exception as e:
        logging.error(f"Error getting hourly consumption: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/consumption/room/{room_id}")
async def get_room_consumption(
    room_id: str,
    hours: int = 24,
    current_user: User = Depends(get_current_user)
):
    """Get consumption for a specific room over time"""
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    logs = await db.hourly_power_logs.find({
        "room_id": room_id,
        "hour_start": {
            "$gte": start_time.isoformat(),
            "$lt": end_time.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    # Group by hour
    hourly_consumption = {}
    for log in logs:
        hour = log['hour_start']
        if hour not in hourly_consumption:
            hourly_consumption[hour] = 0
        hourly_consumption[hour] += log['energy_consumed_wh']
    
    result = [
        {
            "hour": hour,
            "consumption_wh": consumption,
            "consumption_kwh": consumption / 1000
        }
        for hour, consumption in sorted(hourly_consumption.items())
    ]
    
    return {
        "room_id": room_id,
        "period_hours": hours,
        "hourly_consumption": result,
        "total_consumption_kwh": sum(h["consumption_kwh"] for h in result)
    }

# AI Insights endpoints
@api_router.get("/ai/predictions")
async def get_predictions(
    days_ahead: int = 7,
    current_user: User = Depends(get_current_user)
):
    """Get AI predictions for future consumption"""
    # Get recent consumption data
    logs = await db.hourly_power_logs.find({}, {"_id": 0}).sort("hour_start", -1).to_list(168)  # Last 7 days
    
    # Calculate daily consumption
    daily_consumption = {}
    for log in logs:
        date = log['hour_start'][:10]  # Extract date
        if date not in daily_consumption:
            daily_consumption[date] = 0
        daily_consumption[date] += log['energy_consumed_wh'] / 1000  # Convert to kWh
    
    consumption_values = list(daily_consumption.values())
    prediction = await get_ai_prediction(consumption_values, days_ahead)
    
    return {
        "prediction": prediction,
        "historical_data": daily_consumption,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/ai/anomalies")
async def detect_anomalies(current_user: User = Depends(get_current_user)):
    """Detect anomalies in consumption patterns using AI"""
    # Get recent hourly data
    logs = await db.hourly_power_logs.find({}, {"_id": 0}).sort("hour_start", -1).to_list(168)
    
    # Aggregate by hour
    hourly_data = {}
    for log in logs:
        hour = log['hour_start']
        if hour not in hourly_data:
            hourly_data[hour] = 0
        hourly_data[hour] += log['energy_consumed_wh'] / 1000  # kWh
    
    consumption_data = [
        {"hour": hour, "consumption": consumption}
        for hour, consumption in hourly_data.items()
    ]
    
    analysis = await detect_anomalies_ai(consumption_data)
    
    return {
        "analysis": analysis,
        "data_points_analyzed": len(consumption_data),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/ai/cost-estimation")
async def estimate_costs(
    rate_per_kwh: float = 0.12,
    current_user: User = Depends(get_current_user)
):
    """Estimate costs and get AI recommendations"""
    # Get last 30 days consumption
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=30)
    
    logs = await db.hourly_power_logs.find({
        "hour_start": {
            "$gte": start_time.isoformat(),
            "$lt": end_time.isoformat()
        }
    }, {"_id": 0}).to_list(10000)
    
    total_consumption_kwh = sum(log['energy_consumed_wh'] for log in logs) / 1000
    
    estimation = await estimate_costs_ai(total_consumption_kwh, rate_per_kwh)
    
    return {
        "consumption_kwh": total_consumption_kwh,
        "rate_per_kwh": rate_per_kwh,
        "cost_analysis": estimation,
        "period_days": 30,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/ai/recommendations")
async def get_recommendations(current_user: User = Depends(get_current_user)):
    """Get smart recommendations based on usage patterns"""
    rooms = await db.rooms.find({}, {"_id": 0}).to_list(1000)
    devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
    
    # Get recent consumption
    logs = await db.hourly_power_logs.find({}, {"_id": 0}).sort("hour_start", -1).to_list(168)
    
    hourly_data = {}
    for log in logs:
        hour = log['hour_start']
        if hour not in hourly_data:
            hourly_data[hour] = 0
        hourly_data[hour] += log['energy_consumed_wh'] / 1000
    
    consumption_data = [
        {"hour": hour, "consumption": consumption}
        for hour, consumption in hourly_data.items()
    ]
    
    recommendations = await get_smart_recommendations_ai(rooms, devices, consumption_data)
    
    return {
        "recommendations": recommendations,
        "total_rooms": len(rooms),
        "total_devices": len(devices),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

# Generate sample historical data
@api_router.post("/admin/generate-sample-data")
async def generate_sample_data(
    days: int = 7,
    current_user: User = Depends(get_current_user)
):
    """Generate sample historical data for testing"""
    try:
        # Get all devices
        devices = await db.devices.find({}, {"_id": 0}).to_list(1000)
        
        if not devices:
            raise HTTPException(status_code=400, detail="No devices found. Create rooms and devices first.")
        
        # Generate data for past days
        end_time = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        
        logs_created = 0
        for day_offset in range(days):
            for hour_offset in range(24):
                hour_start = end_time - timedelta(days=day_offset, hours=hour_offset+1)
                hour_end = hour_start + timedelta(hours=1)
                
                for device in devices:
                    # Simulate realistic on/off patterns
                    is_daytime = 6 <= hour_start.hour < 22
                    
                    if device['device_type'] == 'light':
                        minutes_on = random.uniform(40, 60) if not is_daytime else random.uniform(0, 20)
                    elif device['device_type'] == 'ac':
                        minutes_on = random.uniform(30, 60) if is_daytime else random.uniform(10, 30)
                    elif device['device_type'] == 'fan':
                        minutes_on = random.uniform(20, 60) if is_daytime else random.uniform(0, 30)
                    else:
                        minutes_on = random.uniform(0, 60)
                    
                    power_rating = device['power_rating']
                    energy_consumed_wh = (power_rating * minutes_on) / 60
                    
                    log = HourlyPowerLog(
                        room_id=device['room_id'],
                        device_id=device['id'],
                        device_name=device['name'],
                        power_rating=power_rating,
                        energy_consumed_wh=energy_consumed_wh,
                        hour_start=hour_start,
                        hour_end=hour_end,
                        was_on=minutes_on > 0,
                        minutes_on=minutes_on
                    )
                    
                    log_dict = log.model_dump()
                    log_dict['hour_start'] = log_dict['hour_start'].isoformat()
                    log_dict['hour_end'] = log_dict['hour_end'].isoformat()
                    
                    await db.hourly_power_logs.insert_one(log_dict)
                    logs_created += 1
        
        return {
            "message": "Sample data generated successfully",
            "logs_created": logs_created,
            "days_generated": days,
            "devices": len(devices)
        }
    
    except Exception as e:
        logging.error(f"Error generating sample data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
async def get_room_consumption_summary(current_user: User = Depends(get_current_user)):
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
                {"$set": {
                    "is_on": True,
                    "last_state_change": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            devices = await db.devices.find({"room_id": room['id'], "is_on": True}, {"_id": 0}).to_list(1000)
            for idx, device in enumerate(devices):
                # Keep first light on
                if idx == 0 and device['device_type'] == 'light':
                    continue
                await db.devices.update_one(
                    {"id": device['id']},
                    {"$set": {
                        "is_on": False,
                        "last_state_change": datetime.now(timezone.utc).isoformat()
                    }}
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

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on startup"""
    try:
        # Schedule hourly consumption logging
        scheduler.add_job(
            log_hourly_consumption,
            CronTrigger(minute=0),  # Run at the start of every hour
            id='hourly_consumption_log',
            replace_existing=True
        )
        scheduler.start()
        logger.info("Scheduler started - hourly consumption logging enabled")
    except Exception as e:
        logger.error(f"Error starting scheduler: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    try:
        scheduler.shutdown()
        client.close()
        logger.info("Application shutdown complete")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
