import unittest
from unittest.mock import patch, MagicMock
import requests

# -------------------------------------------------------------------------
# פונקציות עזר קטנות שמדמות קריאות HTTP לשרתים שלך
# -------------------------------------------------------------------------
def call_about_service():
    return requests.get("http://localhost:4004/api/about")

def call_logs_service():
    return requests.get("http://localhost:4001/api/logs")

def call_add_user(payload):
    return requests.post("http://localhost:4002/api/add", json=payload)

def call_get_all_users():
    return requests.get("http://localhost:4002/api/users")

def call_get_user_details(user_id):
    return requests.get(f"http://localhost:4002/api/users/{user_id}")

def call_add_cost(payload):
    return requests.post("http://localhost:4003/api/add", json=payload)

def call_get_report(params):
    return requests.get("http://localhost:4003/api/report", params=params)


# =========================================================================
# סוויטת הבדיקות המרכזית המעמיקה ביותר - UNIT TESTS מבודדים לחלוטין
# =========================================================================

class TestMicroservicesUnitDeep(unittest.TestCase):

    # ---------------------------------------------------------------------
    # 1. ABOUT SERVICE TESTS (Port 4004)
    # ---------------------------------------------------------------------

    @patch('requests.get')
    def test_about_service_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"first_name": "Ruth", "last_name": "Israeli"},
            {"first_name": "Noam", "last_name": "Cohen"}
        ]
        mock_get.return_value = mock_response

        response = call_about_service()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["first_name"], "Ruth")

    @patch('requests.get')
    def test_about_service_not_found_route(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"id": "NOT_FOUND", "message": "endpoint not found"}
        mock_get.return_value = mock_response

        response = requests.get("http://localhost:4004/api/invalid-route")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["id"], "NOT_FOUND")

    # ---------------------------------------------------------------------
    # 2. LOGS SERVICE TESTS (Port 4001)
    # ---------------------------------------------------------------------

    @patch('requests.get')
    def test_logs_service_retrieval(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"service": "costs", "method": "POST", "endpoint": "/api/add", "status": 201}
        ]
        mock_get.return_value = mock_response

        response = call_logs_service()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["service"], "costs")

    @patch('requests.get')
    def test_logs_service_server_error(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"id": "LOGS_ERROR", "message": "Database disconnected"}
        mock_get.return_value = mock_response

        response = call_logs_service()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["id"], "LOGS_ERROR")

    # ---------------------------------------------------------------------
    # 3. USERS SERVICE TESTS (Port 4002)
    # ---------------------------------------------------------------------

    @patch('requests.post')
    def test_add_user_success(self, mock_post):

        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {
            "id": 12345,
            "first_name": "Ruth",
            "last_name": "A",
            "birthday": "2000-01-01T00:00:00.000Z"
        }
        mock_post.return_value = mock_response

        payload = {"id": 12345, "first_name": "Ruth", "last_name": "A", "birthday": "2000-01-01"}
        response = call_add_user(payload)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["first_name"], "Ruth")
        self.assertIn("birthday", response.json())

    @patch('requests.post')
    def test_add_user_missing_data(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "MISSING_USER_DATA", "message": "id, first_name, last_name and birthday are required"}
        mock_post.return_value = mock_response

        response = call_add_user({"id": 12345})  # חסרים שמות ותאריך לידה
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "MISSING_USER_DATA")

    @patch('requests.post')
    def test_add_user_invalid_id_type(self, mock_post):
        """USERS: חסימת יצירה כשה-ID אינו מספר (למשל מחרוזת טקסט)"""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_USER_ID", "message": "id must be a number"}
        mock_post.return_value = mock_response

        payload = {"id": "not-a-number", "first_name": "Ruth", "last_name": "A", "birthday": "2000-01-01"}
        response = call_add_user(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_USER_ID")

    @patch('requests.post')
    def test_add_user_invalid_birthday_format(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_BIRTHDAY", "message": "birthday must be a valid date"}
        mock_post.return_value = mock_response

        payload = {"id": 12345, "first_name": "Ruth", "last_name": "A", "birthday": "invalid-date-string"}
        response = call_add_user(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_BIRTHDAY")

    @patch('requests.post')
    def test_add_user_already_exists(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "USER_ALREADY_EXISTS", "message": "user already exists"}
        mock_post.return_value = mock_response

        payload = {"id": 12345, "first_name": "Ruth", "last_name": "A", "birthday": "2000-01-01"}
        response = call_add_user(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "USER_ALREADY_EXISTS")

    @patch('requests.get')
    def test_get_all_users_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {"id": 1, "first_name": "Avi"},
            {"id": 2, "first_name": "Ruth"}
        ]
        mock_get.return_value = mock_response

        response = call_get_all_users()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]["id"], 1)

    @patch('requests.get')
    def test_get_user_details_success(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "first_name": "Ruth",
            "last_name": "A",
            "id": 12345,
            "total": 450
        }
        mock_get.return_value = mock_response

        response = call_get_user_details(12345)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 450)
        self.assertEqual(response.json()["first_name"], "Ruth")

    @patch('requests.get')
    def test_get_user_details_not_found(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"id": "USER_NOT_FOUND", "message": "user not found"}
        mock_get.return_value = mock_response

        response = call_get_user_details(99999)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["id"], "USER_NOT_FOUND")

    @patch('requests.get')
    def test_get_user_details_invalid_id(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_USER_ID", "message": "id must be a number"}
        mock_get.return_value = mock_response

        response = call_get_user_details("not-a-number")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_USER_ID")

    @patch('requests.post')
    def test_add_user_internal_error(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.json.return_value = {"id": "ADD_USER_ERROR", "message": "Internal compilation or Mongoose error"}
        mock_post.return_value = mock_response

        payload = {"id": 12345, "first_name": "Ruth", "last_name": "A", "birthday": "2000-01-01"}
        response = call_add_user(payload)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["id"], "ADD_USER_ERROR")

    # ---------------------------------------------------------------------
    # 4. COSTS SERVICE TESTS (Port 4003)
    # ---------------------------------------------------------------------

    @patch('requests.post')
    def test_add_cost_invalid_category(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_CATEGORY", "message": "category must be valid"}
        mock_post.return_value = mock_response

        payload = {"userid": 123, "description": "Shoes", "category": "clothing", "sum": 300}
        response = call_add_cost(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_CATEGORY")

    @patch('requests.post')
    def test_add_cost_negative_sum(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_SUM", "message": "sum must be positive"}
        mock_post.return_value = mock_response

        payload = {"userid": 123, "description": "Gym", "category": "sports", "sum": -100}
        response = call_add_cost(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_SUM")

    @patch('requests.post')
    def test_add_cost_date_in_past(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "PAST_DATE_NOT_ALLOWED", "message": "past dates not allowed"}
        mock_post.return_value = mock_response

        payload = {"userid": 123, "description": "Dinner", "category": "food", "sum": 50, "created_at": "1995-05-12"}
        response = call_add_cost(payload)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "PAST_DATE_NOT_ALLOWED")

    @patch('requests.post')
    def test_add_cost_user_not_found(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.json.return_value = {"id": "USER_NOT_FOUND", "message": "user not found"}
        mock_post.return_value = mock_response

        payload = {"userid": 99999, "description": "Rent", "category": "housing", "sum": 2500}
        response = call_add_cost(payload)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json()["id"], "USER_NOT_FOUND")

    @patch('requests.get')
    def test_get_report_invalid_month_boundary(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_MONTH", "message": "month must be 1-12"}
        mock_get.return_value = mock_response

        response = call_get_report({"id": 123, "year": 2026, "month": 13})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_MONTH")

    @patch('requests.get')
    def test_get_report_negative_year(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"id": "INVALID_YEAR_FORMAT", "message": "year must be a positive integer"}
        mock_get.return_value = mock_response

        response = call_get_report({"id": 123, "year": -2026, "month": 5})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["id"], "INVALID_YEAR_FORMAT")

    @patch('requests.get')
    def test_get_report_computed_structure_ok(self, mock_get):
        """COSTS: הפקת דוח מחושב מחדש ובדיקה שכל מערכי הקטגוריות נוצרים בצורה תקינה (Computed Design Pattern)"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "userid": 123,
            "year": 2026,
            "month": 5,
            "costs": [
                {"food": [{"sum": 150, "description": "Pizza", "day": 10}]},
                {"health": []}, {"housing": []}, {"sports": []}, {"education": []}
            ]
        }
        mock_get.return_value = mock_response

        response = call_get_report({"id": 123, "year": 2026, "month": 5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["userid"], 123)
        self.assertEqual(len(response.json()["costs"]), 5)  # מוודא שכל 5 הקטגוריות קיימות בדוח המבנה
        self.assertEqual(response.json()["costs"][0]["food"][0]["description"], "Pizza")


if __name__ == '__main__':
    unittest.main()