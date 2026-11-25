DOS ELECTRONICS COURIER TRACKING - SETUP GUIDE

CONTENTS
- index.html, style.css, app.js: application
- config.js: Supabase URL and publishable key
- supabase_setup.sql: independent courier database tables and RLS
- manifest.json, sw.js, icon.svg: installable PWA files

STEP 1 - CREATE DATABASE
1. Open https://supabase.com/dashboard and select project vxukuuyglinpsrnlfvor.
2. Open SQL Editor > New query.
3. Open supabase_setup.sql, copy all SQL and run it.
This creates only courier_* objects. It does not modify your existing app tables.

STEP 2 - CREATE FIRST ADMIN
1. Supabase > Authentication > Users > Add user.
2. Enter your admin email and a strong password; confirm the user if prompted.
3. Copy that user's UUID.
4. In SQL Editor run:
   update public.courier_profiles set role='admin' where id='YOUR-UUID';
5. Sign in to the app with that email/password.

STEP 3 - CREATE EMPLOYEES AND COURIER BOYS
1. Create each person in Authentication > Users.
2. A courier_profiles row is automatically created with role employee.
3. In SQL Editor set their role:
   update public.courier_profiles set role='courier', full_name='Courier Name', phone='Phone'
   where id='AUTH-USER-UUID';
   For employees, use role='employee'.
4. Admin can view team profiles in Team & Couriers.

STEP 4 - HOST THE APP (HTTPS REQUIRED FOR INSTALL)
Upload all files preserving their names to an HTTPS static host such as your existing Hostinger hosting, a subfolder or a separate subdomain.
Example: https://yourdomain.com/courier/
Do not open index.html directly as file://. Service workers and PWA installation require HTTPS (localhost is okay for testing).

STEP 5 - INSTALL ON ANDROID
1. Open the hosted HTTPS URL in Chrome on Android.
2. Open Chrome menu (three dots).
3. Choose Install app or Add to Home screen.
4. Launch Dos Electronics Courier from the home screen and sign in.

CURRENT VERSION NOTES
- Admin can see bookings, assign courier profiles, and view team.
- Employees can create bookings and see bookings they created.
- Courier role sees bookings assigned to them and can update status.
- Carrier AWB link is opened manually; automatic third-party carrier status sync is not included.
- Photo upload, OTP verification, push notifications, live GPS tracking, and offline data sync are not implemented in this starter version. They need additional secure storage, notification and location configuration.
- PWA offline cache stores the app shell only; database actions require internet.
- Keep the publishable key in config.js only. Never expose Supabase secret/service_role keys.
- Configure Supabase Auth > URL Configuration with your hosted app URL and allowed redirect URLs.
