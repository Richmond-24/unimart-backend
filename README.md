# UniMart Backend API
**Node.js + Express + MongoDB** — by ZeroOne Labs

---

## Quick Start

```bash
New chat
Ctrl
Shift
O
Search chats
Ctrl
K
Images
Apps
Codex
qwww
 
￼
￼
New chat
Ctrl
Shift
O
Search chats
Ctrl
K
Images
Apps
Codex
qwww
 
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env
# → Edit MONGO_URI and JWT_SECRET

# 3. Seed sample data (optional)
npm run seed

# 4. Start development server
npm run dev
# → API running at http://localhost:5000
```

---

## Folder Structure

```
src/
├── server.js               # App entry point
├── models/
│   ├── User.model.js
│   ├── Product.model.js
│   ├── Category.model.js
│   ├── Order.model.js
│   ├── Cart.model.js
│   ├── Food.model.js
│   ├── Service.model.js
│   ├── Event.model.js
│   ├── Seller.model.js
│   ├── Review.model.js
│   └── FlashDeal.model.js
├── controllers/
│   ├── auth.controller.js
│   ├── product.controller.js
│   ├── cart.controller.js
│   ├── order.controller.js
│   ├── listing.controller.js   # food, services, events, sellers
│   ├── extras.controller.js    # flash deals, reviews
│   ├── riri.controller.js      # RIRI AI chat
│   └── home.controller.js      # Home feed (single request)
├── routes/
│   ├── auth.routes.js
│   ├── user.routes.js
│   ├── product.routes.js
│   ├── category.routes.js
│   ├── cart.routes.js
│   ├── order.routes.js
│   ├── food.routes.js
│   ├── service.routes.js
│   ├── event.routes.js
│   ├── seller.routes.js
│   ├── flashDeal.routes.js
│   ├── review.routes.js
│   ├── riri.routes.js
│   └── home.routes.js
├── middleware/
│   └── auth.middleware.js
└── utils/
    └── seed.js
```

---

## API Reference

All responses follow this shape:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "Error description" }
```

### 🔐 Auth  `POST /api/auth/*`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register (role: buyer/seller) |
| POST | `/api/auth/login` | — | Login → returns JWT |
| GET  | `/api/auth/me` | ✅ | Get current user |
| PUT  | `/api/auth/password` | ✅ | Update password |
| PUT  | `/api/auth/push-token` | ✅ | Save Expo push token |

**Register body:**
```json
{
  "name": "Kwame Asante",
  "email": "kwame@ug.edu.gh",
  "password": "password123",
  "phone": "0244123456",
  "university": "University of Ghana",
  "hall": "Legon Hall",
  "role": "buyer"
}
```

---

### 🏠 Home Feed  `GET /api/home`
Single endpoint that returns everything the home screen needs:
```
GET /api/home?university=University+of+Ghana
```
**Returns:** `banners`, `categories`, `trending`, `flashDeals`, `foods`, `services`, `events`, `sellers`, `techGadgets`, `usedItems`

---

### 📦 Products  `GET /api/products`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | — | List (filter: category, isUsed, isTrending, search) |
| GET | `/api/products/trending` | — | Trending products |
| GET | `/api/products/used` | — | Second-hand items |
| GET | `/api/products/:id` | — | Single product |
| POST | `/api/products` | ✅ | Create listing |
| PUT | `/api/products/:id` | ✅ | Update listing |
| DELETE | `/api/products/:id` | ✅ | Delete listing |
| POST | `/api/products/:id/save` | ✅ | Toggle saved |

**Query params:** `?category=ID&isUsed=true&isTrending=true&search=earbuds&page=1&limit=20&sort=-createdAt`

---

### 🛒 Cart  `(all protected)`
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cart` | Get cart |
| POST | `/api/cart/add` | Add item `{ productId, quantity }` |
| PUT | `/api/cart/update` | Update qty `{ productId, quantity }` |
| DELETE | `/api/cart/:productId` | Remove item |
| DELETE | `/api/cart/clear` | Clear cart |

---

### 📋 Orders  `(all protected)`
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | My orders (filter: `?status=pending`) |
| GET | `/api/orders/:id` | Single order |
| PATCH | `/api/orders/:id/status` | Update status (admin/seller) |
| PATCH | `/api/orders/:id/pay` | Mark as paid `{ paymentRef }` |

**Create order body:**
```json
{
  "items": [{ "productId": "...", "quantity": 1 }],
  "deliveryAddress": { "hall": "Legon Hall", "room": "B204", "campus": "UG" },
  "paymentMethod": "momo",
  "deliveryFee": 5
}
```

---

### 🍛 Food  `/api/food`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/food` | — | List food items |
| GET | `/api/food/:id` | — | Single food item |
| POST | `/api/food` | ✅ | Create (sellers) |
| PUT | `/api/food/:id` | ✅ | Update |
| DELETE | `/api/food/:id` | ✅ | Delete |

---

### 💼 Services  `/api/services`
Same pattern as food. Filter: `?category=beauty&university=...`

---

### 🎟️ Events  `/api/events`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events` | — | Upcoming events |
| GET | `/api/events/:id` | — | Single event |
| POST | `/api/events` | ✅ | Create event |
| POST | `/api/events/:id/rsvp` | ✅ | Toggle RSVP |

---

### ⚡ Flash Deals  `/api/flash-deals`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/flash-deals` | — | Active deals with countdown |
| POST | `/api/flash-deals` | admin | Create deal |
| POST | `/api/flash-deals/:id/claim` | ✅ | Claim deal |

---

### ⭐ Reviews  `/api/reviews`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reviews` | — | List `?targetType=product&targetId=...` |
| POST | `/api/reviews` | ✅ | Create review |
| DELETE | `/api/reviews/:id` | ✅ | Delete review |

---

### ✨ RIRI AI  `/api/riri`
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/riri/chat` | optional | Chat `{ message: "show food" }` |
| GET | `/api/riri/quick-replies` | — | Quick reply chips |

RIRI responds with **live DB data** — actual products, food items, events, and deals from your database.

---

## Connecting to the React Native App

```ts
// services/api.ts
const BASE_URL = 'http://YOUR_SERVER_IP:5000/api';

// Home feed (replaces all hardcoded data)
const loadHome = async () => {
  const res = await fetch(`${BASE_URL}/home?university=University+of+Ghana`);
  const json = await res.json();
  // json.data = { banners, categories, trending, foods, ... }
};

// RIRI chat
const chatWithRiri = async (message: string, token?: string) => {
  const res = await fetch(`${BASE_URL}/riri/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ message }),
  });
  return res.json(); // { data: { message, intent, timestamp } }
};
```

---

## Default Seed Credentials
| Role | Email | Password |
|------|-------|----------|
| Seller | seller@unimart.gh | password123 |
