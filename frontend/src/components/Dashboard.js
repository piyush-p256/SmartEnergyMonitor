import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Zap, Power, TrendingDown, Activity, Plus } from 'lucide-react';
import RoomManager from '@/components/RoomManager';
import DeviceManager from '@/components/DeviceManager';
import CameraFeed from '@/components/CameraFeed';
import EnergyCharts from '@/components/EnergyCharts';
import RoomList from '@/components/RoomList';

const Dashboard = ({ user, onLogout, api }) => {
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${api}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${api}/rooms`);
      setRooms(response.data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${api}/devices`);
      setDevices(response.data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const simulateOccupancy = async () => {
    try {
      await axios.post(`${api}/simulate-occupancy`);
      fetchRooms();
      fetchStats();
    } catch (error) {
      console.error('Failed to simulate occupancy:', error);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRooms(), fetchDevices()]);
      setLoading(false);
    };

    fetchAll();

    // Auto-refresh every 5 seconds
    intervalRef.current = setInterval(() => {
      fetchStats();
      fetchRooms();
      simulateOccupancy();
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const handleOccupancyUpdate = async (roomId, isOccupied) => {
    try {
      await axios.post(`${api}/occupancy/update`, {
        room_id: roomId,
        is_occupied: isOccupied,
        timestamp: new Date().toISOString()
      });
      fetchRooms();
      fetchStats();
      fetchDevices();
      if (!isOccupied) {
        toast.success('Power saving mode activated!', {
          description: 'Devices automatically turned off'
        });
      }
    } catch (error) {
      toast.error('Failed to update occupancy');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50" data-testid="dashboard">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Smart Energy Watcher</h1>
                <p className="text-sm text-slate-600">Welcome, {user.name}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={onLogout}
              className="flex items-center gap-2"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="glass-card border-0 shadow-lg card-hover" data-testid="total-rooms-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600">Total Rooms</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-800">{stats.total_rooms}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 font-semibold" data-testid="occupied-rooms">{stats.occupied_rooms} Occupied</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-red-600 font-semibold" data-testid="unoccupied-rooms">{stats.unoccupied_rooms} Empty</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-lg card-hover" data-testid="devices-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600">Devices</CardDescription>
                <CardTitle className="text-3xl font-bold text-slate-800">{stats.total_devices}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <Power className="w-3 h-3 text-green-500" />
                    <span className="text-green-600 font-semibold" data-testid="devices-on">{stats.devices_on} ON</span>
                  </div>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600" data-testid="devices-off">{stats.devices_off} OFF</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-lg card-hover" data-testid="power-usage-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-600">Current Power</CardDescription>
                <CardTitle className="text-3xl font-bold text-orange-600" data-testid="current-power">
                  {stats.current_power_usage.toFixed(0)}W
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <Activity className="w-3 h-3" />
                  <span>Active consumption</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-lg savings-gradient text-white card-hover" data-testid="energy-saved-card">
              <CardHeader className="pb-2">
                <CardDescription className="text-green-50">Energy Saved</CardDescription>
                <CardTitle className="text-3xl font-bold" data-testid="total-energy-saved">
                  {stats.total_energy_saved.toFixed(2)}kWh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 text-sm text-green-50">
                  <TrendingDown className="w-3 h-3" />
                  <span>Auto power management</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 shadow-sm">
            <TabsTrigger value="overview" data-testid="overview-tab">Overview</TabsTrigger>
            <TabsTrigger value="rooms" data-testid="rooms-tab">Rooms</TabsTrigger>
            <TabsTrigger value="devices" data-testid="devices-tab">Devices</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="analytics-tab">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <RoomList 
              rooms={rooms} 
              devices={devices}
              onRefresh={fetchRooms}
              api={api}
            />
          </TabsContent>

          <TabsContent value="rooms">
            <RoomManager 
              api={api} 
              onUpdate={fetchRooms}
              rooms={rooms}
            />
          </TabsContent>

          <TabsContent value="devices">
            <DeviceManager 
              api={api} 
              rooms={rooms}
              devices={devices}
              onUpdate={() => {
                fetchDevices();
                fetchStats();
              }}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <EnergyCharts api={api} />
          </TabsContent>
        </Tabs>

        {/* Camera Feed Section */}
        <div className="mt-8">
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-500" />
                Live Camera Detection
              </CardTitle>
              <CardDescription>
                Monitor real-time occupancy using webcam (MediaPipe Human Detection)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CameraFeed 
                rooms={rooms.filter(r => r.has_camera)} 
                onOccupancyDetected={handleOccupancyUpdate}
                api={api}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
