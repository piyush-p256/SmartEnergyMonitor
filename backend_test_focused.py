import requests
import sys
import json
from datetime import datetime, timezone
import time

class FocusedEnergySystemTester:
    def __init__(self, base_url="https://smart-energy-8.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.room_ids = []
        self.device_ids = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def make_request(self, method, endpoint, data=None, timeout=10):
        """Make API request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=timeout)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=timeout)
            
            return response
        except Exception as e:
            return None

    def test_authentication(self):
        """Test user registration and login"""
        print("\n🔐 Testing Authentication...")
        
        # Register user
        user_data = {
            "email": f"energy_user_{int(time.time())}@example.com",
            "password": "SecurePass123!",
            "name": "Energy Test User"
        }
        
        response = self.make_request('POST', 'auth/register', user_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get('access_token')
            self.user_data = data.get('user')
            self.log_test("User Registration", True)
            
            # Test login
            login_data = {"email": user_data["email"], "password": user_data["password"]}
            login_response = self.make_request('POST', 'auth/login', login_data)
            if login_response and login_response.status_code == 200:
                self.log_test("User Login", True)
                return True
            else:
                self.log_test("User Login", False, "Login failed")
                return False
        else:
            self.log_test("User Registration", False, "Registration failed")
            return False

    def test_room_management(self):
        """Test room creation and management"""
        print("\n🏠 Testing Room Management...")
        
        # Create multiple rooms
        rooms = [
            {"name": "Living Room", "has_camera": True},
            {"name": "Bedroom", "has_camera": False},
            {"name": "Kitchen", "has_camera": False}
        ]
        
        for room_data in rooms:
            response = self.make_request('POST', 'rooms', room_data)
            if response and response.status_code == 200:
                room_id = response.json().get('id')
                self.room_ids.append(room_id)
                self.log_test(f"Create Room: {room_data['name']}", True)
            else:
                self.log_test(f"Create Room: {room_data['name']}", False, "Creation failed")
        
        # Get all rooms
        response = self.make_request('GET', 'rooms')
        if response and response.status_code == 200:
            rooms_list = response.json()
            self.log_test("Get All Rooms", len(rooms_list) >= len(self.room_ids))
        else:
            self.log_test("Get All Rooms", False, "Failed to retrieve rooms")

    def test_device_management(self):
        """Test device creation and state management"""
        print("\n⚡ Testing Device Management...")
        
        if not self.room_ids:
            self.log_test("Device Management", False, "No rooms available")
            return
        
        # Create devices in different rooms
        devices = [
            {"room_id": self.room_ids[0], "name": "LED Light", "power_rating": 10.0, "device_type": "light"},
            {"room_id": self.room_ids[0], "name": "Air Conditioner", "power_rating": 1500.0, "device_type": "ac"},
            {"room_id": self.room_ids[1], "name": "Ceiling Fan", "power_rating": 75.0, "device_type": "fan"},
            {"room_id": self.room_ids[1], "name": "Bedside Light", "power_rating": 15.0, "device_type": "light"}
        ]
        
        for device_data in devices:
            response = self.make_request('POST', 'devices', device_data)
            if response and response.status_code == 200:
                device_id = response.json().get('id')
                self.device_ids.append(device_id)
                self.log_test(f"Create Device: {device_data['name']}", True)
            else:
                self.log_test(f"Create Device: {device_data['name']}", False, "Creation failed")
        
        # Test device state changes
        if self.device_ids:
            device_id = self.device_ids[0]
            
            # Turn device off
            state_data = {"device_id": device_id, "is_on": False}
            response = self.make_request('PUT', f'devices/{device_id}/state', state_data)
            self.log_test("Device State Update (OFF)", response and response.status_code == 200)
            
            # Turn device on
            state_data = {"device_id": device_id, "is_on": True}
            response = self.make_request('PUT', f'devices/{device_id}/state', state_data)
            self.log_test("Device State Update (ON)", response and response.status_code == 200)

    def test_sample_data_generation(self):
        """Test sample data generation"""
        print("\n📊 Testing Sample Data Generation...")
        
        response = self.make_request('POST', 'admin/generate-sample-data?days=7', timeout=30)
        if response and response.status_code == 200:
            data = response.json()
            logs_created = data.get('logs_created', 0)
            self.log_test("Generate Sample Data", logs_created > 0, f"Created {logs_created} logs")
        else:
            self.log_test("Generate Sample Data", False, "Failed to generate data")

    def test_consumption_apis(self):
        """Test consumption tracking APIs"""
        print("\n⏰ Testing Consumption APIs...")
        
        # Test hourly consumption (last 24 hours)
        response = self.make_request('GET', 'consumption/hourly')
        if response and response.status_code == 200:
            data = response.json()
            required_fields = ['period_start', 'period_end', 'hourly_data', 'total_consumption_kwh']
            has_all_fields = all(field in data for field in required_fields)
            self.log_test("Hourly Consumption (24h)", has_all_fields, f"Total: {data.get('total_consumption_kwh', 0):.3f} kWh")
        else:
            self.log_test("Hourly Consumption (24h)", False, "API call failed")
        
        # Test specific date consumption
        response = self.make_request('GET', 'consumption/hourly?date=2025-01-23')
        self.log_test("Hourly Consumption (Specific Date)", response and response.status_code == 200)
        
        # Test room-specific consumption
        if self.room_ids:
            room_id = self.room_ids[0]
            response = self.make_request('GET', f'consumption/room/{room_id}')
            if response and response.status_code == 200:
                data = response.json()
                self.log_test("Room Consumption", 'total_consumption_kwh' in data, f"Room total: {data.get('total_consumption_kwh', 0):.3f} kWh")
            else:
                self.log_test("Room Consumption", False, "API call failed")

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        print("\n📊 Testing Dashboard Stats...")
        
        response = self.make_request('GET', 'dashboard/stats')
        if response and response.status_code == 200:
            data = response.json()
            required_fields = [
                'total_rooms', 'occupied_rooms', 'total_devices', 'devices_on',
                'total_energy_consumed', 'current_power_usage'
            ]
            has_all_fields = all(field in data for field in required_fields)
            self.log_test("Dashboard Stats", has_all_fields, 
                         f"Rooms: {data.get('total_rooms', 0)}, Devices: {data.get('total_devices', 0)}, Power: {data.get('current_power_usage', 0)}W")
        else:
            self.log_test("Dashboard Stats", False, "API call failed")

    def test_ai_features(self):
        """Test AI features with rate limit handling"""
        print("\n🤖 Testing AI Features...")
        
        ai_endpoints = [
            ('ai/predictions?days_ahead=7', 'AI Predictions'),
            ('ai/anomalies', 'AI Anomaly Detection'),
            ('ai/cost-estimation?rate_per_kwh=0.15', 'AI Cost Estimation'),
            ('ai/recommendations', 'AI Recommendations')
        ]
        
        for endpoint, test_name in ai_endpoints:
            response = self.make_request('GET', endpoint, timeout=30)
            if response and response.status_code == 200:
                data = response.json()
                
                # Check for AI content vs error messages
                content_fields = ['prediction', 'analysis', 'cost_analysis', 'recommendations']
                content = None
                for field in content_fields:
                    if field in data:
                        content = data[field]
                        break
                
                if content and ('not available' in content.lower() or 'error' in content.lower() or 'api error' in content.lower()):
                    self.log_test(test_name, False, "AI API error or rate limit")
                elif content:
                    self.log_test(test_name, True, "AI response generated")
                else:
                    self.log_test(test_name, False, "No AI content in response")
            else:
                error_msg = "API call failed"
                if response:
                    error_msg += f" (Status: {response.status_code})"
                self.log_test(test_name, False, error_msg)

    def run_all_tests(self):
        """Run comprehensive backend tests"""
        print("🚀 Smart Energy Management System - Comprehensive Backend Testing")
        print(f"🔗 API Base URL: {self.base_url}")
        print("=" * 70)
        
        # Core functionality tests
        if not self.test_authentication():
            print("❌ Authentication failed - stopping tests")
            return False
        
        self.test_room_management()
        self.test_device_management()
        self.test_sample_data_generation()
        self.test_consumption_apis()
        self.test_dashboard_stats()
        
        # AI features (may have rate limits)
        self.test_ai_features()
        
        # Print final results
        print("\n" + "=" * 70)
        print(f"📊 Final Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            failed_tests = [t for t in self.test_results if not t['success']]
            print(f"\n⚠️ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  • {test['test']}: {test['details']}")
            return False

def main():
    tester = FocusedEnergySystemTester()
    success = tester.run_all_tests()
    
    # Save results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/focused_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())