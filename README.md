# Florista ERP Backend API Documentation

Base URL: `http://localhost:5000`

> **Note:** All routes except `/api/auth/login` require an `Authorization` header with a valid JWT token.
> Example Header: `Authorization: Bearer <your_token_here>`

> **Note on Pagination:** All array-returning endpoints (`GET /api/buyers`, `/api/flowers`, `/api/orders`) heavily support `?page=1&limit=20` query parameters. Their JSON response shape differs slightly to include tracking metrics:
> ```json
> {
>   "data": [ /* objects */ ],
>   "page": 1,
>   "pages": 5,
>   "total": 100
> }
> ```

---

## 1. Authentication

### Login
- **Endpoint**: `POST /api/auth/login`
- **Description**: Authenticates an admin user and returns a JWT token.
- **Body**:
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR..."
  }
  ```

---

## 2. Buyers

### Create Buyer
- **Endpoint**: `POST /api/buyers`
- **Body**:
  ```json
  {
    "name": "Acme Retailers",
    "telephone": "+1234567890",
    "location": "New York, NY",
    "businessName": "Acme Corp" 
  }
  ```
  *(Note: `buyerId` will auto-generate sequentially like `B001` if omitted)*

### Get All Buyers (with Search)
- **Endpoint**: `GET /api/buyers`
- **Query Params (Optional)**: `?search=Acme` (Searches by ID, name, location, or telephone)
- **Response**: Array of Buyer objects

### Get / Update / Delete Single Buyer
- **Endpoints**: 
  - `GET /api/buyers/:id`
  - `PUT /api/buyers/:id`
  - `DELETE /api/buyers/:id`
- **Note**: `:id` can be the MongoDB `_id` OR the custom ID (e.g., `B001`).
- **Update Body Example**:
  ```json
  {
    "telephone": "+1987654321"
  }
  ```

---

## 3. Flowers

### Create Flower
- **Endpoint**: `POST /api/flowers`
- **Body**:
  ```json
  {
    "name": "Red Rose",
    "costPrice": 1.50,
    "sellingPrice": 3.00
  }
  ```
  *(Note: `flowerId` will auto-generate as `F001` if omitted)*

### Get All Flowers (with Search)
- **Endpoint**: `GET /api/flowers`
- **Query Params (Optional)**: `?search=Rose`
- **Response**: Array of Flower objects

### Get / Update / Delete Single Flower
- **Endpoints**: 
  - `GET /api/flowers/:id`
  - `PUT /api/flowers/:id`
  - `DELETE /api/flowers/:id`
- **Note**: `:id` can be the MongoDB `_id` OR the custom ID (e.g., `F001`).

---

## 4. Orders

### Create Order
- **Endpoint**: `POST /api/orders`
- **Body**:
  ```json
  {
    "buyer": "60d5ecb8b3... (MongoDB Object ID of Buyer)",
    "items": [
      {
        "flower": "60d5ecb8b3... (MongoDB Object ID of Flower)",
        "cost": 1.50,
        "price": 3.00,
        "qty": 50
      },
      {
        "customProduct": "Premium Ribbon Box",
        "cost": 2.00,
        "price": 5.00,
        "qty": 2
      }
    ],
    "paid": false,
    "settled": false
  }
  ```
  *(Note: `orderId` will auto-generate as `O001` if omitted)*

### Get All Orders
- **Endpoint**: `GET /api/orders`
- **Response**: Array of Order objects. The `buyer` and `items.flower` fields will be fully populated with their respective object data (names, locations, etc.) instead of just the raw Object IDs!

### Get / Update / Delete Single Order
- **Endpoints**: 
  - `GET /api/orders/:id`
  - `PUT /api/orders/:id`
  - `DELETE /api/orders/:id`
- **Note**: `:id` can be the MongoDB `_id` OR the custom ID (e.g., `O001`).

---

## 5. Stats Dashboard

### Get Dashboard Analytics
- **Endpoint**: `GET /api/stats`
- **Query Params**: `?monthOffset=0` (0 = this month, 1 = last month, 2 = two months ago, etc. Defaults to `0` if omitted)
- **Response**:
  ```json
  {
    "timeframe": {
      "startOfMonth": "2026-03-01T00:00:00.000Z",
      "endOfMonth": "2026-03-31T23:59:59.999Z"
    },
    "overview": {
      "totalSales": 12500,
      "totalProfit": 4000,
      "fulfilledOrders": 150,
      "unsettledOrders": 5,
      "unpaidOrders": 8
    },
    "historicalAverages": {
      "avgSalesPerMonth": 11000,
      "avgCostPerMonth": 3500,
      "avgProfitPerMonth": 7500,
      "avgOrdersPerMonth": 120
    },
    "topBuyers": [
      {
        "_id": "60d5ec...",
        "name": "Acme Retailers",
        "businessName": "Acme Corp",
        "telephone": "+1234567890",
        "location": "New York, NY",
        "lifetimeSpent": 5000,
        "totalOrders": 12
      }
    ],
    "topFlowers": [
      {
        "_id": "60d5ec...",
        "name": "Red Rose",
        "totalQtySold": 500,
        "totalRevenue": 1500
      }
    ],
    "salesByLocation": [
      {
        "location": "New York, NY",
        "totalSales": 4500,
        "totalOrders": 12
      }
    ],
    "recentActivity": [
      {
        "orderId": "O005",
        "buyerName": "Acme Retailers",
        "date": "2026-03-18T10:00:00.000Z",
        "paid": false,
        "settled": false
      }
    ]
  }
  ```
