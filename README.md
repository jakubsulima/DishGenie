# RecipeAI 🍳

A full-stack web application that helps users discover and manage recipes using AI-powered recipe generation. The app features a virtual fridge to track ingredients, personalized dietary preferences, and smart recipe suggestions based on what you have available.

## 🌟 Features

### Core Functionality

- **AI Recipe Generation**: Generate custom recipes using Google's Gemini AI based on available ingredients and preferences
- **Virtual Fridge Management**: Track your ingredients with expiration dates, quantities, and categories
- **Smart Recipe Search**: Find recipes by name, ingredients, cuisine type, meal type, and preparation time
- **Dietary Preferences**: Set dietary restrictions (Vegan, Vegetarian, Gluten-Free, etc.) and ingredient dislikes
- **Recipe Management**: Create, view, edit, and delete your own recipes
- **Admin Panel**: Administrative dashboard for user and recipe management

### User Features

- Browse and search through recipe database
- Generate recipes based on fridge contents
- Filter by cuisine (Italian, Mexican, Indian, Chinese)
- Filter by meal type (Breakfast, Lunch, Dinner, Snack)
- Filter by preparation time (Quick, Moderate, Slow)
- Save favorite recipes to your personal collection
- Track ingredient expiration dates

## 🛠️ Technology Stack

### Frontend

- **React 19** with TypeScript
- **React Router 7** for navigation
- **Tailwind CSS 4** for styling
- **Vite 6** for build tooling
- **Axios** for API communication
- **React Hook Form + Yup** for form validation
- **Vitest + Testing Library** for testing

### Backend

- **Spring Boot 3.1** (Java 17)
- **Spring Security** with JWT authentication
- **Spring Data JPA** with Hibernate
- **PostgreSQL** database
- **Flyway** for database migrations
- **MapStruct** for object mapping
- **Lombok** for boilerplate reduction
- **Google Gemini AI** integration

### DevOps & Infrastructure

- **Docker** & **Docker Compose** for containerization
- **Dokploy** as the primary production deployment platform
- **GitHub Actions** Docker CI workflow for image validation/build

## 📁 Project Structure

```
recipeAi/
├── backendApi/              # Spring Boot backend
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/org/jakub/backendapi/
│   │   │   │   ├── config/          # Security, CORS, JWT config
│   │   │   │   ├── controllers/     # REST API endpoints
│   │   │   │   ├── dto/             # Data Transfer Objects
│   │   │   │   ├── entities/        # JPA entities
│   │   │   │   ├── exceptions/      # Custom exceptions
│   │   │   │   ├── mappers/         # MapStruct mappers
│   │   │   │   ├── repositories/    # JPA repositories
│   │   │   │   └── services/        # Business logic
│   │   │   └── resources/
│   │   │       ├── application.yml           # Development config
│   │   │       ├── application-prod.yml      # Production config
│   │   │       └── db/migration/            # Flyway migrations
│   │   └── test/                    # Unit & integration tests
│   ├── build.gradle                 # Gradle build config
│   └── Dockerfile                   # Backend container config
│
├── frontend/recipeai/       # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React Context providers
│   │   ├── lib/             # Utility functions
│   │   ├── pages/           # Page components
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── tests/               # Component tests
│   ├── package.json         # NPM dependencies
│   ├── vite.config.ts       # Vite configuration
│   ├── Dockerfile           # Frontend container config
│   └── nginx.conf.template  # Nginx config for SPA
│
├── postgres/                # PostgreSQL setup
│   ├── Dockerfile
│   ├── init.sql
│   ├── init-admin.sh
│   └── init-user.sh
│
├── docs/                    # Deployment runbooks and env presets
│   ├── DOKPLOY_DEPLOYMENT.md
│   └── DOKPLOY_ENV_PRESETS.md
│
├── docker-compose.yml       # Multi-container orchestration
├── .env.example             # Copy-ready environment template
└── .github/workflows/       # CI pipelines
```

## 🚀 Getting Started

### Prerequisites

