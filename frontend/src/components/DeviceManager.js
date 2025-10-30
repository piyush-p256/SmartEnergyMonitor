import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Trash2, Lightbulb, Fan, AirVent, Power } from 'lucide-react';

const DeviceManager = ({ api, rooms, devices, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    room_id: '',
    name: '',
    power_rating: '',
    device_type: 'light'
  });

  const deviceIcons = {
    light: Lightbulb,
    fan: Fan,
    ac: AirVent,
    other: Power
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${api}/devices`, {
        ...formData,
        power_rating: parseFloat(formData.power_rating)
      });
      toast.success('Device added successfully!');
      setFormData({ room_id: '', name: '', power_rating: '', device_type: 'light' });
      setOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to add device');
    }
  };

  const handleDelete = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;
    try {
      await axios.delete(`${api}/devices/${deviceId}`);
      toast.success('Device deleted successfully!');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete device');
    }
  };

  const groupedDevices = devices.reduce((acc, device) => {
    const roomId = device.room_id;
    if (!acc[roomId]) {
      acc[roomId] = [];
    }
    acc[roomId].push(device);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Device Management</h2>
          <p className="text-slate-600 text-sm mt-1">Manage smart devices across all rooms</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500" data-testid="add-device-btn">
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>Enter device details below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-select">Room</Label>
                <Select 
                  value={formData.room_id} 
                  onValueChange={(value) => setFormData({ ...formData, room_id: value })}
                  required
                >
                  <SelectTrigger id="room-select" data-testid="room-select">
                    <SelectValue placeholder="Select a room" />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-type">Device Type</Label>
                <Select 
                  value={formData.device_type} 
                  onValueChange={(value) => setFormData({ ...formData, device_type: value })}
                >
                  <SelectTrigger id="device-type" data-testid="device-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="fan">Fan</SelectItem>
                    <SelectItem value="ac">AC Unit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device-name">Device Name</Label>
                <Input
                  id="device-name"
                  placeholder="e.g., LED Light 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="device-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="power-rating">Power Rating (Watts)</Label>
                <Input
                  id="power-rating"
                  type="number"
                  placeholder="e.g., 60"
                  value={formData.power_rating}
                  onChange={(e) => setFormData({ ...formData, power_rating: e.target.value })}
                  required
                  data-testid="power-rating-input"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-device-btn">
                Add Device
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {rooms.length === 0 && (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Power className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Please add rooms first before adding devices</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {rooms.map((room) => {
          const roomDevices = groupedDevices[room.id] || [];
          if (roomDevices.length === 0) return null;
          
          return (
            <Card key={room.id} className="glass-card border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">{room.name}</CardTitle>
                <CardDescription>{roomDevices.length} device(s)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roomDevices.map((device) => {
                    const Icon = deviceIcons[device.device_type] || Power;
                    return (
                      <div
                        key={device.id}
                        className="p-4 rounded-lg border border-slate-200 bg-white/50 hover:bg-white/80 transition-colors"
                        data-testid={`device-card-${device.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              device.is_on ? 'bg-green-100' : 'bg-slate-100'
                            }`}>
                              <Icon className={`w-4 h-4 ${
                                device.is_on ? 'text-green-600' : 'text-slate-400'
                              }`} />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 text-sm">{device.name}</p>
                              <p className="text-xs text-slate-500 capitalize">{device.device_type}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(device.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                            data-testid={`delete-device-${device.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{device.power_rating}W</span>
                          <span className={`font-semibold px-2 py-1 rounded ${
                            device.is_on 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {device.is_on ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {devices.length === 0 && rooms.length > 0 && (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Power className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No devices added yet</p>
            <Button 
              onClick={() => setOpen(true)} 
              className="bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              Add Your First Device
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeviceManager;
