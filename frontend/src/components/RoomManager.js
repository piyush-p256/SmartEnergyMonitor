import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { Plus, Trash2, Home } from 'lucide-react';

const RoomManager = ({ api, onUpdate, rooms }) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    has_camera: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${api}/rooms`, formData);
      toast.success('Room added successfully!');
      setFormData({ name: '', has_camera: false });
      setOpen(false);
      onUpdate();
    } catch (error) {
      toast.error('Failed to add room');
    }
  };

  const handleDelete = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await axios.delete(`${api}/rooms/${roomId}`);
      toast.success('Room deleted successfully!');
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Room Management</h2>
          <p className="text-slate-600 text-sm mt-1">Add and manage rooms in your facility</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500" data-testid="add-room-btn">
              <Plus className="w-4 h-4" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Room</DialogTitle>
              <DialogDescription>Enter room details below</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Room Name</Label>
                <Input
                  id="room-name"
                  placeholder="e.g., C-304, Lab-2"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="room-name-input"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="has-camera">Has Camera Feed</Label>
                <Switch
                  id="has-camera"
                  checked={formData.has_camera}
                  onCheckedChange={(checked) => setFormData({ ...formData, has_camera: checked })}
                  data-testid="has-camera-switch"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="submit-room-btn">
                Add Room
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => (
          <Card key={room.id} className="glass-card border-0 shadow-lg card-hover" data-testid={`room-card-${room.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-cyan-500" />
                  <CardTitle className="text-lg">{room.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(room.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-room-${room.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Status:</span>
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${room.is_occupied ? 'status-occupied' : 'status-unoccupied'}`}></span>
                    <span className={`font-semibold ${room.is_occupied ? 'text-green-600' : 'text-red-600'}`}>
                      {room.is_occupied ? 'Occupied' : 'Unoccupied'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Camera:</span>
                  <span className={`font-semibold ${room.has_camera ? 'text-cyan-600' : 'text-slate-400'}`}>
                    {room.has_camera ? 'Active' : 'Simulated'}
                  </span>
                </div>
                {room.last_seen && (
                  <div className="text-xs text-slate-500 mt-2">
                    Last seen: {new Date(room.last_seen).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rooms.length === 0 && (
        <Card className="glass-card border-0 shadow-lg">
          <CardContent className="py-12 text-center">
            <Home className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">No rooms added yet</p>
            <Button 
              onClick={() => setOpen(true)} 
              className="bg-gradient-to-r from-cyan-500 to-blue-500"
            >
              Add Your First Room
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RoomManager;
