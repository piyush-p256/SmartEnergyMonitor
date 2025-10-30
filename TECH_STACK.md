# Smart Energy Watcher - Technology Stack

## Backend Technologies

### Core Framework
- **FastAPI** (v0.110.1) - Modern Python web framework for building APIs
- **Uvicorn** - ASGI server for running FastAPI
- **Motor** (v3.3.1) - Async MongoDB driver for Python
- **MongoDB** - NoSQL database for storing rooms, devices, users, and energy data

### Authentication & Security
- **JWT (PyJWT)** - JSON Web Tokens for user authentication
- **Bcrypt** - Password hashing
- **Passlib** - Password validation and hashing utilities

### Data Validation
- **Pydantic** (v2.6.4+) - Data validation using Python type annotations

## Frontend Technologies

### Core Framework
- **React** (v19.2.0) - JavaScript library for building user interfaces
- **React Router DOM** (v7.9.5) - Client-side routing

### UI Components
- **Shadcn/UI** - Component library built on Radix UI
- **Radix UI** - Unstyled, accessible component primitives
- **Tailwind CSS** (v3.4.18) - Utility-first CSS framework
- **Lucide React** - Icon library

### AI/ML Detection
- **MediaPipe Tasks Vision** (v0.10.22) - Google's ML solutions for human pose detection
- **React Webcam** (v7.2.0) - Webcam component for React

### Data Visualization
- **Recharts** (v3.3.0) - Composable charting library for React
- Line charts for energy savings trends
- Bar charts for room power consumption

### State Management & Forms
- **React Hook Form** (v7.65.0) - Form validation and management
- **Axios** (v1.13.1) - HTTP client for API calls

### Notifications
- **Sonner** (v2.0.7) - Toast notification library

## Development Tools

### Build & Bundling
- **Craco** (v7.1.0) - Create React App Configuration Override
- **Webpack** (v5.102.1) - Module bundler
- **Babel** - JavaScript compiler

### Code Quality
- **ESLint** (v9.23.0) - JavaScript linter
- **Autoprefixer** (v10.4.21) - PostCSS plugin for CSS vendor prefixes

## Architecture

```
┌─────────────────┐
│  React Frontend │ (Port 3000)
│  - Webcam Feed  │
│  - MediaPipe    │
│  - Dashboard    │
└────────┬────────┘
         │ HTTPS/REST API
         │
┌────────▼────────┐
│  FastAPI Backend│ (Port 8001)
│  - JWT Auth     │
│  - Business     │
│    Logic        │
└────────┬────────┘
         │ Motor (Async)
         │
┌────────▼────────┐
│    MongoDB      │ (Port 27017)
│  - Users        │
│  - Rooms        │
│  - Devices      │
│  - Energy Logs  │
└─────────────────┘
```

## Key Features Implementation

### 1. Human Detection
- **Technology**: MediaPipe Pose Landmarker
- **Method**: Browser-based real-time video processing
- **Accuracy**: Detects 33 body keypoints per person
- **Threshold**: 5 minutes no-detection timeout

### 2. Power Management
- **Formula**: Energy (Wh) = Power (W) × Time (hours)
- **Simulation**: 33% occupancy probability for non-camera rooms
- **Auto-shutdown**: Keeps 1 light ON for safety

### 3. Real-time Updates
- **Method**: Polling every 5 seconds
- **Data**: Room status, device states, power consumption
- **Performance**: Optimized async MongoDB queries

### 4. Energy Analytics
- **Charts**: Recharts with responsive design
- **Data**: Daily savings trends, room consumption comparison
- **Calculation**: Automatic energy saved = Power × Time off

## Design System

### Color Palette
- Primary: Cyan/Blue gradient (#06b6d4 to #3b82f6)
- Success: Green (#10b981)
- Warning: Orange (#f59e0b)
- Error: Red (#ef4444)
- Background: Light gradient (slate-50 to cyan-50)

### Typography
- Headings: **Space Grotesk** (modern geometric sans-serif)
- Body: **Inter** (readable sans-serif)
- Weights: 300-700

### Design Style
- Glassmorphism cards with backdrop blur
- Smooth animations and transitions
- Status indicators with pulse animations
- Responsive grid layouts

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
JWT_SECRET_KEY=<secret>
CORS_ORIGINS=*
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://your-domain.com
WDS_SOCKET_PORT=443
```

## Deployment

- **Infrastructure**: Kubernetes-based container deployment
- **Backend**: Supervisor process manager
- **Frontend**: React build served via nginx
- **Database**: MongoDB in same cluster

---

**Total Dependencies**: 900+ npm packages, 27 Python packages
**Bundle Size**: Optimized for production
**Browser Support**: Modern browsers with WebGL support
