# eSSL F22 Biometric Attendance Integration Server
## Multi-Gym (Multi-Tenant) System

A production-grade Node.js middleware server to integrate **eSSL F22 Biometric Attendance machines** with **Supabase** using the **ADMS/Push Data protocol**.

> 🏢 **Supports Multiple Gyms** - One backend serves unlimited gym locations with isolated data.

---

## 📋 Table of Contents

1. [System Overview](#-system-overview)
2. [How It Works - Complete Flow](#-how-it-works---complete-flow)
3. [Database Schema](#-database-schema)
4. [Quick Start Setup](#-quick-start-setup)
5. [Machine Configuration](#-essl-f22-machine-configuration)
6. [FAQ - Important Questions](#-faq---important-questions)
7. [Testing with Postman](#-testing-with-postman)
8. [Complete Example Walkthrough](#-complete-example-walkthrough)
9. [Troubleshooting](#-troubleshooting)

---

## 🏗️ System Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          MULTI-GYM SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│   │   GYM A     │    │   GYM B     │    │   GYM C     │                │
│   │ ┌─────────┐ │    │ ┌─────────┐ │    │ ┌─────────┐ │                │
│   │ │eSSL F22 │ │    │ │eSSL F22 │ │    │ │eSSL F22 │ │                │
│   │ │SN: ABC1 │ │    │ │SN: XYZ2 │ │    │ │SN: PQR3 │ │                │
│   │ └────┬────┘ │    │ └────┬────┘ │    │ └────┬────┘ │                │
│   └──────┼──────┘    └──────┼──────┘    └──────┼──────┘                │
│          │                  │                  │                        │
│          └──────────────────┼──────────────────┘                        │
│                             │                                           │
│                             ▼                                           │
│              ┌─────────────────────────────┐                            │
│              │    BIOMETRIC SERVER         │                            │
│              │    (This Fastify App)       │                            │
│              │                             │                            │
│              │  1. Receive fingerprint     │                            │
│              │  2. Map SN → gym_id         │                            │
│              │  3. Check membership        │                            │
│              │  4. Save to Supabase        │                            │
│              └─────────────┬───────────────┘                            │
│                            │                                            │
│                            ▼                                            │
│              ┌─────────────────────────────┐                            │
│              │       SUPABASE              │                            │
│              │  ┌───────────────────────┐  │                            │
│              │  │ gyms                  │  │                            │
│              │  │ devices (SN→gym_id)   │  │                            │
│              │  │ members (fingerprints)│  │                            │
│              │  │ attendance_logs       │  │                            │
│              │  └───────────────────────┘  │                            │
│              └─────────────────────────────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Device SN** | Serial Number printed on the biometric device (e.g., `ABCD12345678`) |
| **Fingerprint PIN** | The ID assigned when registering a fingerprint (e.g., `1`, `2`, `3`) |
| **gym_id Mapping** | Server maps Device SN → gym_id (device does NOT send gym_id) |
| **ADMS Protocol** | Standard protocol used by eSSL devices to push attendance data |

---

## 🔄 How It Works - Complete Flow

### Flow 1: Registering a New Gym Member's Fingerprint

```
STEP-BY-STEP: Registering "Rahul Kumar" at Gym A

1. GYM ADMIN creates member in YOUR ADMIN PANEL:
   ┌─────────────────────────────────────────┐
   │ Create Member                           │
   │ Name: Rahul Kumar                       │
   │ Phone: 9876543210                       │
   │ Fingerprint ID: 5  ◄── IMPORTANT!      │
   │ Membership End: 2026-06-30              │
   └─────────────────────────────────────────┘
   
   This inserts into Supabase:
   INSERT INTO members (gym_id, fingerprint_id, full_name, phone)
   VALUES ('gym-a-uuid', '5', 'Rahul Kumar', '9876543210');
   
   -- Then create membership:
   INSERT INTO memberships (member_id, gym_id, plan_id, start_date, end_date, status)
   VALUES ('member-uuid', 'gym-a-uuid', 'plan-uuid', '2026-01-01', '2026-06-30', 'active');

2. GYM ADMIN goes to the eSSL F22 MACHINE:
   ┌─────────────────────────────────────────┐
   │ On Machine Menu:                        │
   │ Menu → User Mgt → New User              │
   │   User ID: 5  ◄── SAME AS fingerprint_id│
   │   Name: Rahul                           │
   │ → Press "Enroll FP" (Fingerprint)       │
   │ → Member places finger 3 times          │
   │ → Machine shows "Enrolled Successfully" │
   └─────────────────────────────────────────┘

3. NOW Rahul can use his fingerprint!
   - fingerprint_id on machine = 5
   - fingerprint_id in database = 5
   - They MUST match!
```

### Flow 2: What Happens When User Scans Fingerprint

```
TIMELINE: Rahul scans fingerprint at 9:30 AM

┌────────────────────────────────────────────────────────────────────────┐
│ 9:30:00 │ Rahul places finger on eSSL F22 device                      │
├────────────────────────────────────────────────────────────────────────┤
│ 9:30:01 │ Machine recognizes fingerprint, finds PIN=5                  │
│         │ Machine shows: "Rahul ✓" with voice "Thank You"             │
├────────────────────────────────────────────────────────────────────────┤
│ 9:30:02 │ Machine sends HTTP POST to YOUR SERVER:                      │
│         │                                                              │
│         │ POST /iclock/cdata?SN=ABCD12345678                          │
│         │ Body: "5\t2026-01-10 09:30:00\t0\t1"                         │
│         │       ▲              ▲        ▲  ▲                          │
│         │       PIN          TIME    STATUS VERIFY_TYPE               │
├────────────────────────────────────────────────────────────────────────┤
│ 9:30:02 │ YOUR SERVER receives request:                                │
│         │                                                              │
│         │ 1. Extract SN = "ABCD12345678"                              │
│         │ 2. Query: SELECT gym_id FROM devices WHERE device_sn = SN   │
│         │    Result: gym_id = "gym-a-uuid"                            │
│         │                                                              │
│         │ 3. Query: SELECT m.*, ms.end_date, ms.status               │
│         │           FROM members m                                    │
│         │           JOIN memberships ms ON ms.member_id = m.id        │
│         │           WHERE m.gym_id = "gym-a-uuid"                     │
│         │           AND m.fingerprint_id = "5"                        │
│         │    Result: member_id, end_date = 2026-06-30                │
│         │                                                              │
│         │ 4. Check: Is 2026-06-30 >= today (2026-01-10)?             │
│         │    YES → membership_status = "ACTIVE"                       │
│         │                                                              │
│         │ 5. INSERT INTO attendance_logs:                             │
│         │    (gym_id, user_id, member_id, status, membership_status)  │
├────────────────────────────────────────────────────────────────────────┤
│ 9:30:03 │ SERVER responds: "OK"                                        │
│         │ Machine continues normal operation                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: What If Membership is Expired?

```
⚠️ IMPORTANT: The eSSL F22 machine DOES NOT know about memberships!

SCENARIO: Priya's membership.end_date is 2026-01-05
          Today is 2026-01-10

┌────────────────────────────────────────────────────────────────────────┐
│ WHAT HAPPENS ON THE MACHINE:                                           │
├────────────────────────────────────────────────────────────────────────┤
│ • Priya places finger                                                  │
│ • Machine recognizes fingerprint (PIN=2)                              │
│ • Machine shows: "Priya ✓" with voice "Thank You"                     │
│                                                                        │
│ ✅ Machine ALWAYS shows SUCCESS if fingerprint is valid               │
│ ❌ Machine does NOT check membership - it has no such data            │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ WHAT HAPPENS ON YOUR SERVER:                                           │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Receive attendance data (PIN=2)                                     │
│ 2. Lookup member: Priya, membership_end = 2026-01-05                  │
│ 3. Check: 2026-01-05 < 2026-01-10 (today)                             │
│ 4. Set: membership_status = "EXPIRED"                                  │
│ 5. Save attendance with EXPIRED status                                 │
│ 6. LOG WARNING: "⚠️ EXPIRED MEMBERSHIP CHECK-IN"                       │
│ 7. Return "OK" (don't block device)                                   │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ DATA SAVED IN SUPABASE:                                                │
├────────────────────────────────────────────────────────────────────────┤
│ {                                                                      │
│   "gym_id": "gym-a-uuid",                                             │
│   "user_id": "2",                                                      │
│   "member_id": "priya-uuid",                                          │
│   "status": "CHECK_IN",                                                │
│   "membership_status": "EXPIRED",  ◄── THIS MARKS EXPIRED             │
│   "timestamp": "2026-01-10T09:30:00Z"                                 │
│ }                                                                      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│ HOW TO HANDLE EXPIRED MEMBERSHIPS:                                     │
├────────────────────────────────────────────────────────────────────────┤
│ Option 1: DASHBOARD ALERT                                              │
│ • Show real-time notification in your admin panel                     │
│ • "⚠️ Priya Sharma checked in with EXPIRED membership!"              │
│                                                                        │
│ Option 2: BLOCK AT GATE (Manual)                                       │
│ • Security person sees alert, stops member                            │
│ • Asks to renew membership                                             │
│                                                                        │
│ Option 3: DELETE FINGERPRINT (Drastic)                                 │
│ • Delete PIN from machine when membership expires                      │
│ • Member cannot check in at all                                        │
│ • You can automate this with device commands                          │
│                                                                        │
│ Option 4: DAILY REPORT                                                 │
│ • Run query: SELECT * FROM attendance_logs                            │
│              WHERE membership_status = 'EXPIRED'                       │
│              AND timestamp::date = CURRENT_DATE                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 💾 Database Schema

Run this SQL in **Supabase SQL Editor**:

```sql
-- See schema.sql for complete SQL
-- Key tables:
-- 1. gyms - Each gym is a tenant
-- 2. devices - Maps device SN to gym_id
-- 3. members - Gym members with fingerprint_id
-- 4. attendance_logs - All check-ins with membership status
-- 5. device_commands - Queue commands to devices
```

### Entity Relationship

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│    GYMS     │     │   DEVICES   │     │    MEMBERS      │
├─────────────┤     ├─────────────┤     ├─────────────────┤
│ id (PK)     │◄────│ gym_id (FK) │     │ id (PK)         │
│ name        │     │ device_sn   │     │ gym_id (FK)     │
│ owner_name  │     │ location    │     │ fingerprint_id  │
└─────────────┘     └─────────────┘     │ name            │
      │                   │             │ membership_end  │
      │                   │             └─────────────────┘
      │                   │                    │
      ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│                    ATTENDANCE_LOGS                       │
├─────────────────────────────────────────────────────────┤
│ id (PK)                                                 │
│ gym_id (FK) ────────────────► Gym this attendance is for│
│ device_sn ──────────────────► Which device was used     │
│ user_id ────────────────────► Fingerprint PIN           │
│ member_id (FK) ─────────────► Linked member profile     │
│ membership_status ──────────► ACTIVE, EXPIRED, etc.     │
│ timestamp                                               │
│ status (CHECK_IN/CHECK_OUT)                             │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Setup

### Step 1: Install Dependencies

```bash
cd biometric-server
npm install
```

### Step 2: Configure Environment

```bash
# Create .env file
copy .env.example .env

# Edit .env with your Supabase credentials:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=8080
```

### Step 3: Setup Database

Your main schema is already in `/app/supabase/schema.sql`.

Run the **biometric migration** to add the required tables:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `biometric-server/migrations/001_biometric_integration.sql`
3. Run the SQL

This migration will:
- Add `fingerprint_id` column to your existing `members` table
- Create `devices` table (maps device SN → gym_id)
- Create `attendance_logs` table (biometric attendance)
- Create `device_commands` table (queue commands to devices)

### Step 4: Register Your Device

```sql
-- Get your gym_id first
SELECT id, name FROM gyms;

-- Register your eSSL F22 device
-- Replace with YOUR actual device serial number (from Menu → Sys Info)
INSERT INTO devices (gym_id, device_sn, device_name, location) 
VALUES ('your-gym-uuid', 'YOUR_DEVICE_SN', 'Main Entrance', 'Front Door');
```

### Step 5: Assign Fingerprint IDs to Members

```sql
-- Update existing members with fingerprint IDs
-- The ID must match what you assign on the machine!
UPDATE members SET fingerprint_id = '1' WHERE full_name = 'Arjun Kumar';
UPDATE members SET fingerprint_id = '2' WHERE full_name = 'Sneha Reddy';
UPDATE members SET fingerprint_id = '3' WHERE full_name = 'Karthik Nair';

-- Note: Membership dates are in the memberships table, not members table
```

### Step 5: Start Server

```bash
npm run dev
```

You should see:
```
╔══════════════════════════════════════════════════════════════╗
║     eSSL F22 Biometric Attendance Server                     ║
║  Server running on: http://0.0.0.0:8080                      ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📟 eSSL F22 Machine Configuration

### Finding Your Device Serial Number

1. On machine: **Menu** → **Sys Info**
2. Note down **Serial Number** (e.g., `ABCD12345678`)
3. This SN must be registered in your `devices` table!

### Network Settings

On machine: **Menu** → **COMM.** → **Ethernet**

| Setting | Value |
|---------|-------|
| IP Address | e.g., `192.168.1.100` (static IP for device) |
| Subnet Mask | `255.255.255.0` |
| Gateway | `192.168.1.1` (your router) |

### ADMS/Push Server Settings

On machine: **Menu** → **COMM.** → **Cloud Server** (or **ADMS**)

| Setting | Value | Notes |
|---------|-------|-------|
| **Enable ADMS** | `Yes` | Must be enabled |
| **Server Address** | `http://192.168.1.50:8080` | Your server IP |
| **Server Port** | `8080` | Same as your server |
| **Heartbeat** | `30` | Seconds between pings |
| **Trans Interval** | `1` | Minutes (1 = realtime) |
| **Realtime Mode** | `Yes` | Push immediately |

### Register a Member's Fingerprint on Machine

```
On the eSSL F22 Device:

1. Press M/OK to enter Menu
2. Go to: User Mgt → New User
3. Enter User ID: [SAME NUMBER AS fingerprint_id IN DATABASE]
   Example: If database has fingerprint_id = 5, enter 5 here
4. Enter Name (optional, just for display)
5. Press "Enroll FP" to register fingerprint
6. Member places finger 3 times
7. Done! Machine shows "Enrolled Successfully"

⚠️ CRITICAL: The User ID on machine MUST match fingerprint_id in database!
```

---

## ❓ FAQ - Important Questions

### Q1: How do I register a user's fingerprint with the machine?

**Answer:**

The fingerprint registration is done **on the machine itself** (not via software):

1. **In Your Admin Panel/Database:**
   ```sql
   -- Create member with a fingerprint_id
   INSERT INTO members (gym_id, fingerprint_id, full_name, phone)
   VALUES ('your-gym-uuid', '5', 'Rahul Kumar', '9876543210');
   
   -- Then create their membership
   INSERT INTO memberships (member_id, gym_id, plan_id, start_date, end_date, status)
   VALUES ('member-uuid', 'your-gym-uuid', 'plan-uuid', '2026-01-01', '2026-12-31', 'active');
   ```

2. **On the eSSL F22 Machine:**
   - Menu → User Mgt → New User
   - User ID: `5` (MUST match fingerprint_id!)
   - Press "Enroll FP"
   - Member places finger 3 times
   - Done!

3. **The Link:**
   - Machine stores: `User ID 5 = Rahul's fingerprint`
   - Database stores: `fingerprint_id 5 = Rahul Kumar`
   - When Rahul scans finger → Machine sends `PIN=5` → Server finds Rahul

---

### Q2: What happens when a user enters their fingerprint?

**Answer:**

```
Step-by-step flow:

1. USER → Places finger on machine
   
2. MACHINE → Recognizes fingerprint pattern
           → Finds matching User ID (PIN)
           → Shows "User Name ✓" on screen
           → Says "Thank You" (voice)
           → Sends data to server

3. SERVER → Receives: POST /iclock/cdata?SN=ABC123
                      Body: "5\t2026-01-10 09:30:00\t0"
          → Looks up device SN in 'devices' table
          → Gets gym_id for this device
          → Looks up member with fingerprint_id = 5
          → Checks if membership is valid
          → Saves attendance with all details
          → Returns "OK"

4. DATABASE → Stores complete record:
   {
     gym_id: "...",
     user_id: "5",
     member_id: "...",
     membership_status: "ACTIVE" or "EXPIRED",
     timestamp: "2026-01-10T09:30:00Z"
   }
```

---

### Q3: What if user's membership is expired? Does machine show failure?

**Answer:**

**NO! The machine will ALWAYS show SUCCESS if the fingerprint is valid.**

The eSSL F22 machine **does not know** about memberships. It only knows:
- ✅ Is this fingerprint registered? (Yes/No)
- If Yes → Show success, send data
- If No → Show "Not Registered"

**Membership checking happens on YOUR SERVER:**

```
┌─────────────────────────────────────────────────────────────┐
│ Machine Behavior:                                           │
│                                                             │
│ • Valid fingerprint → Always shows ✓ SUCCESS               │
│ • Invalid fingerprint → Shows "Not Registered"             │
│                                                             │
│ The machine has NO concept of:                              │
│ • Membership dates                                          │
│ • Payment status                                            │
│ • Active/Inactive members                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Your Server Behavior:                                       │
│                                                             │
│ • Receives all check-ins                                    │
│ • Looks up member in database                              │
│ • Checks membership_end date                               │
│ • Tags attendance as "ACTIVE" or "EXPIRED"                 │
│ • Logs warning for expired memberships                     │
│ • You can alert staff via dashboard/notification           │
└─────────────────────────────────────────────────────────────┘
```

**How to handle expired members:**

| Method | Description |
|--------|-------------|
| **Dashboard Alert** | Show real-time notification when expired member checks in |
| **Daily Report** | Query `WHERE membership_status = 'EXPIRED'` |
| **Delete from Machine** | Delete user from machine when membership expires (manual or via command) |
| **SMS/Notification** | Send member reminder to renew |

**To completely block expired members:**
```sql
-- Queue command to delete user from machine
INSERT INTO device_commands (gym_id, device_sn, command_string)
VALUES ('gym-uuid', 'ABCD12345678', 'DATA DEL USER PIN=5');

-- Next time device polls, it will receive and execute this command
```

---

## 🧪 Testing with Postman

### 1. Health Check

```
GET http://localhost:8080/health

Response:
{
  "status": "ok",
  "timestamp": "2026-01-10T09:30:00.000Z"
}
```

### 2. Simulate Attendance (Check-in)

```
POST http://localhost:8080/iclock/cdata?SN=ABCD12345678

Headers:
Content-Type: text/plain

Body (raw):
1	2026-01-10 09:30:00	0	1

Response:
OK
```

**Parameters explained:**
- `SN=ABCD12345678` - Your device serial number
- Body format: `PIN\tTIME\tSTATUS\tVERIFY_TYPE`
- STATUS: 0=Check-In, 1=Check-Out

### 3. Test Multiple Check-ins

```
POST http://localhost:8080/iclock/cdata?SN=ABCD12345678

Body:
1	2026-01-10 09:30:00	0	1
2	2026-01-10 09:31:00	0	1
3	2026-01-10 09:32:00	0	1

Response:
OK
```

### 4. Test Expired Member

First, make sure you have a member with expired membership:
```sql
-- Insert member
INSERT INTO members (gym_id, fingerprint_id, full_name, phone)
VALUES ('gym-uuid', '99', 'Expired User', '9999999999')
RETURNING id;

-- Insert expired membership (use member id from above)
INSERT INTO memberships (member_id, gym_id, plan_id, start_date, end_date, status)
VALUES ('member-id-from-above', 'gym-uuid', 'some-plan-uuid', '2024-01-01', '2025-01-01', 'expired');
```

Then test:
```
POST http://localhost:8080/iclock/cdata?SN=ABCD12345678
Body: 99	2026-01-10 09:30:00	0	1
```

Check server logs - you'll see: `⚠️ EXPIRED MEMBERSHIP CHECK-IN`

---

## 📖 Complete Example Walkthrough

### Scenario: Setting Up "FitZone Gym"

```sql
-- STEP 1: Create the gym
INSERT INTO gyms (name, owner_name, address)
VALUES ('FitZone Gym', 'Arun Patel', '45 MG Road, Mumbai');

-- Get the gym_id (let's say it's: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa)

-- STEP 2: Register the biometric device
-- (Get serial number from machine: Menu → Sys Info)
INSERT INTO devices (gym_id, device_sn, device_name, location)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FZ2024001', 'Entry Device', 'Main Entrance');

-- STEP 3: Add members
INSERT INTO members (gym_id, fingerprint_id, full_name, phone) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1', 'Rahul Kumar', '9876543210'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2', 'Priya Sharma', '9876543211'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '3', 'Amit Singh', '9876543212');

-- STEP 4: Create memberships for these members
-- First, create a membership plan if you don't have one
INSERT INTO membership_plans (gym_id, name, duration_days, price)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '6 Month Plan', 180, 5000.00)
RETURNING id;

-- Then add memberships (replace member IDs and plan ID with actual values)
INSERT INTO memberships (member_id, gym_id, plan_id, start_date, end_date, status) VALUES
('rahul-member-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'plan-id-from-above', '2026-01-01', '2026-06-30', 'active'),
('priya-member-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'plan-id-from-above', '2026-01-01', '2026-12-31', 'active'),
('amit-member-id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'plan-id-from-above', '2026-01-01', '2026-03-31', 'active');

-- STEP 5: Now register these users on the MACHINE
-- On eSSL F22: Menu → User Mgt → New User
-- User ID: 1, Enroll fingerprint for Rahul
-- User ID: 2, Enroll fingerprint for Priya
-- User ID: 3, Enroll fingerprint for Amit
```

### Simulating Check-ins

```bash
# Rahul checks in at 9:00 AM
curl -X POST "http://localhost:8080/iclock/cdata?SN=FZ2024001" \
  -H "Content-Type: text/plain" \
  -d "1	2026-01-10 09:00:00	0	1"

# Priya checks in at 9:15 AM
curl -X POST "http://localhost:8080/iclock/cdata?SN=FZ2024001" \
  -H "Content-Type: text/plain" \
  -d "2	2026-01-10 09:15:00	0	1"

# Rahul checks out at 6:00 PM
curl -X POST "http://localhost:8080/iclock/cdata?SN=FZ2024001" \
  -H "Content-Type: text/plain" \
  -d "1	2026-01-10 18:00:00	1	1"
```

### Viewing Attendance

```sql
-- Today's attendance for FitZone
SELECT 
  a.timestamp,
  a.status,
  a.membership_status,
  m.name as member_name,
  m.phone
FROM attendance_logs a
LEFT JOIN members m ON m.id = a.member_id
WHERE a.gym_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND a.timestamp::date = CURRENT_DATE
ORDER BY a.timestamp DESC;
```

---

## 🔧 Troubleshooting

### Device Not Connecting

1. **Check network:** Ping server from device network
2. **Check firewall:**
   ```powershell
   # Windows - allow port 8080
   netsh advfirewall firewall add rule name="Biometric Server" dir=in action=allow protocol=TCP localport=8080
   ```
3. **Check server logs:** Watch for incoming requests
4. **Verify ADMS settings** on machine

### "Device Not Registered" Errors

```sql
-- Check if device is in database
SELECT * FROM devices WHERE device_sn = 'YOUR_DEVICE_SN';

-- If not found, add it:
INSERT INTO devices (gym_id, device_sn, location)
VALUES ('your-gym-uuid', 'YOUR_DEVICE_SN', 'Location Name');
```

### Member Not Linking

Ensure `fingerprint_id` in database matches `User ID` on machine exactly.

```sql
-- Check member and membership
SELECT m.*, ms.end_date, ms.status
FROM members m
LEFT JOIN memberships ms ON ms.member_id = m.id
WHERE m.fingerprint_id = '5';

-- Check if gym_id matches device's gym
SELECT d.gym_id as device_gym, m.gym_id as member_gym
FROM devices d, members m
WHERE d.device_sn = 'YOUR_SN' AND m.fingerprint_id = '5';
```

---

## 📄 License

ISC
