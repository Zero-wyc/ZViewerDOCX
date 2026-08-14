# Permission Model

ZViewer's permission system is divided into four roles, from highest to lowest: **root (super admin)**, **admin**, **user**, and **guest**. The table below gives you a clear overview of what each role can and cannot do.

## Four-Tier Role Comparison

| Feature | root | admin | user | guest |
|---|---|---|---|---|
| Access admin panel | Yes | Yes | No | No |
| Approve user registrations | Yes | No | No | No |
| Change other users' roles | Yes | No | No | No |
| Delete any user | Yes | No | No | No |
| Delete any room | Yes | No | No | No |
| Create rooms | Yes | Yes | Depends on settings | No |
| Full control of own room | Yes | Yes | Yes | No |
| Join rooms to watch | Yes | Yes | Yes | Yes |
| Send comments and danmaku | Yes | Yes | Yes | Yes |
| Modify system settings | Yes | No | No | No |
| Check and apply updates | Yes | Yes | No | No |
| Manage server files | Yes | No | No | No |

> **Quick reference**: root has all permissions; admin can manage rooms and updates but cannot manage users; user can watch and interact, and may be able to create rooms; guest can only watch and interact, and cannot create rooms.

---

## Registration and Approval Process

### Three Registration Modes

Admins can choose the registration mode in the "Basic Settings" section of the admin panel:

| Mode | Effect |
|---|---|
| **Open Registration (open)** | Anyone who registers is activated automatically and becomes a user role immediately |
| **Approval Registration (approval)** | After registration, the account enters a pending state and requires root approval before use |
| **Registration Closed (closed)** | The registration entry is disabled; new users cannot register |

### Registration Steps

1. Go to the homepage and click the "Register" button
2. Fill in your username and password, then submit
3. Depending on the registration mode:
   - **Open mode**: Registration activates immediately; you can log in directly
   - **Approval mode**: After registration, you will see a "Waiting for Approval" message; your role will be guest with limited functionality
   - **Closed mode**: The registration entry is not visible on the page

### Approval Operations (root only)

1. Go to the admin panel -> "User Management" tab
2. Find users with the "Pending" status
3. Click the "Approve" button to upgrade the user to a full user role

---

## Guest Identity

### Automatic Assignment

When you visit ZViewer without logging in, the system automatically assigns you a **guest** identity. You can use the service without registering.

### What Guests Can Do

- Join existing rooms and watch videos
- Send comments and danmaku

### What Guests Cannot Do

- Create rooms
- Access the admin panel
- Modify personal profile

### Becoming a Full User

If you want more features, you can:

1. Click "Login/Register" on the page
2. Register a new account (if the registration mode is open, you become a user immediately)
3. After logging in, you will automatically gain more permissions

---

## Room Creation Permission

Admins can set who can create rooms in the "Basic Settings":

- **Admin Only**: Only root and admin roles can create rooms
- **All Users**: User role can also create rooms

Guests cannot create rooms under any circumstances.

---

## Authentication Mechanism Overview

ZViewer uses a **dual-token** mechanism to ensure security:

- **Access Token**: Short-lived (default 15 minutes), used to authenticate every request
- **Refresh Token**: Long-lived (default 7 days), used to automatically renew the access token after it expires

These tokens are stored in the browser via **httpOnly Cookies**, which regular JavaScript cannot read, effectively preventing XSS attacks from stealing tokens.

In short: you log in once, and the system remembers you for a period of time without requiring repeated password entry.

---

## Frequently Asked Questions

### Cannot create rooms after registration

Possible reasons:

1. Your role is **guest** (pending approval or newly registered). Root needs to approve you in the admin panel to upgrade you to **user**
2. Room creation permission is set to "Admin Only" and you are a user role
3. The registration mode is "Open Registration" but the system did not activate correctly -- contact the administrator to check

### How to make a user an admin?

Only **root** can promote other users to admin:

1. Go to the admin panel -> "User Management" tab
2. Find the user
3. Click "Change Role", select admin
4. Save

### Forgot the root password?

If you lose access to the root account password, you can recover it using the following methods:

1. If you have command-line access to the server, run a reset script or modify the database directly
2. If environment variables or initial configuration were set during deployment, refer to the deployment documentation for the reset method
3. Contact the server administrator to modify the user password directly in the database (requires knowledge of database operations)