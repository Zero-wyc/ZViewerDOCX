# Admin Panel

The admin panel is ZViewer's administrative control center, where you can manage users, rooms, system settings, and version updates.

---

## How to Access the Admin Panel

There are two ways to access it:

1. **Homepage button**: On the homepage, find the "**Permissions**" button in the top navigation bar or on the page, and click to enter
2. **Direct URL**: Enter `http://your-server-address/admin` in the browser address bar (e.g., `http://192.168.1.100:3000/admin`)

> Only **root** and **admin** roles can see and access the admin panel. If you are a regular user or guest, the entry will not be displayed.

## Overview of the Four Tabs

Once you enter the admin panel, you will see four tabs at the top:

| Tab | Description | Available Roles |
|---|---|---|
| **User Management** | Manage user registrations, roles, and approvals | root only |
| **Room Management** | View and manage all rooms | root + admin |
| **Basic Settings** | Modify global system settings | root only |
| **Version Updates** | Check for and apply updates | root + admin |

---

## User Management Tab (root only)

### Registration Method Settings

1. In the "Registration Method" dropdown, select the desired mode:
   - **Open Registration**: Anyone who registers is activated immediately
   - **Approval Registration**: Registration requires approval
   - **Registration Closed**: The registration entry is disabled
2. Click the "**Save**" button next to it; the setting takes effect immediately

### User List

The page lists all registered users, displaying the following information:

- Username
- Role (root / admin / user / guest)
- Status (active / pending)
- Registration time

### Approving Users

For users with a "Pending" status, an "**Approve**" button appears in the action column. Clicking it upgrades the user to a full user role.

### Changing Roles

Click "**Change Role**" in the user's action column to promote the user to admin or demote them to user/guest.

> Note: You cannot modify the root role's permissions, nor can you demote the last remaining root user.

### Deleting Users

Click the "**Delete**" button to remove the user. This action cannot be undone, so proceed with caution.

---

## Room Management Tab

### Room List

This tab lists **all** rooms currently on the server, including those created by other users. Each entry displays:

- Room name
- Owner (creator)
- Current online count
- Viewing mode

### View Switching

Two viewing modes are supported:

- **List View**: Displayed as a table with more detailed information
- **Card View**: Displayed as cards for a more intuitive look

Click the toggle button in the top-right corner to switch.

### Batch Operations

Select the checkboxes on the left of multiple rooms, then:

- **Batch Delete**: Delete the selected rooms
- **Delete All**: Clear all rooms on the server (root only)
- **Clean Unused Rooms**: Automatically delete rooms with no viewers
- **Refresh**: Reload the room list to get the latest data

> Deleting a room will disconnect all viewers in that room.

---

## Basic Settings Tab (root only)

### Auto Cleanup

When enabled, the system automatically deletes rooms that have been unoccupied for a long time:

- **Auto Cleanup Toggle**: Enable/disable this feature
- **Cleanup Time**: Set the number of hours after which an empty room is automatically deleted (e.g., 24 hours)

### Room Creation Permission

Choose who can create rooms:

- **Admin Only**: Only root and admin can create rooms
- **All Users**: User role can also create rooms

### Beta Feature Toggles

You can enable or disable the following experimental features:

- **Kazumi Anime Source**: Kazumi anime data source
- **AniSubs Anime Source**: AniSubs anime data source
- **Bilibili Download**: Bilibili video download feature

Enabling beta features may affect system stability; use them as needed.

### Kazumi Rule Source Configuration

If you use the Kazumi data source, you can configure the rule source URL here. Modifying this will clear the anime source cache and re-fetch data.

---

## Version Updates Tab

### Check for Updates

Click the "**Check for Updates**" button, and the system will automatically query GitHub for new versions. If a new version is available, the version number and update details will be displayed.

### One-Click Update

Click the "**One-Click Update**" button, and the system will automatically download and apply the latest version. During the update process, the server will restart briefly, and users currently watching may be disconnected.

### Manual Update Package Import

If the server cannot directly access GitHub (e.g., in an internal network environment), you can:

1. Download the update package (`.zip` or `.tar.gz` format, up to 500MB) on another computer
2. Click "**Choose File**" on this page
3. Select the downloaded update package
4. Click "**Upload and Apply**"

### Receive Pre-release Versions

When this option is enabled, checking for updates will also show pre-release versions. Pre-release versions contain the latest features but may not be stable; it is recommended to use them only in test environments.

---

## Frequently Asked Questions

### Cannot see the admin panel entry

Possible reasons:

1. The currently logged-in account is not a **root** or **admin** role
2. You are not logged in, or your session has expired
3. The page has not been refreshed -- try refreshing the homepage or directly accessing the `/admin` path

### Buttons are grayed out and cannot be clicked

- Certain operations (such as approving users, changing roles) are **root only**
- If you are an admin, seeing grayed-out buttons is normal because these features are not available to you

### What to do if the update fails

1. Check whether the server can access GitHub (whether `github.com` is reachable)
2. If network access is restricted, use the "Manual Update Package Import" method
3. Check the server logs for more detailed error information
4. If one-click update repeatedly fails, try downloading the update package manually and uploading it