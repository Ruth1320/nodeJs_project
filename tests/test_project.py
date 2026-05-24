import unittest
import requests
from datetime import datetime
import random


# Base URLs for the four services.
LOGS_URL = "http://localhost:4001"
USERS_URL = "http://localhost:4002"
COSTS_URL = "http://localhost:4003"
ABOUT_URL = "http://localhost:4004"


class CostManagerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create a unique user id for the tests.
        cls.test_user_id = random.randint(700000, 999999)
        cls.current_year = datetime.now().year
        cls.current_month = datetime.now().month

    def test_01_get_about(self):
        response = requests.get(f"{ABOUT_URL}/api/about")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertIsInstance(data, list)
        self.assertEqual(len(data), 2)
        self.assertIn("first_name", data[0])
        self.assertIn("last_name", data[0])

    def test_02_get_logs(self):
        response = requests.get(f"{LOGS_URL}/api/logs")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertIsInstance(data, list)

    def test_03_add_user(self):
        new_user = {
            "id": self.test_user_id,
            "first_name": "test",
            "last_name": "student",
            "birthday": "2000-01-01"
        }

        response = requests.post(f"{USERS_URL}/api/add", json=new_user)

        self.assertEqual(response.status_code, 201)

        data = response.json()

        self.assertEqual(data["id"], self.test_user_id)
        self.assertEqual(data["first_name"], "test")
        self.assertEqual(data["last_name"], "student")
        self.assertIn("birthday", data)

    def test_04_get_existing_user(self):
        response = requests.get(f"{USERS_URL}/api/users/{self.test_user_id}")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["id"], self.test_user_id)
        self.assertEqual(data["first_name"], "test")
        self.assertEqual(data["last_name"], "student")
        self.assertIn("total", data)

    def test_05_get_users_list(self):
        response = requests.get(f"{USERS_URL}/api/users")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertIsInstance(data, list)
        self.assertGreaterEqual(len(data), 1)

        # Make sure the user list includes users with the required properties.
        self.assertIn("id", data[0])
        self.assertIn("first_name", data[0])
        self.assertIn("last_name", data[0])
        self.assertIn("birthday", data[0])

    def test_06_get_missing_user(self):
        response = requests.get(f"{USERS_URL}/api/users/99999999")

        self.assertEqual(response.status_code, 404)

        data = response.json()

        self.assertEqual(data["id"], "USER_NOT_FOUND")
        self.assertIn("message", data)

    def test_07_get_user_with_invalid_id(self):
        response = requests.get(f"{USERS_URL}/api/users/abc")

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "INVALID_USER_ID")
        self.assertIn("message", data)

    def test_08_add_duplicate_user(self):
        duplicate_user = {
            "id": self.test_user_id,
            "first_name": "test",
            "last_name": "student",
            "birthday": "2000-01-01"
        }

        response = requests.post(f"{USERS_URL}/api/add", json=duplicate_user)

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "USER_ALREADY_EXISTS")
        self.assertIn("message", data)

    def test_09_add_user_with_missing_data(self):
        invalid_user = {
            "id": random.randint(1000000, 1999999),
            "first_name": "missing"
        }

        response = requests.post(f"{USERS_URL}/api/add", json=invalid_user)

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "MISSING_USER_DATA")
        self.assertIn("message", data)

    def test_10_add_cost(self):
        new_cost = {
            "userid": self.test_user_id,
            "description": "milk test",
            "category": "food",
            "sum": 8
        }

        response = requests.post(f"{COSTS_URL}/api/add", json=new_cost)

        self.assertEqual(response.status_code, 201)

        data = response.json()

        self.assertEqual(data["userid"], self.test_user_id)
        self.assertEqual(data["description"], "milk test")
        self.assertEqual(data["category"], "food")
        self.assertEqual(data["sum"], 8)

    def test_11_get_monthly_report(self):
        response = requests.get(
            f"{COSTS_URL}/api/report",
            params={
                "id": self.test_user_id,
                "year": self.current_year,
                "month": self.current_month
            }
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(data["userid"], self.test_user_id)
        self.assertEqual(data["year"], self.current_year)
        self.assertEqual(data["month"], self.current_month)
        self.assertIn("costs", data)

    def test_12_get_report_for_missing_user(self):
        response = requests.get(
            f"{COSTS_URL}/api/report",
            params={
                "id": 99999999,
                "year": self.current_year,
                "month": self.current_month
            }
        )

        self.assertEqual(response.status_code, 404)

        data = response.json()

        self.assertEqual(data["id"], "USER_NOT_FOUND")
        self.assertIn("message", data)

    def test_13_get_report_with_invalid_month(self):
        response = requests.get(
            f"{COSTS_URL}/api/report",
            params={
                "id": self.test_user_id,
                "year": self.current_year,
                "month": 13
            }
        )

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "INVALID_MONTH")
        self.assertIn("message", data)

    def test_14_get_report_with_missing_params(self):
        response = requests.get(
            f"{COSTS_URL}/api/report",
            params={
                "id": self.test_user_id,
                "year": self.current_year
            }
        )

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "INVALID_REPORT_PARAMS")
        self.assertIn("message", data)

    def test_15_add_cost_with_invalid_category(self):
        invalid_cost = {
            "userid": self.test_user_id,
            "description": "invalid category test",
            "category": "cars",
            "sum": 10
        }

        response = requests.post(f"{COSTS_URL}/api/add", json=invalid_cost)

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "INVALID_CATEGORY")
        self.assertIn("message", data)

    def test_16_add_cost_with_missing_data(self):
        invalid_cost = {
            "userid": self.test_user_id,
            "description": "missing sum test",
            "category": "food"
        }

        response = requests.post(f"{COSTS_URL}/api/add", json=invalid_cost)

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertEqual(data["id"], "MISSING_COST_DATA")
        self.assertIn("message", data)

    def test_17_add_cost_for_missing_user(self):
        invalid_cost = {
            "userid": 99999999,
            "description": "missing user cost",
            "category": "food",
            "sum": 10
        }

        response = requests.post(f"{COSTS_URL}/api/add", json=invalid_cost)

        self.assertEqual(response.status_code, 404)

        data = response.json()

        self.assertEqual(data["id"], "USER_NOT_FOUND")
        self.assertIn("message", data)


if __name__ == "__main__":
    unittest.main()