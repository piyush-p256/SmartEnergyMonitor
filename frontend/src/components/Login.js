import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import axios from 'axios';
import { Zap, Eye, Shield } from 'lucide-react';

const Login = ({ onLogin, api }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? `${api}/auth/login` : `${api}/auth/register`;
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;
      
      const response = await axios.post(endpoint, payload);
      toast.success(isLogin ? 'Login successful!' : 'Account created successfully!');
      onLogin(response.data.access_token, response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse-slow" style={{animationDelay: '2s'}}></div>
      </div>

      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center relative z-10">
        {/* Left side - Branding */}
        <div className="hidden md:block space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Smart Energy</h1>
              <p className="text-slate-600 text-sm">Watcher System</p>
            </div>
          </div>

          <h2 className="text-4xl lg:text-5xl font-bold text-slate-800 leading-tight">
            Intelligent Room<br />
            Occupancy Detection
          </h2>
          
          <p className="text-lg text-slate-600">
            Automatically manage power consumption with AI-powered occupancy detection and real-time energy monitoring.
          </p>

          <div className="space-y-4 mt-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <Eye className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Live Camera Detection</h3>
                <p className="text-sm text-slate-600">Real-time human presence detection using webcam</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Auto Power Management</h3>
                <p className="text-sm text-slate-600">Smart device control based on room occupancy</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Energy Savings Analytics</h3>
                <p className="text-sm text-slate-600">Track and visualize your energy conservation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Login Form */}
        <div className="animate-fade-in" style={{animationDelay: '0.2s'}}>
          <Card className="glass-card border-0 shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-slate-800">Welcome</CardTitle>
              <CardDescription className="text-slate-600">
                Sign in to your account or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={isLogin ? "login" : "register"} onValueChange={(v) => setIsLogin(v === "login")}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
                  <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login">
                  <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        data-testid="login-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        data-testid="login-password-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      disabled={loading}
                      data-testid="login-submit-btn"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        data-testid="register-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        name="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        data-testid="register-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input
                        id="reg-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        data-testid="register-password-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                      disabled={loading}
                      data-testid="register-submit-btn"
                    >
                      {loading ? 'Creating account...' : 'Create Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
