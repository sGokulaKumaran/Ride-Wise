# 🚀 RideWise: The Full-Stack Workflow Guide

Welcome to the beginner-friendly guide to how your RideWise app actually works under the hood! 

We are going to break down exactly what happens from the moment a user clicks a button on the screen, all the way deep into your database, and back again.

---

## 🏗️ Part 1: The Big Picture (The Architecture)

Your project is split into two completely separate programs that talk to each other over the internet (or in your case, over `localhost`).

1. **The Frontend (React + Vite):** This is the user interface. It runs in the user's browser. Its job is to look pretty, handle button clicks, and show data. It runs on `http://localhost:5173`.
2. **The Backend (Spring Boot):** This is the brain of the operation. It runs on a server. Its job is to do the heavy lifting: verifying passwords, saving data, and searching. It runs on `http://localhost:8080`.
3. **The Database (H2):** This is the filing cabinet where data is permanently (or in our case, temporarily) stored.

### How do they talk?
When the Frontend wants the Backend to do something, it sends an **HTTP Request** (like sending a letter). The Vite server acts as a middleman (a **Proxy**) that forwards this letter from port 5173 to port 8080 so the browser doesn't block it for security reasons (CORS).

---

## 🏢 Part 2: The Backend Layers (The "Restaurant" Analogy)

Before we trace a specific action, you need to understand how your Spring Boot backend is organized. It uses a standard pattern called **N-Tier Architecture**. Think of your backend like a restaurant:

* **Controller (`AuthController.java`) ➔ The Waiter:** 
  The Controller is the first point of contact. It takes the "order" (HTTP request) from the frontend, makes sure it makes sense, and hands it off to the kitchen. It doesn't cook the food itself.
* **DTO (`AuthRequest.java`, `UserResponse.java`) ➔ The Order Ticket / The Plated Food:**
  DTO stands for *Data Transfer Object*. It's a simple Java class used purely to carry data between the frontend and backend. 
  - `AuthRequest` is the ticket the waiter writes down (Email + Password). 
  - `UserResponse` is the food on the plate sent back to the customer (User data, *without* the password).
* **Service (`AuthService.java`) ➔ The Chef:**
  This is where the actual "business logic" happens. The Chef hashes the password, checks if the email already exists, and prepares the data to be saved.
* **Repository (`UserRepository.java`) ➔ The Pantry Manager:**
  The Chef doesn't go to the farm to get ingredients. They ask the Pantry Manager. The Repository's *only* job is to talk to the Database (saving, finding, deleting).
* **Entity (`User.java`) ➔ The Ingredients / The Database Table:**
  An Entity is a Java class that represents an exact row in your database table. 

---

## 🗺️ Part 3: The Journey of a Signup (Top to Bottom)

Let's trace exactly what happens when a brand new user tries to sign up.

