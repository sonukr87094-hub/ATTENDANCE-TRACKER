# College Attendance Tracker

Build a simple, offline-first College Attendance Tracker as an installable PWA.

## CORE IDEA

This is NOT a timetable-based attendance system.

The user will manually enter what classes they actually had each day.

Example:

DSD → 2 conducted, 2 attended
Network → 1 conducted, 1 attended
VLSI → 1 conducted, 0 attended

The app must automatically update subject-wise and overall attendance.

## ATTENDANCE FORMULA

Subject %:

(attended / conducted) × 100

Overall %:

(total attended across all subjects / total conducted across all subjects) × 100

Never calculate overall attendance by averaging subject percentages.

## OFFICIAL BASELINE

The user can enter official college attendance as the starting baseline.

Example:

DSD → 21/22
Network → 18/20
VLSI → 15/18

The app must use these values as the official baseline.

The user can later perform a weekly Official Sync with updated college attendance.

## DAILY ATTENDANCE

Every day the user can enter:

- Subject
- Classes conducted
- Classes attended
- Date

Allow multiple subjects on the same day.

Example:

Today:
DSD → 3/3
VLSI → 0/1
Network → 2/2

Add these values to the existing attendance.

Never automatically mark a class absent because the user did not enter anything.

## DASHBOARD

Show:

- Overall attendance %
- Total attended
- Total conducted
- Total missed
- Subject-wise attendance
- Progress toward 75%

Default target = 75%.

Allow the target to be changed in Settings.

## HISTORY

Store and display daily attendance records.

Support:

- Daily history
- Weekly history
- Monthly history

Never delete or overwrite old records accidentally.

## ANALYTICS

Include:

- Overall attendance graph
- Weekly attendance graph
- Classes attended per day
- Subject-wise attendance
- Attended vs missed classes

## PREDICTION

For each subject calculate:

- Current attendance %
- Result if the user attends the next X classes
- Result if the user misses the next X classes
- Classes required to reach 75%
- Classes that can be missed while staying at/above 75%

Calculations must be mathematically correct.

## WEEKLY OFFICIAL SYNC

The college provides updated official attendance.

Example:

DSD → 25/27
Network → 21/23
VLSI → 16/20

The user can enter these values using "Official Sync".

These values become the new trusted baseline.

Future daily attendance is added from this baseline.

IMPORTANT:
Do not double-count old daily records after a sync.

Keep sync history if possible.

## EXCEL IMPORT

Later support importing the official Excel attendance file.

The Excel data is the source of truth for official attendance.

Do not invent or assume missing values.

Show detected subjects and attendance before importing when necessary.

## STORAGE

This is an offline-first application.

Use LocalStorage initially.

Do NOT use:

- Backend
- Firebase
- Supabase
- Cloud database
- Login
- External APIs

Store:

- Settings
- Subjects
- Official baseline
- Daily attendance
- Sync history

## PWA

Include:

- manifest.json
- service-worker.js

The application must be installable and work offline.

Notifications are optional and must not be required for the core tracker.

## UI

Make the UI:

- Clean
- Modern
- Mobile-friendly
- Simple
- Fast

Navigation:

Dashboard
Add Attendance
History
Analytics
Prediction
Official Sync
Settings

## PROJECT STRUCTURE

Start simple:

ATTENDANCE/
├── index.html
├── style.css
├── app.js
├── manifest.json
├── service-worker.js
└── README.md

Do not create unnecessary files or complicated architecture.

## IMPORTANT RULES

1. Do NOT create a timetable system.
2. Do NOT assume classes happened.
3. Only record attendance explicitly entered by the user.
4. Do NOT double-count attendance.
5. Do NOT overwrite historical records accidentally.
6. Overall attendance = total attended / total conducted.
7. Official college data is the trusted baseline during sync.
8. Daily entries represent new attendance after the baseline.
9. Do NOT invent attendance data.
10. Keep the code beginner-friendly and easy to maintain.

## DEVELOPMENT

Build the project in phases:

1. UI + LocalStorage
2. Official baseline
3. Daily attendance
4. Automatic calculations
5. History
6. Graphs + analytics
7. Prediction
8. Official weekly sync
9. Excel import
10. PWA/offline support
11. Optional notifications

START WITH PHASE 1 ONLY.

After each phase:
- Explain what changed.
- Give the complete code.
- Tell me which files changed.
- Tell me how to test it.
- Do not implement future phases until the current phase works.