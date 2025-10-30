import requests
import sys
import json
from datetime import datetime, timezone
import time

class EnergySystemAPITester:
    def __init__(self, base_url="https://smart-energy-watcher.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
        # Test data storage
        self.created_room_id = None
        self.created_device_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Response: {error_data}"
                except:
                    details += f", Response: {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_user_registration(self):
        """Test user registration"""
        test_user_data = {
            "email": f"test_user_{int(time.time())}@example.com",
            "password": "TestPass123!",
            "name": "Test User"
        }
        
        response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if response and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response['user']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing user"""
        if not self.user_data:
            return False
            
        login_data = {
            "email": self.user_data['email'],
            "password": "TestPass123!"
        }
        
        response = self.run_test(
            "User Login",
            "POST", 
            "auth/login",
            200,
            data=login_data
        )
        
        return response is not None

    def test_create_room(self):
        """Test room creation"""
        room_data = {
            "name": f"Test Room {int(time.time())}",
            "has_camera": True
        }
        
        response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200,
            data=room_data
        )
        
        if response and 'id' in response:
            self.created_room_id = response['id']
            return True
        return False

    def test_get_rooms(self):
        """Test getting all rooms"""
        response = self.run_test(
            "Get Rooms",
            "GET",
            "rooms",
            200
        )
        
        return response is not None and isinstance(response, list)

    def test_create_device(self):
        """Test device creation"""
        if not self.created_room_id:
            self.log_test("Create Device", False, "No room available")
            return False
            
        device_data = {
            "room_id": self.created_room_id,
            "name": "Test LED Light",
            "power_rating": 60.0,
            "device_type": "light"
        }
        
        response = self.run_test(
            "Create Device",
            "POST",
            "devices",
            200,
            data=device_data
        )
        
        if response and 'id' in response:
            self.created_device_id = response['id']
            return True
        return False

    def test_get_devices(self):
        """Test getting all devices"""
        response = self.run_test(
            "Get Devices",
            "GET",
            "devices",
            200
        )
        
        return response is not None and isinstance(response, list)

    def test_occupancy_update(self):
        """Test occupancy update"""
        if not self.created_room_id:
            self.log_test("Update Occupancy", False, "No room available")
            return False
            
        occupancy_data = {
            "room_id": self.created_room_id,
            "is_occupied": False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        response = self.run_test(
            "Update Occupancy",
            "POST",
            "occupancy/update",
            200,
            data=occupancy_data
        )
        
        return response is not None

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        response = self.run_test(
            "Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if response:
            required_fields = [
                'total_rooms', 'occupied_rooms', 'unoccupied_rooms',
                'total_devices', 'devices_on', 'devices_off',
                'total_energy_consumed', 'total_energy_saved', 'current_power_usage'
            ]
            
            missing_fields = [field for field in required_fields if field not in response]
            if missing_fields:
                self.log_test("Dashboard Stats Fields", False, f"Missing fields: {missing_fields}")
                return False
            else:
                self.log_test("Dashboard Stats Fields", True, "All required fields present")
                return True
        return False

    def test_energy_trend(self):
        """Test energy trend endpoint"""
        response = self.run_test(
            "Energy Trend",
            "GET",
            "dashboard/energy-trend",
            200
        )
        
        return response is not None and isinstance(response, list)

    def test_room_consumption(self):
        """Test room consumption endpoint"""
        response = self.run_test(
            "Room Consumption",
            "GET",
            "dashboard/room-consumption",
            200
        )
        
        return response is not None and isinstance(response, list)

    def test_simulate_occupancy(self):
        """Test occupancy simulation"""
        response = self.run_test(
            "Simulate Occupancy",
            "POST",
            "simulate-occupancy",
            200
        )
        
        return response is not None

    def test_delete_device(self):
        """Test device deletion"""
        if not self.created_device_id:
            self.log_test("Delete Device", False, "No device to delete")
            return False
            
        response = self.run_test(
            "Delete Device",
            "DELETE",
            f"devices/{self.created_device_id}",
            200
        )
        
        return response is not None

    def test_delete_room(self):
        """Test room deletion"""
        if not self.created_room_id:
            self.log_test("Delete Room", False, "No room to delete")
            return False
            
        response = self.run_test(
            "Delete Room",
            "DELETE",
            f"rooms/{self.created_room_id}",
            200
        )
        
        return response is not None

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Energy Management System API Tests")
        print(f"🔗 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Authentication tests
        print("\n📝 Authentication Tests")
        if not self.test_user_registration():
            print("❌ Registration failed, stopping tests")
            return False
            
        self.test_user_login()
        
        # Room management tests
        print("\n🏠 Room Management Tests")
        self.test_create_room()
        self.test_get_rooms()
        
        # Device management tests  
        print("\n⚡ Device Management Tests")
        self.test_create_device()
        self.test_get_devices()
        
        # Occupancy and energy tests
        print("\n👥 Occupancy & Energy Tests")
        self.test_occupancy_update()
        self.test_simulate_occupancy()
        
        # Dashboard tests
        print("\n📊 Dashboard Tests")
        self.test_dashboard_stats()
        self.test_energy_trend()
        self.test_room_consumption()
        
        # Cleanup tests
        print("\n🧹 Cleanup Tests")
        self.test_delete_device()
        self.test_delete_room()
        
        # Print results
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = EnergySystemAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results = {
        "timestamp": datetime.now().isoformat(),
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_details": tester.test_results
    }
    
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())