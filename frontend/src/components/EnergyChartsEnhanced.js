import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, Zap, Calendar, Brain, DollarSign, Lightbulb, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const EnergyChartsEnhanced = ({ api }) => {
  const [hourlyData, setHourlyData] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [aiPredictions, setAiPredictions] = useState(null);
  const [aiAnomalies, setAiAnomalies] = useState(null);
  const [aiCostEstimation, setAiCostEstimation] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('hourly');

  useEffect(() => {
    fetchHourlyData();
  }, [api, selectedDate]);

  const fetchHourlyData = async () => {
    try {
      setLoading(true);
      const url = selectedDate 
        ? `${api}/consumption/hourly?date=${selectedDate}`
        : `${api}/consumption/hourly`;
      const response = await axios.get(url);
      setHourlyData(response.data);
    } catch (error) {
      console.error('Failed to fetch hourly data:', error);
      toast.error('Failed to load consumption data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIPredictions = async () => {
    try {
      setAiLoading(true);
      const response = await axios.get(`${api}/ai/predictions?days_ahead=7`);
      setAiPredictions(response.data);
      toast.success('AI predictions loaded');
    } catch (error) {
      console.error('Failed to fetch AI predictions:', error);
      toast.error('Failed to load AI predictions');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAIAnomalies = async () => {
    try {
      setAiLoading(true);
      const response = await axios.get(`${api}/ai/anomalies`);
      setAiAnomalies(response.data);
      toast.success('Anomaly detection complete');
    } catch (error) {
      console.error('Failed to fetch AI anomalies:', error);
      toast.error('Failed to detect anomalies');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAICostEstimation = async () => {
    try {
      setAiLoading(true);
      const response = await axios.get(`${api}/ai/cost-estimation?rate_per_kwh=0.12`);
      setAiCostEstimation(response.data);
      toast.success('Cost estimation complete');
    } catch (error) {
      console.error('Failed to fetch cost estimation:', error);
      toast.error('Failed to estimate costs');
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAIRecommendations = async () => {
    try {
      setAiLoading(true);
      const response = await axios.get(`${api}/ai/recommendations`);
      setAiRecommendations(response.data);
      toast.success('Recommendations loaded');
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
      toast.error('Failed to load recommendations');
    } finally {
      setAiLoading(false);
    }
  };

  const generateSampleData = async () => {
    try {
      setLoading(true);
      toast.info('Generating sample data... This may take a moment');
      const response = await axios.post(`${api}/admin/generate-sample-data?days=7`);
      toast.success(`Generated ${response.data.logs_created} historical logs`);
      await fetchHourlyData();
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      toast.error('Failed to generate sample data');
    } finally {
      setLoading(false);
    }
  };

  const formatHourlyChartData = () => {
    if (!hourlyData || !hourlyData.hourly_data) return [];
    
    return hourlyData.hourly_data.map(item => {
      const date = new Date(item.hour);
      return {
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        fullTime: date.toLocaleString(),
        consumption: parseFloat(item.total_consumption_kwh.toFixed(3))
      };
    });
  };

  const formatRoomPieData = () => {
    if (!hourlyData || !hourlyData.hourly_data || hourlyData.hourly_data.length === 0) return [];
    
    const roomTotals = {};
    hourlyData.hourly_data.forEach(hourData => {
      hourData.room_breakdown.forEach(room => {
        if (!roomTotals[room.room_name]) {
          roomTotals[room.room_name] = 0;
        }
        roomTotals[room.room_name] += room.consumption_kwh;
      });
    });

    return Object.entries(roomTotals).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(3))
    }));
  };

  if (loading && !hourlyData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading energy data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Energy Analytics & AI Insights</h2>
          <p className="text-slate-600 text-sm mt-1">Comprehensive consumption tracking and AI-powered analysis</p>
        </div>
        <Button 
          onClick={generateSampleData} 
          variant="outline"
          disabled={loading}
        >
          Generate Sample Data
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-slate-200 shadow-sm">
          <TabsTrigger value="hourly">
            <Zap className="w-4 h-4 mr-2" />
            Hourly Consumption
          </TabsTrigger>
          <TabsTrigger value="rooms">
            <TrendingDown className="w-4 h-4 mr-2" />
            Room Analysis
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        {/* Hourly Consumption Tab */}
        <TabsContent value="hourly" className="space-y-6">
          <Card className="glass-card border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-500" />
                    <CardTitle>Consumption by Hour</CardTitle>
                  </div>
                  <CardDescription>
                    {selectedDate ? `Data for ${selectedDate}` : 'Last 24 hours'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {selectedDate && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedDate('')}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {hourlyData && hourlyData.hourly_data && hourlyData.hourly_data.length > 0 ? (
                <>
                  <div className="mb-4 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-slate-600">Total Consumption</p>
                        <p className="text-2xl font-bold text-cyan-600">
                          {hourlyData.total_consumption_kwh?.toFixed(3) || 0} kWh
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Hours Tracked</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {hourlyData.hourly_data.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Average per Hour</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {(hourlyData.total_consumption_kwh / hourlyData.hourly_data.length).toFixed(3)} kWh
                        </p>
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={formatHourlyChartData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
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
                        labelFormatter={(value) => formatHourlyChartData().find(d => d.time === value)?.fullTime}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="consumption" 
                        stroke="#06b6d4" 
                        strokeWidth={3}
                        name="Consumption (kWh)"
                        dot={{ fill: '#06b6d4', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="text-center py-12">
                  <Zap className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 mb-2">No consumption data available</p>
                  <p className="text-sm text-slate-500 mb-4">Generate sample data or wait for hourly logging to collect data</p>
                  <Button onClick={generateSampleData} disabled={loading}>
                    Generate Sample Data
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hourly Breakdown Table */}
          {hourlyData && hourlyData.hourly_data && hourlyData.hourly_data.length > 0 && (
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Detailed Hourly Breakdown</CardTitle>
                <CardDescription>Device-level consumption per hour</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Time</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-700">Total (kWh)</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-700">Room Breakdown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {hourlyData.hourly_data.slice(0, 10).map((hour, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-700">
                            {new Date(hour.hour).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-cyan-600">
                            {hour.total_consumption_kwh.toFixed(3)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              {hour.room_breakdown.map((room, ridx) => (
                                <div key={ridx} className="text-xs text-slate-600">
                                  <span className="font-semibold">{room.room_name}:</span> {room.consumption_kwh.toFixed(3)} kWh
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Room Analysis Tab */}
        <TabsContent value="rooms" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-orange-500" />
                  <CardTitle>Room Consumption Distribution</CardTitle>
                </div>
                <CardDescription>Total consumption per room</CardDescription>
              </CardHeader>
              <CardContent>
                {formatRoomPieData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={formatRoomPieData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value.toFixed(2)} kWh`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {formatRoomPieData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    No room data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  <CardTitle>Room Comparison</CardTitle>
                </div>
                <CardDescription>Consumption by room (Bar chart)</CardDescription>
              </CardHeader>
              <CardContent>
                {formatRoomPieData().length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formatRoomPieData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        style={{ fontSize: '12px' }}
                        label={{ value: 'kWh', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar 
                        dataKey="value" 
                        fill="#3b82f6" 
                        name="Consumption (kWh)"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    No room data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* AI Predictions */}
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <CardTitle>Predictive Analytics</CardTitle>
                  </div>
                  <Button 
                    onClick={fetchAIPredictions} 
                    size="sm"
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Loading...' : 'Generate'}
                  </Button>
                </div>
                <CardDescription>AI-powered 7-day consumption forecast</CardDescription>
              </CardHeader>
              <CardContent>
                {aiPredictions ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Generated at</p>
                      <p className="text-sm font-semibold text-blue-700">
                        {new Date(aiPredictions.generated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-slate-200 text-slate-700">
                        {aiPredictions.prediction}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Brain className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm">Click Generate to get AI predictions</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Anomaly Detection */}
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <CardTitle>Anomaly Detection</CardTitle>
                  </div>
                  <Button 
                    onClick={fetchAIAnomalies} 
                    size="sm"
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Loading...' : 'Detect'}
                  </Button>
                </div>
                <CardDescription>Identify unusual consumption patterns</CardDescription>
              </CardHeader>
              <CardContent>
                {aiAnomalies ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">Data points analyzed</p>
                      <p className="text-sm font-semibold text-red-700">
                        {aiAnomalies.data_points_analyzed}
                      </p>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-slate-200 text-slate-700">
                        {aiAnomalies.analysis}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm">Click Detect to find anomalies</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Estimation */}
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <CardTitle>Cost Estimation</CardTitle>
                  </div>
                  <Button 
                    onClick={fetchAICostEstimation} 
                    size="sm"
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Loading...' : 'Calculate'}
                  </Button>
                </div>
                <CardDescription>Monthly cost analysis and savings tips</CardDescription>
              </CardHeader>
              <CardContent>
                {aiCostEstimation ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">Consumption</p>
                        <p className="text-lg font-bold text-green-700">
                          {aiCostEstimation.consumption_kwh?.toFixed(2)} kWh
                        </p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">Rate</p>
                        <p className="text-lg font-bold text-green-700">
                          ${aiCostEstimation.rate_per_kwh}/kWh
                        </p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-slate-200 text-slate-700">
                        {aiCostEstimation.cost_analysis}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm">Click Calculate for cost analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Smart Recommendations */}
            <Card className="glass-card border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-yellow-500" />
                    <CardTitle>Smart Recommendations</CardTitle>
                  </div>
                  <Button 
                    onClick={fetchAIRecommendations} 
                    size="sm"
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Loading...' : 'Get Tips'}
                  </Button>
                </div>
                <CardDescription>Personalized energy-saving suggestions</CardDescription>
              </CardHeader>
              <CardContent>
                {aiRecommendations ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">Rooms</p>
                        <p className="text-lg font-bold text-yellow-700">
                          {aiRecommendations.total_rooms}
                        </p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <p className="text-xs text-slate-600 mb-1">Devices</p>
                        <p className="text-lg font-bold text-yellow-700">
                          {aiRecommendations.total_devices}
                        </p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm bg-white p-4 rounded-lg border border-slate-200 text-slate-700">
                        {aiRecommendations.recommendations}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <Lightbulb className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm">Click Get Tips for recommendations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnergyChartsEnhanced;
