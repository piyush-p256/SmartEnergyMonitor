import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Power, Clock, AlertCircle } from 'lucide-react';

const RoomList = ({ rooms, devices, onRefresh }) => {
  const getRoomDevices = (roomId) => {
    return devices.filter(d => d.room_id === roomId);
  };

  const getRoomPower = (roomId) => {
    const roomDevices = getRoomDevices(roomId);
    return roomDevices
      .filter(d => d.is_on)
      .reduce((sum, d) => sum + d.power_rating, 0);
  };

  const getDevicesOnCount = (roomId) => {
    const roomDevices = getRoomDevices(roomId);
    return roomDevices.filter(d => d.is_on).length;
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'Never';
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Live Room Status</h2>
          <p className="text-slate-600 text-sm mt-1">Real-time monitoring of all rooms</p>
        </div>
      </div>

      {rooms.length === 0 ? (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Home className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">No rooms available</p>
            <p className="text-sm text-slate-500">Add rooms from the Rooms tab to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const roomDevices = getRoomDevices(room.id);
            const devicesOn = getDevicesOnCount(room.id);
            const totalPower = getRoomPower(room.id);
            const isOccupied = room.is_occupied;

            return (
              <Card 
                key={room.id} 
                className={`glass-card border-0 shadow-lg card-hover ${
                  !isOccupied ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-green-400'
                }`}
                data-testid={`room-status-${room.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isOccupied ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <Home className={`w-5 h-5 ${
                          isOccupied ? 'text-green-600' : 'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{room.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`status-dot ${
                            isOccupied ? 'status-occupied' : 'status-unoccupied'
                          }`}></span>
                          <span className={`text-xs font-semibold ${
                            isOccupied ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isOccupied ? 'Occupied' : 'Unoccupied'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isOccupied && (
                      <AlertCircle className="w-5 h-5 text-red-500" data-testid={`alert-${room.id}`} />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Power className="w-4 h-4 text-cyan-500" />
                        <span className="text-xs text-slate-600">Devices</span>
                      </div>
                      <p className="text-lg font-bold text-slate-800">
                        {devicesOn}/{roomDevices.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Power className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-slate-600">Power</span>
                      </div>
                      <p className="text-lg font-bold text-orange-600">
                        {totalPower}W
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
                    <Clock className="w-3 h-3" />
                    <span>Last seen: {formatLastSeen(room.last_seen)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded ${
                      room.has_camera 
                        ? 'bg-cyan-100 text-cyan-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {room.has_camera ? 'Camera Active' : 'Simulated'}
                    </span>
                    {!isOccupied && devicesOn > 0 && (
                      <span className="text-red-600 font-semibold" data-testid={`power-saving-${room.id}`}>
                        Power Saving Active
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RoomList;
