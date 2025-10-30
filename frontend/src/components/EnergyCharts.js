import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingDown, Zap } from 'lucide-react';

const EnergyCharts = ({ api }) => {
  const [energyTrend, setEnergyTrend] = useState([]);
  const [roomConsumption, setRoomConsumption] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendRes, consumptionRes] = await Promise.all([
          axios.get(`${api}/dashboard/energy-trend`),
          axios.get(`${api}/dashboard/room-consumption`)
        ]);
        setEnergyTrend(trendRes.data);
        setRoomConsumption(consumptionRes.data);
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Energy Analytics</h2>
        <p className="text-slate-600 text-sm mt-1">Visualize energy consumption and savings</p>
      </div>

      <div className="grid md:grid-cols-1 gap-6">
        <Card className="glass-card border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-green-500" />
              <CardTitle>Energy Saved Over Time</CardTitle>
            </div>
            <CardDescription>Daily energy savings from automatic power management</CardDescription>
          </CardHeader>
          <CardContent>
            {energyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={energyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="energy_saved" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    name="Energy Saved (kWh)"
                    dot={{ fill: '#10b981', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No energy savings data yet. Start monitoring rooms to see trends.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <CardTitle>Room Power Consumption</CardTitle>
            </div>
            <CardDescription>Current power usage by room</CardDescription>
          </CardHeader>
          <CardContent>
            {roomConsumption.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roomConsumption}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="room_name" 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    style={{ fontSize: '12px' }}
                    label={{ value: 'Watts', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="power_consumption" 
                    fill="#f59e0b" 
                    name="Power (W)"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-slate-500">
                No consumption data available. Add devices to rooms to see power usage.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnergyCharts;