### 1. The Frontend (React)
- The user types their email and password into the `Login.jsx` page and clicks "Sign Up".
- This triggers the `signup()` function inside [`AuthContext.jsx`](file:///E:/My%20projects/RideWise/frontend/src/context/AuthContext.jsx).
- `AuthContext` uses the `fetch()` command to send an HTTP POST request to `/api/auth/signup` containing a JSON package: `{"email": "john@test.com", "password": "123"}`.

### 2. The Controller (Spring Boot)
- The request hits [`AuthController.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/controller/AuthController.java).
- Spring Boot automatically takes the JSON string and converts it into your `AuthRequest` DTO object.
- The Controller says: *"Hey AuthService (Chef), someone wants to sign up with this AuthRequest!"*

### 3. The Service (Spring Boot)
- [`AuthService.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/service/AuthService.java) takes over. 
- **Rule Check:** It asks the `UserRepository`: *"Does this email already exist?"* If yes, it throws an error.
- **Security:** It takes the plain-text password ("123") and uses BCrypt to scramble it into a hash (e.g., `$2a$10$w...`). *We never save raw passwords!*
- **Preparation:** It creates a brand new `User` Entity object and fills it with the email and the scrambled password.
- It hands the `User` Entity to the `UserRepository` and says: *"Save this to the database!"*

### 4. The Repository & Database (Spring Boot / H2)
- [`UserRepository.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/repository/UserRepository.java) takes the `User` Entity and writes a new row into the H2 Database. The database automatically generates a unique ID (e.g., `1`) and a timestamp.

### 5. The Return Journey (Service ➔ Controller)
- The Repository gives the saved `User` Entity back to the `AuthService`.
- The `AuthService` converts the `User` Entity into a `UserResponse` DTO. Why? Because the `User` Entity has the scrambled password on it, and we **do not** want to send that back over the internet to the frontend!
- The `AuthService` gives the safe `UserResponse` back to the `AuthController`.
- The `AuthController` wraps it in an "OK" (200 status) message and sends it back to the React frontend as JSON.

### 6. The End (React)
- `AuthContext.jsx` receives the JSON response (which includes the new user's ID).
- It saves this user object in the browser's `localStorage` so the user stays logged in if they refresh the page.
- It updates the React state (`setUser`), which tells the app to transition the user to the `/onboarding` page.

---

## 🗺️ Part 4: The Journey of a Login

Now, what happens when that user comes back the next day?

1. **Frontend:** User types email and password, clicks Login. `AuthContext.jsx` sends a POST to `/api/auth/login`.
2. **Controller:** `AuthController` receives it and passes it to `AuthService.login()`.
3. **Service (The Chef's Check):** 
   - `AuthService` asks `UserRepository`: *"Go find a User in the database with this email."*
   - If the user isn't found, it throws an error ("No account found").
   - If the user *is* found, it grabs the scrambled password from the database.
   - It uses the BCrypt tool to check if the plain-text password the user just typed mathematically matches the scrambled password in the database.
   - If they don't match, it throws an error ("Incorrect password").
4. **Return Journey:** If they match, `AuthService` converts the database `User` into a `UserResponse` DTO and hands it back to the Controller.
5. **Frontend:** React receives the data, saves it to `localStorage`, and lets the user into the `/home` page.

---

## 🗺️ Part 5: Exploring Riders (Connections)

Let's look at one more flow: clicking the "Add" button on the Riders page.

1. **Frontend:** You click "Add" next to a user. [`Riders.jsx`](file:///E:/My%20projects/RideWise/frontend/src/pages/Riders.jsx) calls `addRider(myId, theirId)`. This sends a POST request to `/api/riders/add`.
2. **Controller:** [`RidersController.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/controller/RidersController.java) receives the two IDs and passes them to `RidersService.addRider()`.
3. **Service:** [`RidersService.java`](file:///E:/My%20projects/RideWise/backend/ridewise/src/main/java/vehicle/ridewise/service/RidersService.java) asks the `ConnectionRepository`: *"Are these two already connected?"*
4. **Repository:** If not, the Service creates a new `Connection` Entity (which links `userId` and `connectedUserId`) and tells the `ConnectionRepository` to save it.
5. **Return:** The Controller sends back `{ "success": true }`.
6. **Frontend Update:** React sees the success, shows a green Toast notification ("✅ Added!"), and immediately triggers a background fetch to get your updated connections list so the UI changes instantly.

---

## Summary of the Flow Rule

If you want to add a brand new feature to your app tomorrow (like "Adding a Motorcycle Profile"), you would follow this exact same path:

1. Create a `Motorcycle` **Entity** (to create the DB table).
2. Create a `MotorcycleRepository` (to talk to the DB).
3. Create `MotorcycleRequest` and `MotorcycleResponse` **DTOs** (for internet travel).
4. Create a `MotorcycleService` (for the logic).
5. Create a `MotorcycleController` (to receive the HTTP request).
6. Create an `api.js` function in React (to send the HTTP request).
7. Call that function from a button in a `.jsx` component.
