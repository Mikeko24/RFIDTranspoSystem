# RFID Transit Ledger

A local prototype for an RFID-based public transport balance system. It runs in the browser, stores data in `localStorage`, and includes public passenger registration, admin login, bus company login, vehicle fare setup, balance top-up, fare deduction, passenger CRUD, and transaction history.

## Run

Open `index.html` in a browser, or serve the folder locally:

```powershell
node server.js
```

Then open `http://127.0.0.1:3000`.

## Login

- Admin username: `admin`
- Admin password: `admin123`
- Bus company email: `company@example.com`
- Bus company password: `company123`

Passengers can register from the landing page. They sign in with their email address and password, and their starting balance is always `PHP 0.00`. After signing in, passengers can top up their own balance from the passenger dashboard.

Admin can create bus company accounts from the `Bus Companies` page and manage reusable passenger destinations from the `Destinations` page. Bus companies sign in with the assigned email and password, then add fare profiles for vehicles. A single bus can have multiple location-based profiles, such as `Southbus to Toledo`, or use kilometer pricing by setting distance and price per kilometer. Bus companies can click a bus/fare row to open a modal, search/pick destinations from the admin-managed list, add multiple fixed-fare destinations for the same bus, and save them together without changing existing routes. Passenger scans deduct the selected route/location fare.

This is prototype-only authentication. Data is saved on the current browser and PC only.
