Cost Manager RESTful Web Services

Team:
Team Member 1: Ruth Dubinsky
Team Member 2: Matan Shabo

Project Description:
This project implements a Cost Manager system using RESTful Web Services.
The system allows managing users, costs, monthly reports, logs, and team information.

The project is divided into four independent services:

1. logs service
2. users service
3. costs service
4. about service

Each service runs on a different port and connects to the same MongoDB Atlas database.


Project Structure:

CostManagerFinalProject
│
├── logs
│   ├── index.js
│   ├── .env
│   ├── package.json
│   └── models
│
├── users
│   ├── index.js
│   ├── .env
│   ├── package.json
│   └── models
│
├── costs
│   ├── index.js
│   ├── .env
│   ├── package.json
│   └── models
│
├── about
│   ├── index.js
│   ├── .env
│   ├── package.json
│   └── models
│
├── tests
│   └── manual_tests.txt
│
└── README.txt


Technologies Used:

Node.js
Express.js
MongoDB Atlas
Mongoose
dotenv
pino
cors


Database:

The services are connected to MongoDB Atlas.
Database name: costmanager

The main collections used in the project are:

users
costs
logs
monthly_reports


Services and Ports:

logs service:
Port: 4001

users service:
Port: 4002

costs service:
Port: 4003

about service:
Port: 4004


How to Run the Project:

Before running the services, make sure each service has a valid .env file.

Each .env file should include:

PORT
SERVICE_NAME
MONGO_URI

The about service also includes the team members details.


Run logs service:

cd logs
node index.js


Run users service:

cd users
node index.js


Run costs service:

cd costs
node index.js


Run about service:

cd about
node index.js


Important:
Each service should be run in a separate terminal window.


API Endpoints:

Logs Service:

GET http://localhost:4001/api/logs

Description:
Returns the logs saved in the system.


Users Service:

POST http://localhost:4002/api/add

Description:
Adds a new user to the system.

Example body:
{
  "id": 123123,
  "first_name": "mosh",
  "last_name": "israeli",
  "birthday": "1990-01-01"
}


GET http://localhost:4002/api/users/:id

Example:
GET http://localhost:4002/api/users/123123

Description:
Returns the user details and the total costs of the user.


Costs Service:

POST http://localhost:4003/api/add

Description:
Adds a new cost item for an existing user.

Example body:
{
  "userid": 123123,
  "description": "milk 9",
  "category": "food",
  "sum": 8
}


GET http://localhost:4003/api/report?id=123123&year=2026&month=5

Description:
Returns a monthly cost report for the selected user, year and month.

The report includes the following categories:

food
health
housing
sports
education


About Service:

GET http://localhost:4004/api/about

Description:
Returns the details of the project team members.

Example result:
[
  {
    "first_name": "Ruth",
    "last_name": "Dubinsky"
  },
  {
    "first_name": "Matan",
    "last_name": "Shabo"
  }
]


Logging:

Each service saves logs into the logs collection in MongoDB.
The logs include details such as:

service
method
url
endpoint
status
message
created_at


Manual Tests:

Manual tests were added under:

tests/manual_tests.txt

The tests include successful requests and error cases, such as:

existing user
missing user
invalid user id
invalid month
missing report parameters
invalid category
missing cost fields
duplicate user
about service logs


Final Notes:

All four services were tested and are working correctly.

logs service - working
users service - working
costs service - working
about service - working

The system handles valid requests and invalid requests properly.
The project is ready for final cleanup and submission preparation.