- **Docker** and **Docker Compose** installed
- **Java 17** (for local backend development)
- **Node.js 18+** and **npm** (for local frontend development)
- **Google Gemini API Key** (get it from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Environment Variables

Create a `.env` file in the root directory:

```env
# Image-only deployment (published by GitHub Actions)
BACKEND_IMAGE=ghcr.io/your-github-namespace/recipeai-backend:latest
FRONTEND_IMAGE=ghcr.io/your-github-namespace/recipeai-frontend:latest

# Database Configuration
POSTGRES_DB=recipeai
POSTGRES_USER=recipe_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_HOST=db
POSTGRES_PORT=5432

# Backend Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_OAUTH_CLIENT_ID=
ALLOWED_ORIGINS=https://example.com,https://www.example.com
SPRING_PROFILES_ACTIVE=prod
JWT_SECRET_KEY=your_super_long_jwt_secret_min_32_chars
TRUSTED_PROXY_IPS=
JWT_COOKIE_SECURE=true
JWT_COOKIE_SAME_SITE=Lax

# Recipe plan limits
FREE_PLAN_RECIPE_LIMIT=75
PAID_PLAN_RECIPE_LIMIT=-1

# Frontend runtime configuration
FRONTEND_PORT=80

# Frontend configuration:
# - VITE_API_URL is build-time and comes from GitHub Actions Variables (default /api/)
# - GOOGLE_OAUTH_CLIENT_ID is runtime and comes from compose/Dokploy
```

### Quick Start (Dokploy)

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd recipeAi
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Create application in Dokploy**

- Deployment type: Docker Compose
- Compose file: `docker-compose.yml`

4. **Set environment variables in Dokploy UI**

- Use `.env.example` as source of required keys
- Set `BACKEND_IMAGE` and `FRONTEND_IMAGE` to images published by CI (GHCR)
- The database uses the official `postgres:17-alpine` image from `docker-compose.yml`

5. **Deploy and validate**

- Check service logs (`frontend`, `backend`, `db`)
- Verify auth and recipe endpoints from the UI

### Production with Dokploy (Recommended)

1. **Create app in Dokploy from this repository**

- Deployment type: Docker Compose
- Compose file: `docker-compose.yml`

2. **Set environment variables in Dokploy UI**

- Use values from `.env.example`
- Required minimum: `BACKEND_IMAGE`, `FRONTEND_IMAGE`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `GEMINI_API_KEY`, `ALLOWED_ORIGINS`, `JWT_SECRET_KEY`
- For deterministic deploys, use image tags `sha-<commit>` instead of `latest`

3. **Expose services in Dokploy**

- Option A: expose frontend only + configure Dokploy path routing `/api/*` to backend (port 8080)
- Option B: expose frontend (port 80) and backend (port 8080) on separate domain

4. **Deploy and validate**

- Check logs for `frontend`, `backend`, `db`
- Verify login/refresh flow and browser CORS
- If backend logs show `FlywaySqlException` or `SocketTimeoutException: Connect timed out`, the backend cannot reach PostgreSQL. In the bundled compose setup the DB host should normally be `db:5432`; for external databases, update `POSTGRES_HOST` / `POSTGRES_PORT` and confirm network access.
- The bundled database service uses the official `postgres:17-alpine` image and does not need a separate database image variable.

Detailed checklist: `docs/DOKPLOY_DEPLOYMENT.md`

### Local Development

#### Docker Dev Stack

Use the dedicated dev compose file, not `docker compose run`:

```bash
docker compose -f docker-compose.dev.yml up --build
```

The app will be available through nginx on http://localhost.

#### Backend Development

```bash
cd backendApi

# Run with H2 in-memory database (for testing)
./gradlew bootRun

# Run with PostgreSQL (ensure PostgreSQL is running)
SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun

# Run tests
./gradlew test

# Quick compile validation (recommended for this repo right now)
./gradlew compileJava

# Build JAR
./gradlew build
```

The backend will be available at http://localhost:8080

#### Frontend Development

```bash
cd frontend/recipeai

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

The frontend will be available at http://localhost:5173

## 📊 Database Schema

### Main Entities

- **User**: User accounts with authentication

  - Fields: id, email, password, role (USER/ADMIN)
  - Relationships: UserPreferences, Recipes, FridgeIngredients

- **Recipe**: Recipe information

  - Fields: id, name, description, instructions, timeToPrepare
  - Relationships: RecipeIngredients, User

- **FridgeIngredient**: User's fridge inventory

  - Fields: id, name, amount, unit, category, expirationDate
  - Relationships: User

- **UserPreferences**: Dietary preferences

  - Fields: id, diet (VEGAN, VEGETARIAN, etc.), dislikedIngredients
  - Relationships: User

- **RecipeIngredient**: Ingredients in recipes with quantities

  - Relationships: Recipe, Ingredient

- **Ingredient**: Master ingredient list

## 🔌 API Endpoints

### Authentication

- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Recipes

- `GET /recipes/getAllRecipes` - Get all recipes (paginated)
- `GET /recipes/getRecipe/{id}` - Get recipe by ID
- `GET /recipes/searchRecipes/{searchTerm}` - Search recipes
- `POST /recipes/addRecipe` - Create new recipe
- `POST /recipes/generateRecipe` - AI-generate recipe
- `POST /recipes/updateRecipe/{id}` - Update recipe
- `POST /recipes/deleteRecipe/{id}` - Delete recipe
- `GET /recipes/getUserRecipes/{userId}` - Get user's recipes

### Fridge Management

- `GET /fridge/getFridgeIngredients` - Get user's fridge items
- `POST /fridge/addFridgeIngredient` - Add ingredient to fridge
- `POST /fridge/updateFridgeIngredient/{id}` - Update ingredient
- `POST /fridge/deleteFridgeIngredient/{id}` - Remove ingredient

### User Preferences

- `GET /preferences/user/getPreferences` - Get user preferences
- `POST /preferences/user/changeDiet` - Update diet preference
- `POST /preferences/user/addDislikedIngredient` - Add disliked ingredient
- `POST /preferences/user/removeDislikedIngredient` - Remove disliked ingredient
- `GET /preferences/user/getDiets` - Get available diets

### Admin

- `GET /admin/users` - Get all users
- `GET /admin/users/{id}` - Get user by ID
- `PUT /admin/users/{id}/role` - Update user role
- `PUT /admin/users/{id}/plan` - Update user subscription plan (body: `{ "plan": "FREE" }` or `{ "plan": "PAID" }`)
- `POST /admin/users/delete/{id}` - Delete user
- `PUT /admin/recipes/{id}` - Update any recipe
- `POST /admin/deleteRecipe/{id}` - Delete any recipe

## 🔒 Security

- **JWT Authentication**: Stateless token-based authentication
- **Password Encryption**: BCrypt password hashing
- **CORS Configuration**: Configurable allowed origins
- **Role-Based Access Control**: User and Admin roles
- **SQL Injection Prevention**: JPA with parameterized queries
- **XSS Protection**: React's built-in XSS protection

## 🌐 Deployment

### Dokploy (Primary)

Primary production path is Dokploy using `docker-compose.yml`.

```bash
# Core compose validation
docker compose -f docker-compose.yml config

# Pull and roll out newest images
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```

Dokploy-specific runbook:

- `docs/DOKPLOY_DEPLOYMENT.md`

## 🧪 Testing

### Backend Tests

```bash
cd backendApi
./gradlew test
```

Note: Some backend tests may fail to compile due to legacy test code drift. For feature-level validation, prefer:

```bash
cd backendApi
./gradlew compileJava
```

### Frontend Tests

```bash
cd frontend/recipeai
npm run test              # Run tests once
npm run test -- --watch   # Watch mode
npm run test -- --ui      # UI mode
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- Jakub - Initial work

## 🙏 Acknowledgments

- Google Gemini AI for recipe generation
- Spring Boot community
- React community
- All open-source contributors

**Built with ❤️ using Spring Boot, React, and AI**
