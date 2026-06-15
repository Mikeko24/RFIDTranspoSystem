const STORAGE_KEY = "rfid-transit-ledger-v2";
const LEGACY_KEY = "rfid-transit-ledger-v1";

const idTypes = [
  "Philippine National ID",
  "Driver's License",
  "Passport",
  "SSS ID",
  "GSIS ID",
  "UMID",
  "PhilHealth ID",
  "Voter's ID",
  "TIN ID",
  "Postal ID",
];

const defaultPassengers = [
  {
    id: 1001,
    rfid: "12 34 56 78 90 AB CD EF",
    govIdType: "Philippine National ID",
    govIdNumber: "PH-2026-1001",
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    birthday: "1998-03-14",
    age: 28,
    contact: "0917 123 4567",
    address: "Quezon City, Metro Manila",
    balance: 120.5,
    status: "Active",
    notes: "Regular commuter",
  },
  {
    id: 1002,
    rfid: "22 33 44 55 66 77 88 99",
    govIdType: "Driver's License",
    govIdNumber: "N01-24-123456",
    name: "Maria Santos",
    email: "maria@example.com",
    birthday: "1995-10-02",
    age: 30,
    contact: "0928 765 4321",
    address: "Pasig City, Metro Manila",
    balance: 85,
    status: "Active",
    notes: "Student discount pending validation",
  },
  {
    id: 1003,
    rfid: "AB CD EF 12 34 56 78 90",
    govIdType: "UMID",
    govIdNumber: "CRN-0112-2233445-6",
    name: "Pedro Reyes",
    email: "pedro@example.com",
    birthday: "1987-06-22",
    age: 39,
    contact: "0916 555 8899",
    address: "Makati City, Metro Manila",
    balance: 0,
    status: "Inactive",
    notes: "Card replacement requested",
  },
  {
    id: 1004,
    rfid: "DE AD BE EF 00 11 22 33",
    govIdType: "Passport",
    govIdNumber: "P1234567B",
    name: "Anna Lim",
    email: "anna@example.com",
    birthday: "2000-01-19",
    age: 26,
    contact: "0933 222 1122",
    address: "Cebu City, Cebu",
    balance: 250.75,
    status: "Active",
    notes: "Frequent intercity rider",
  },
];

const defaultCompanies = [
  {
    id: 5001,
    name: "Metro Sample Bus Co.",
    email: "company@example.com",
    password: "company123",
    contact: "0918 000 3000",
    address: "EDSA, Metro Manila",
    status: "Active",
    vehicles: [
      {
        id: 9001,
        name: "Bus 101",
        plate: "NCR 1001",
        routeFrom: "Main Terminal",
        routeTo: "City Center",
        pricingMode: "Fixed fare",
        distanceKm: 0,
        pricePerKm: 0,
        fare: 15,
        status: "Active",
      },
    ],
  },
];

const defaultDestinations = [
  { id: 7001, name: "Naga City", area: "Cebu", status: "Active" },
  { id: 7002, name: "Uling", area: "Cebu", status: "Active" },
  { id: 7003, name: "Lutopan", area: "Cebu", status: "Active" },
  { id: 7004, name: "Toledo", area: "Cebu", status: "Active" },
];

let state = loadState();
let currentView = "dashboard";
let editingId = null;
let editingCompanyId = null;
let editingDestinationId = null;
let selectedPassengerId = state.passengers[0]?.id ?? null;
let selectedCompanyVehicleId = null;
let companyView = "fares";
let modal = null;
let message = "";
let toast = null;
let toastTimer = null;
let landingTab = "register";
let routeStopDrafts = [];

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    }
  }

  return normalizeState({
    isLoggedIn: false,
    role: null,
    sessionPassengerId: null,
    sessionCompanyId: null,
    nextId: 1005,
    nextCompanyId: 5002,
    nextVehicleId: 9002,
    nextDestinationId: 7005,
    passengers: defaultPassengers,
    accounts: [],
    companies: defaultCompanies,
    destinations: defaultDestinations,
    transactions: [
      transactionSeed(1001, "Ride fare", -15, 105.5),
      transactionSeed(1004, "Top up", 100, 250.75),
      transactionSeed(1002, "Ride fare", -15, 85),
    ],
  });
}

function normalizeState(raw) {
  const passengers = Array.isArray(raw.passengers) ? raw.passengers.map((passenger) => ({ email: "", ...passenger })) : defaultPassengers;
  const destinations = Array.isArray(raw.destinations) ? raw.destinations.map((destination) => ({ area: "", status: "Active", ...destination })) : defaultDestinations;
  const companies = Array.isArray(raw.companies)
    ? raw.companies.map((company) => ({
        contact: "",
        address: "",
        status: "Active",
        vehicles: [],
        ...company,
        email: company.email || "",
        password: company.password || "",
        vehicles: normalizeCompanyVehicles(company.vehicles),
      }))
    : defaultCompanies;
  const accounts = Array.isArray(raw.accounts)
    ? raw.accounts.map((account) => ({
        ...account,
        email: account.email || passengers.find((passenger) => passenger.id === account.passengerId)?.email || "",
      }))
    : [];

  return {
    isLoggedIn: Boolean(raw.isLoggedIn),
    role: raw.role || (raw.isLoggedIn ? "admin" : null),
    sessionPassengerId: raw.sessionPassengerId || null,
    sessionCompanyId: raw.sessionCompanyId || null,
    nextId: raw.nextId || 1005,
    nextCompanyId: raw.nextCompanyId || Math.max(5002, ...companies.map((company) => company.id + 1)),
    nextVehicleId: raw.nextVehicleId || Math.max(9002, ...companies.flatMap((company) => companyFareProfiles(company).map((vehicle) => vehicle.id + 1))),
    nextDestinationId: raw.nextDestinationId || Math.max(7005, ...destinations.map((destination) => destination.id + 1)),
    passengers,
    accounts,
    companies,
    destinations,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
  };
}

function normalizeCompanyVehicles(vehicles) {
  const normalized = Array.isArray(vehicles)
    ? vehicles.map((vehicle) => ({
        routeFrom: "",
        routeTo: "",
        routeFares: [],
        pricingMode: "Fixed fare",
        distanceKm: 0,
        pricePerKm: 0,
        status: "Active",
        fare: 15,
        ...vehicle,
        routeFares: Array.isArray(vehicle.routeFares)
          ? vehicle.routeFares.map((routeFare) => ({
              id: routeFare.id,
              routeFrom: routeFare.routeFrom || vehicle.routeFrom || "",
              routeTo: routeFare.routeTo || "",
              destinationId: routeFare.destinationId || null,
              pricingMode: "Fixed fare",
              distanceKm: 0,
              pricePerKm: 0,
              fare: 15,
              status: "Active",
              ...routeFare,
            }))
          : [],
      }))
    : [];

  const baseVehicles = normalized.filter((vehicle) => !vehicle.baseRouteTo);
  const legacyRouteFares = normalized.filter((vehicle) => vehicle.baseRouteTo);
  const migratedLegacyIds = new Set();

  const migratedBaseVehicles = baseVehicles.map((vehicle) => {
    const matchingLegacyRoutes = legacyRouteFares
      .filter((routeFare) => routeFare.name === vehicle.name && routeFare.plate === vehicle.plate && routeFare.baseRouteTo === vehicle.routeTo)
      .map((routeFare) => ({
        id: routeFare.id,
        routeFrom: routeFare.routeFrom || vehicle.routeFrom,
        routeTo: routeFare.routeTo,
        destinationId: routeFare.destinationId || null,
        pricingMode: routeFare.pricingMode || "Fixed fare",
        distanceKm: Number(routeFare.distanceKm || 0),
        pricePerKm: Number(routeFare.pricePerKm || 0),
        fare: Number(routeFare.fare || 0),
        status: routeFare.status || "Active",
      }));
    matchingLegacyRoutes.forEach((routeFare) => migratedLegacyIds.add(routeFare.id));

    return { ...vehicle, routeFares: [...(vehicle.routeFares || []), ...matchingLegacyRoutes] };
  });

  return [...migratedBaseVehicles, ...legacyRouteFares.filter((vehicle) => !migratedLegacyIds.has(vehicle.id))];
}

function transactionSeed(passengerId, type, amount, balanceAfter, details = {}) {
  return {
    id: crypto.randomUUID(),
    passengerId,
    type,
    amount,
    balanceAfter,
    ...details,
    createdAt: new Date().toISOString(),
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function peso(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function icon(name) {
  const icons = {
    radio:
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.4 8.6a5.8 5.8 0 0 0 0 6.8M3.3 5.5a10.2 10.2 0 0 0 0 13M17.6 8.6a5.8 5.8 0 0 1 0 6.8M20.7 5.5a10.2 10.2 0 0 1 0 13M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    users:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 19c0-2.2-1.8-4-4-4H7c-2.2 0-4 1.8-4 4M14 5.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM21 19c0-2-1.4-3.6-3.2-3.9M17 2a3.8 3.8 0 0 1 0 7.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    card:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    bus:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="3" width="14" height="15" rx="3" stroke="currentColor" stroke-width="2"/><path d="M8 7h8M8 12h8M8 21v-3M16 21v-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    list:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    edit:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m14 6.5 3.5 3.5" stroke="currentColor" stroke-width="2"/></svg>',
    trash:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M8 10v9M16 10v9M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    plus:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    logout:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 6V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-1M4 12h11M12 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    menu:
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chevron:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    eye:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>',
  };
  return icons[name] || "";
}

function render() {
  const app = document.querySelector("#app");
  let content = "";
  if (state.isLoggedIn && state.role === "passenger") content = renderPassengerPortal();
  else if (state.isLoggedIn && state.role === "company") content = renderCompanyPortal();
  else content = state.isLoggedIn ? renderShell() : renderLanding();
  app.innerHTML = `${content}${renderToast()}`;
  bindEvents();
}

function renderToast() {
  if (!toast) return "";
  return `<div class="toast ${toast.type}" role="status">${escapeHtml(toast.message)}</div>`;
}

function showToast(messageText, type = "danger") {
  toast = { message: messageText, type };
  if (toastTimer) window.clearTimeout(toastTimer);
  render();
  toastTimer = window.setTimeout(() => {
    toast = null;
    render();
  }, 3200);
}

function renderLanding() {
  return `
    <main class="landing-screen">
      <section class="landing-hero">
        <div class="brand-row">
          <div class="brand-mark">${icon("radio")}</div>
          <strong>RFID Transit Ledger</strong>
        </div>
        <div class="hero-copy">
          <h1>Transit cards, fare scans, and balances in one local prototype.</h1>
          <p>Create a passenger card with zero starting balance. Bus companies can set vehicle fares and scan rides, while admin manages operators and passenger records.</p>
        </div>
        <div class="fare-strip">
          <span>Sample fare</span>
          <strong>PHP 15.00</strong>
          <small>Deducted when scanned</small>
        </div>
      </section>
      <section class="landing-panel">
        <div class="landing-tabs" role="tablist" aria-label="Landing actions">
          <button class="${landingTab === "register" ? "active" : ""}" data-action="landingTab" data-tab="register">Register</button>
          <button class="${landingTab === "login" ? "active" : ""}" data-action="landingTab" data-tab="login">Login</button>
        </div>
        ${landingTab === "register" ? renderPublicRegister() : renderLogin()}
      </section>
    </main>
  `;
}

function renderLogin() {
  return `
    <form id="loginForm" class="landing-form">
      <div>
        <h2>Sign in</h2>
        <p>Admin manages records, bus companies manage vehicle fares, and passengers view or top up their balance.</p>
      </div>
      <div class="field">
        <label for="username">Email</label>
        <input id="username" autocomplete="username" placeholder="name@example.com" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <div class="password-control">
          <input id="password" type="password" autocomplete="current-password" placeholder="Enter password" />
          <button class="password-toggle" type="button" data-action="togglePassword" aria-label="Show password" aria-pressed="false">${icon("eye")}</button>
        </div>
      </div>
      <button class="btn primary" type="submit">Login</button>
      <div class="hint">Admin demo: admin / admin123. Company demo: company@example.com / company123.</div>
      <div class="error" id="loginError"></div>
    </form>
  `;
}

function renderPublicRegister() {
  return `
    <form id="publicRegisterForm" class="landing-form">
      <div>
        <h2>Register passenger card</h2>
        <p>Starting balance is PHP 0.00. You can top up after signing in.</p>
      </div>
      <div class="form-grid compact">
        ${input("publicName", "Full Name", "", "Enter full name")}
        ${input("publicEmail", "Email Address", "", "name@example.com", "email")}
        ${input("publicPassword", "Create Password", "", "Enter password", "password")}
        ${select("publicGovIdType", "Registered Government ID", idTypes, idTypes[0])}
        ${input("publicGovIdNumber", "Government ID Number", "", "Enter ID number")}
        ${input("publicBirthday", "Birthday", "", "", "date")}
        ${input("publicAge", "Age", "", "Auto or manual", "number")}
        ${input("publicContact", "Registered Number", "", "09XXXXXXXXX")}
        <div class="field wide"><label for="publicAddress">Address</label><textarea id="publicAddress" name="publicAddress" placeholder="Enter address"></textarea></div>
        <div class="field wide"><label for="publicNotes">Other Information</label><textarea id="publicNotes" name="publicNotes" placeholder="Discount status, emergency contact, or commuter details"></textarea></div>
      </div>
      <button class="btn primary" type="submit">Create Passenger Account</button>
      <div class="hint">You will sign in with your email address and password.</div>
      <div class="success-text" id="publicRegisterMessage"></div>
    </form>
  `;
}

function renderShell() {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-row"><div class="brand-mark">${icon("radio")}</div><span>RFID Transit Ledger</span></div>
        <div class="admin-mini"><div class="avatar">A</div><div><strong>Admin Console</strong><span class="online">Online</span></div></div>
        <nav class="nav-list">${navButtons()}</nav>
        <button class="nav-button logout" data-action="logout">${icon("logout")} Logout</button>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="mobile-brand"><button class="btn icon mobile-menu" data-action="view" data-view="dashboard">${icon("menu")}</button><strong>RFID Transit Ledger</strong></div>
          <div class="desktop-meta">${new Date().toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} &middot; Local prototype</div>
        </header>
        <section class="page">${renderView()}</section>
        <nav class="bottom-tabs">${mobileTabs()}</nav>
      </main>
    </div>
    ${modal ? renderModal() : ""}
  `;
}

function renderCompanyPortal() {
  const company = state.companies.find((item) => item.id === state.sessionCompanyId);
  const vehicles = company?.vehicles || [];
  const fareProfiles = companyFareProfiles(company);
  const selectedVehicle = fareProfiles.find((vehicle) => vehicle.id === selectedCompanyVehicleId) || fareProfiles[0];
  if (selectedVehicle && selectedCompanyVehicleId !== selectedVehicle.id) selectedCompanyVehicleId = selectedVehicle.id;
  const selectedPassenger = state.passengers.find((p) => p.id === selectedPassengerId) || state.passengers[0];
  const companyTransactions = state.transactions
    .filter((tx) => tx.companyId === company?.id)
    .slice()
    .reverse()
    .map(renderTransaction)
    .join("");
  const stats = renderCompanyStats(company, fareProfiles, selectedVehicle);
  let pageContent = "";

  if (companyView === "scan") {
    pageContent = `
      ${stats}
      ${renderCompanyScan(company, selectedVehicle, selectedPassenger)}
    `;
  } else if (companyView === "transactions") {
    pageContent = `
      ${stats}
      <section class="panel">
        <div class="panel-header"><h2>Company Transactions</h2></div>
        <div class="transactions-list">${companyTransactions || `<div class="empty-state">No company ride transactions yet.</div>`}</div>
      </section>
    `;
  } else {
    pageContent = `
      ${stats}
      ${renderCompanyVehicles(company)}
    `;
  }

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-row"><div class="brand-mark">${icon("bus")}</div><span>${escapeHtml(company?.name || "Bus Company")}</span></div>
        <div class="admin-mini"><div class="avatar">B</div><div><strong>Bus Company</strong><br><span class="online">Online</span></div></div>
        <div class="company-mini">
          <span>Account email</span>
          <strong>${escapeHtml(company?.email || "")}</strong>
        </div>
        <nav class="nav-list">${companyNavButtons()}</nav>
        <button class="nav-button logout" data-action="logout">${icon("logout")} Logout</button>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="mobile-brand"><strong>${escapeHtml(company?.name || "Bus Company")}</strong></div>
          <div class="desktop-meta">${companyView === "scan" ? "Scan ride console" : companyView === "transactions" ? "Company transactions" : "Company fare console"}</div>
        </header>
        <section class="page">${pageContent}</section>
        <nav class="bottom-tabs company-tabs">${companyMobileTabs()}</nav>
      </main>
    </div>
    ${modal ? renderModal() : ""}
  `;
}

function renderCompanyStats(company, fareProfiles, selectedVehicle) {
  return `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">Fare Profiles</span><strong>${fareProfiles.length}</strong><small>Routes and vehicles</small></div>
      <div class="stat"><span class="stat-label">Company Rides</span><strong>${state.transactions.filter((tx) => tx.companyId === company?.id && tx.amount < 0).length}</strong><small>Scans recorded</small></div>
      <div class="stat"><span class="stat-label">Selected Fare</span><strong>${selectedVehicle ? peso(selectedVehicle.fare) : "0.00"}</strong><small>${escapeHtml(routeLabel(selectedVehicle) || "No route")}</small></div>
      <div class="stat"><span class="stat-label">Passengers</span><strong>${state.passengers.length}</strong><small>Available cards</small></div>
    </div>
  `;
}

function companyNavButtons() {
  const items = [
    ["fares", "Fare Profiles", "bus"],
    ["scan", "Scan Ride", "radio"],
    ["transactions", "Transactions", "list"],
  ];
  return items
    .map(([view, label, iconName]) => `<button class="nav-button ${companyView === view ? "active" : ""}" data-action="companyView" data-view="${view}">${icon(iconName)} ${label}</button>`)
    .join("");
}

function companyMobileTabs() {
  const items = [
    ["fares", "Fares", "bus"],
    ["scan", "Scan", "radio"],
    ["transactions", "Trips", "list"],
  ];
  return items
    .map(([view, label, iconName]) => `<button class="${companyView === view ? "active" : ""}" data-action="companyView" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`)
    .join("");
}

function renderCompanyVehicles(company) {
  const rows = (company?.vehicles || [])
    .map((vehicle) => `
      <tr class="clickable-row" data-action="openRouteModal" data-id="${vehicle.id}" title="View and add route fares for this bus">
        <td><strong>${escapeHtml(vehicle.name)}</strong><br><small>${escapeHtml(vehicle.plate)}</small></td>
        <td>${escapeHtml(routeLabel(vehicle) || "No route stated")}</td>
        <td>${escapeHtml(pricingLabel(vehicle))}</td>
        <td>${escapeHtml(vehicle.plate)}</td>
        <td style="font-weight:900">PHP ${peso(vehicle.fare)}</td>
        <td><span class="status ${vehicle.status.toLowerCase()}">${escapeHtml(vehicle.status)}</span></td>
        <td><div class="row-actions">
          <button class="btn icon" title="View routes" data-action="openRouteModal" data-id="${vehicle.id}">${icon("plus")}</button>
          <button class="btn icon danger" title="Delete vehicle" data-action="deleteVehicle" data-id="${vehicle.id}">${icon("trash")}</button>
        </div></td>
      </tr>
    `)
    .join("");

  return `
    <section class="panel">
      <div class="panel-header"><h2>Vehicles, Locations, and Fares</h2></div>
      <form id="vehicleForm">
        <div class="form-grid">
          ${input("vehicleName", "Vehicle Name", "", "Bus 101")}
          ${input("vehiclePlate", "Plate / Unit Number", "", "ABC 1234")}
          ${input("routeFrom", "From Location", "", "Naga City - Cebu")}
          ${input("routeTo", "To Location", "", "Toledo - Cebu")}
          ${select("pricingMode", "Pricing Type", ["Fixed fare", "Per kilometer"], "Fixed fare", `data-action="pricingMode"`)}
          <div class="field pricing-field fixed-fare-field">
            <label for="vehicleFare">Fixed Fare (PHP)</label>
            <input id="vehicleFare" name="vehicleFare" type="number" step="0.01" value="15.00" placeholder="0.00" />
          </div>
          <div class="field pricing-field per-km-field is-hidden">
            <label for="distanceKm">Distance (KM)</label>
            <input id="distanceKm" name="distanceKm" type="number" step="0.01" placeholder="0" disabled />
          </div>
          <div class="field pricing-field per-km-field is-hidden">
            <label for="pricePerKm">Price per KM (PHP)</label>
            <input id="pricePerKm" name="pricePerKm" type="number" step="0.01" placeholder="0.00" disabled />
          </div>
          ${select("vehicleStatus", "Status", ["Active", "Inactive"], "Active")}
        </div>
        <div class="actions"><button class="btn primary" type="submit">${icon("plus")} Add Fare Profile</button></div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Vehicle</th><th>Location / Route</th><th>Pricing</th><th>Plate</th><th>Fare</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7"><div class="empty-state">No fare profiles yet. Add one bus route or kilometer profile to start scanning rides.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompanyScan(company, selectedVehicle, selectedPassenger) {
  return `
    <section class="panel">
      <div class="panel-header"><h2>Scan Ride</h2></div>
      <div class="scan-panel">
        <div class="rfid-symbol scan-logo">${icon("radio")}</div>
        <div class="field"><label for="companyVehicle">Vehicle / Location Fare</label><select id="companyVehicle" data-action="selectVehicle">${vehicleOptions(company, selectedVehicle?.id)}</select></div>
        <div class="field"><label for="companyPassenger">Tap card or choose passenger</label><select id="companyPassenger" data-action="selectPassenger">${passengerOptions(selectedPassenger?.id)}</select></div>
        <div class="scan-identity">
          <strong>${escapeHtml(selectedPassenger?.rfid || "No card selected")}</strong>
          <span>${escapeHtml(selectedPassenger?.name || "Register a passenger first")}</span>
        </div>
        <div class="route-summary">
          <div><small>Route</small><strong>${escapeHtml(selectedVehicle ? routeLabel(selectedVehicle) || "No route stated" : "No fare profile selected")}</strong></div>
          <div><small>Pricing</small><strong>${escapeHtml(selectedVehicle ? pricingLabel(selectedVehicle) : "No fare")}</strong></div>
        </div>
        <div class="balance-box fare-box"><span>Fare Amount (PHP)</span><strong>${peso(selectedVehicle?.fare || 0)}</strong></div>
        <button class="btn primary" data-action="companyDeductFare" ${selectedVehicle ? "" : "disabled"}>Deduct Location Fare</button>
        ${message ? `<div class="alert ${message.includes("Insufficient") || message.includes("inactive") || message.includes("vehicle") ? "danger" : "success"}">${escapeHtml(message)}</div>` : ""}
      </div>
    </section>
  `;
}

function renderPassengerPortal() {
  const passenger = state.passengers.find((p) => p.id === state.sessionPassengerId);
  const history = state.transactions
    .filter((tx) => tx.passengerId === passenger?.id)
    .slice()
    .reverse()
    .map((tx) => renderTransaction(tx))
    .join("");

  return `
    <main class="passenger-screen">
      <section class="passenger-card">
        <div class="brand-row"><div class="brand-mark">${icon("radio")}</div><strong>RFID Transit Ledger</strong></div>
        <div class="passenger-summary">
          <div class="passenger-id-card">
            <span>Card ID</span>
            <strong>${escapeHtml(passenger?.rfid || "No card")}</strong>
          </div>
          <div class="passenger-title">
            <span>Passenger</span>
            <h1>${escapeHtml(passenger?.name || "Passenger")}</h1>
          </div>
          <div class="balance-box"><span>Available Balance (PHP)</span><strong>${peso(passenger?.balance || 0)}</strong></div>
        </div>
        <form id="passengerTopUpForm" class="passenger-topup">
          <div class="field">
            <label for="passengerTopUpAmount">Top Up Amount</label>
            <input id="passengerTopUpAmount" type="number" min="1" step="0.01" value="100.00" />
          </div>
          <button class="btn primary" type="submit">Top Up Balance</button>
          ${message ? `<div class="alert success">${escapeHtml(message)}</div>` : ""}
        </form>
      </section>
      <section class="panel passenger-history">
        <div class="panel-header"><h2>My Transactions</h2></div>
        <div class="transactions-list">${history || `<div class="empty-state">No transactions yet.</div>`}</div>
      </section>
      <nav class="passenger-bottom-nav">
        <button data-action="logout">${icon("logout")}<span>Logout</span></button>
      </nav>
    </main>
  `;
}

function navButtons() {
  const items = [
    ["dashboard", "Dashboard", "users"],
    ["companies", "Bus Companies", "bus"],
    ["destinations", "Destinations", "list"],
    ["register", "Register Card", "card"],
    ["topup", "Top Up", "plus"],
    ["scan", "Scan Ride", "radio"],
    ["passengers", "Passengers", "list"],
    ["transactions", "Transactions", "bus"],
  ];
  return items
    .map(([view, label, iconName]) => `<button class="nav-button ${currentView === view ? "active" : ""}" data-action="view" data-view="${view}">${icon(iconName)} ${label}</button>`)
    .join("");
}

function mobileTabs() {
  const items = [
    ["companies", "Companies", "bus"],
    ["destinations", "Stops", "list"],
    ["scan", "Scan", "radio"],
    ["topup", "Top Up", "plus"],
  ];
  return items
    .map(([view, label, iconName]) => `<button class="${currentView === view ? "active" : ""}" data-action="view" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`)
    .join("");
}

function renderView() {
  if (currentView === "companies") return renderCompanies();
  if (currentView === "destinations") return renderDestinations();
  if (currentView === "register") return renderRegister();
  if (currentView === "topup") return renderTopUp();
  if (currentView === "scan") return renderScan();
  if (currentView === "passengers") return renderPassengers();
  if (currentView === "transactions") return renderTransactions();

  return renderDashboard();
}

function renderDashboard() {
  const recentTransactions = state.transactions
    .slice()
    .reverse()
    .slice(0, 5)
    .map(renderTransaction)
    .join("");
  const lowBalanceRows = state.passengers
    .filter((passenger) => Number(passenger.balance) <= 20 || passenger.status !== "Active")
    .slice(0, 5)
    .map(
      (passenger) => `
        <div class="watch-row">
          <div>
            <strong>${escapeHtml(passenger.name)}</strong>
            <small>${escapeHtml(passenger.rfid)} &middot; ${escapeHtml(passenger.status)}</small>
          </div>
          <span class="${Number(passenger.balance) <= 20 ? "amount-debit" : ""}">PHP ${peso(passenger.balance)}</span>
        </div>
      `,
    )
    .join("");
  const activeCompanies = state.companies.filter((company) => company.status === "Active").length;
  const activePassengers = state.passengers.filter((passenger) => passenger.status === "Active").length;
  const routes = state.companies.reduce((sum, company) => sum + companyFareProfiles(company).length, 0);

  return `
    ${renderStats()}
    <section class="panel dashboard-intro">
      <div>
        <h2>Admin Console</h2>
        <p>Monitor card activity, operator setup, passenger balances, and route readiness from one overview.</p>
      </div>
      <button class="btn primary" data-action="view" data-view="register">${icon("plus")} Register Card</button>
    </section>
    <section class="dashboard-grid">
      <div class="panel compact-panel">
        <div class="panel-header"><h2>Quick Actions</h2></div>
        <div class="quick-actions">
          <button class="btn primary" data-action="view" data-view="register">${icon("plus")} Register Card</button>
          <button class="btn" data-action="view" data-view="passengers">${icon("list")} Manage Passengers</button>
          <button class="btn" data-action="view" data-view="topup">${icon("plus")} Top Up Balance</button>
          <button class="btn" data-action="view" data-view="scan">${icon("radio")} Scan Ride</button>
        </div>
      </div>
      <div class="panel compact-panel">
        <div class="panel-header"><h2>System Readiness</h2></div>
        <div class="readiness-list">
          <div><span>Active passengers</span><strong>${activePassengers}/${state.passengers.length}</strong></div>
          <div><span>Active companies</span><strong>${activeCompanies}/${state.companies.length}</strong></div>
          <div><span>Fare profiles</span><strong>${routes}</strong></div>
        </div>
      </div>
      <div class="panel compact-panel">
        <div class="panel-header"><h2>Needs Attention</h2></div>
        <div class="watch-list">${lowBalanceRows || `<div class="empty-state compact-empty">No low-balance or inactive passengers.</div>`}</div>
      </div>
      <div class="panel compact-panel">
        <div class="panel-header"><h2>Recent Activity</h2></div>
        <div class="transactions-list compact-transactions">${recentTransactions || `<div class="empty-state compact-empty">No transactions yet.</div>`}</div>
      </div>
    </section>
  `;
}

function renderStats() {
  const totalBalance = state.passengers.reduce((sum, p) => sum + Number(p.balance), 0);
  const companyCount = state.companies.length;
  const topUps = state.transactions.filter((tx) => tx.amount > 0).length;
  const rides = state.transactions.filter((tx) => tx.amount < 0).length;
  return `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">Total Passengers</span><strong>${state.passengers.length}</strong><small>Local records</small></div>
      <div class="stat"><span class="stat-label">Bus Companies</span><strong>${companyCount}</strong><small>Operator accounts</small></div>
      <div class="stat"><span class="stat-label">Total Balance (PHP)</span><strong>${peso(totalBalance)}</strong><small>Stored on cards</small></div>
      <div class="stat"><span class="stat-label">Top Ups</span><strong>${topUps}</strong><small>Prototype history</small></div>
      <div class="stat"><span class="stat-label">Rides</span><strong>${rides}</strong><small>Fare deductions</small></div>
    </div>
  `;
}

function renderCompanies() {
  const company = editingCompanyId ? state.companies.find((item) => item.id === editingCompanyId) : null;
  const rows = state.companies
    .map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.address || "No address")}</small></td>
        <td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.contact || "")}</td>
        <td>${item.vehicles.length}</td>
        <td><span class="status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></td>
        <td><div class="row-actions">
          <button class="btn icon" title="Edit company" data-action="editCompany" data-id="${item.id}">${icon("edit")}</button>
          <button class="btn icon danger" title="Delete company" data-action="deleteCompany" data-id="${item.id}">${icon("trash")}</button>
        </div></td>
      </tr>
    `)
    .join("");

  return `
    ${renderStats()}
    <section class="panel">
      <div class="panel-header">
        <h2>${company ? "Edit Bus Company" : "Create Bus Company"}</h2>
        ${company ? `<button class="btn" data-action="cancelCompanyEdit">Cancel Edit</button>` : ""}
      </div>
      <form id="companyForm">
        <div class="form-grid">
          ${input("companyName", "Company Name", company?.name || "", "Transit Operator Inc.")}
          ${input("companyEmail", "Admin Email", company?.email || "", "operator@example.com", "email")}
          ${input("companyPassword", "Assigned Password", company?.password || "", "Enter password", "password")}
          ${input("companyContact", "Contact Number", company?.contact || "", "09XXXXXXXXX")}
          ${select("companyStatus", "Status", ["Active", "Inactive"], company?.status || "Active")}
          <div class="field wide"><label for="companyAddress">Company Address</label><textarea id="companyAddress" name="companyAddress" placeholder="Enter company address">${escapeHtml(company?.address || "")}</textarea></div>
        </div>
        <div class="actions">
          <button class="btn" type="reset">Clear</button>
          <button class="btn primary" type="submit">${company ? "Save Company" : "Create Company"}</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <div class="panel-header"><h2>Bus Companies</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Company</th><th>Admin Email</th><th>Contact</th><th>Vehicles</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="6"><div class="empty-state">No bus companies yet.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDestinations() {
  const destination = editingDestinationId ? state.destinations.find((item) => item.id === editingDestinationId) : null;
  const query = document.querySelector("#destinationSearch")?.value?.toLowerCase() || "";
  const rows = state.destinations
    .filter((item) => [item.name, item.area, item.status].join(" ").toLowerCase().includes(query))
    .map(renderDestinationRow)
    .join("");

  return `
    ${renderStats()}
    <section class="panel">
      <div class="panel-header">
        <h2>${destination ? "Edit Passenger Destination" : "Add Passenger Destination"}</h2>
        ${destination ? `<button class="btn" data-action="cancelDestinationEdit">Cancel Edit</button>` : ""}
      </div>
      <form id="destinationForm">
        <div class="form-grid">
          ${input("destinationName", "Destination / Stop", destination?.name || "", "Naga City")}
          ${input("destinationArea", "Area / Province", destination?.area || "", "Cebu")}
          ${select("destinationStatus", "Status", ["Active", "Inactive"], destination?.status || "Active")}
        </div>
        <div class="actions">
          <button class="btn" type="reset">Clear</button>
          <button class="btn primary" type="submit">${destination ? "Save Destination" : "Add Destination"}</button>
        </div>
      </form>
    </section>
    <section class="panel">
      <div class="panel-header">
        <h2>Passenger Destinations</h2>
        <div class="table-tools">
          <div class="field search"><input id="destinationSearch" placeholder="Search destination or area" data-action="searchDestinations" /></div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Destination</th><th>Area</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4"><div class="empty-state">No destinations found.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDestinationRow(destination) {
  return `
    <tr>
      <td><strong>${escapeHtml(destination.name)}</strong></td>
      <td>${escapeHtml(destination.area || "")}</td>
      <td><span class="status ${destination.status.toLowerCase()}">${escapeHtml(destination.status)}</span></td>
      <td><div class="row-actions">
        <button class="btn icon" title="Edit destination" data-action="editDestination" data-id="${destination.id}">${icon("edit")}</button>
        <button class="btn icon danger" title="Delete destination" data-action="deleteDestination" data-id="${destination.id}">${icon("trash")}</button>
      </div></td>
    </tr>
  `;
}

function renderRegister() {
  const passenger = editingId ? state.passengers.find((p) => p.id === editingId) : null;
  return `
    <section class="panel">
      <div class="panel-header">
        <h2>${passenger ? "Edit Passenger" : "Register Card"}</h2>
        ${passenger ? `<button class="btn" data-action="cancelEdit">Cancel Edit</button>` : ""}
      </div>
      <form id="passengerForm">
        <div class="form-grid">
          ${passenger ? input("rfid", "Card ID (RFID)", passenger.rfid, "Auto-generated", "text", "", "readonly") : ""}
          ${input("name", "Full Name", passenger?.name || "", "Enter full name")}
          ${input("email", "Email Address", passenger?.email || "", "name@example.com", "email")}
          ${select("govIdType", "Registered Government ID", idTypes, passenger?.govIdType || idTypes[0])}
          ${input("govIdNumber", "Government ID Number", passenger?.govIdNumber || "", "Enter ID number")}
          ${input("birthday", "Birthday", passenger?.birthday || "", "", "date")}
          ${input("age", "Age", passenger?.age || "", "Auto or manual", "number")}
          ${input("contact", "Registered Number", passenger?.contact || "", "09XXXXXXXXX")}
          ${select("status", "Status", ["Active", "Inactive"], passenger?.status || "Active")}
          ${passenger ? `<div class="field"><label>Current Balance</label><div class="readonly-value">PHP ${peso(passenger.balance)}</div></div>` : ""}
          <div class="field wide"><label for="address">Address</label><textarea id="address" name="address" placeholder="Enter address">${escapeHtml(passenger?.address || "")}</textarea></div>
          <div class="field wide"><label for="notes">Other Information</label><textarea id="notes" name="notes" placeholder="Notes, discount status, emergency details">${escapeHtml(passenger?.notes || "")}</textarea></div>
        </div>
        <div class="actions">
          <button class="btn" type="reset">Clear</button>
          <button class="btn primary" type="submit">${passenger ? "Save Changes" : "Create RFID"}</button>
        </div>
      </form>
    </section>
  `;
}

function renderScan() {
  const selected = state.passengers.find((p) => p.id === selectedPassengerId) || state.passengers[0];
  return `
    <section class="panel">
      <div class="panel-header"><h2>Scan Ride</h2></div>
      <div class="scan-panel">
        <div class="rfid-symbol scan-logo">${icon("radio")}</div>
        <div class="field">
          <label for="scanPassenger">Tap card on reader or choose passenger</label>
          <select id="scanPassenger" data-action="selectPassenger">${passengerOptions(selected?.id)}</select>
        </div>
        <div class="scan-identity">
          <strong>${escapeHtml(selected?.rfid || "No card selected")}</strong>
          <span>${escapeHtml(selected?.name || "Register a passenger first")}</span>
        </div>
        <div class="balance-box"><span>Balance (PHP)</span><strong>${peso(selected?.balance || 0)}</strong></div>
        <div class="field"><label for="fare">Fare (PHP)</label><input id="fare" type="number" min="1" step="0.01" value="15.00" /></div>
        <button class="btn primary" data-action="deductFare">Deduct Fare</button>
        ${message ? `<div class="alert ${message.includes("Insufficient") || message.includes("inactive") ? "danger" : "success"}">${escapeHtml(message)}</div>` : ""}
      </div>
    </section>
  `;
}

function renderTopUp() {
  const selected = state.passengers.find((p) => p.id === selectedPassengerId) || state.passengers[0];
  return `
    ${renderStats()}
    <section class="panel compact-panel">
      <div class="panel-header"><h2>Top Up Balance</h2></div>
      <div class="scan-panel">
        <div class="field"><label for="topupPassenger">Passenger</label><select id="topupPassenger" data-action="selectPassenger">${passengerOptions(selected?.id)}</select></div>
        <div class="balance-box"><span>Current Balance (PHP)</span><strong>${peso(selected?.balance || 0)}</strong></div>
        <div class="field"><label for="topupAmount">Top Up Amount</label><input id="topupAmount" type="number" min="1" step="0.01" value="100.00" /></div>
        <button class="btn primary" data-action="topUp">Add Balance</button>
        ${message ? `<div class="alert success">${escapeHtml(message)}</div>` : ""}
      </div>
    </section>
  `;
}

function renderPassengers(compact = false) {
  const query = document.querySelector("#passengerSearch")?.value?.toLowerCase() || "";
  const rows = state.passengers
    .filter((p) => [p.rfid, p.name, p.contact, p.govIdNumber].join(" ").toLowerCase().includes(query))
    .map(renderPassengerRow)
    .join("");

  return `
    <section class="panel" ${compact ? 'data-mobile-hidden="true"' : ""}>
      <div class="panel-header">
        <h2>Passengers</h2>
        <div class="table-tools">
          <div class="field search"><input id="passengerSearch" placeholder="Search by name, card ID, contact, or government ID" data-action="search" /></div>
          <button class="btn primary" data-action="view" data-view="register">${icon("plus")} Add Passenger</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>Card ID (RFID)</th><th>Name and ID</th><th>Registered Number</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7"><div class="empty-state">No passengers found.</div></td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderPassengerRow(p) {
  return `
    <tr>
      <td>${p.id}</td>
      <td>${escapeHtml(p.rfid)}</td>
      <td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.email || "No email")} &middot; ${escapeHtml(p.govIdType)}: ${escapeHtml(p.govIdNumber)}</small></td>
      <td>${escapeHtml(p.contact)}</td>
      <td style="font-weight:900;color:${p.balance <= 20 ? "var(--amber)" : "inherit"}">${peso(p.balance)}</td>
      <td><span class="status ${p.status.toLowerCase()}">${escapeHtml(p.status)}</span></td>
      <td><div class="row-actions">
        <button class="btn icon" title="Edit" data-action="editPassenger" data-id="${p.id}">${icon("edit")}</button>
        <button class="btn icon" title="Top up" data-action="openTopUp" data-id="${p.id}">${icon("plus")}</button>
        <button class="btn icon danger" title="Delete" data-action="deletePassenger" data-id="${p.id}">${icon("trash")}</button>
      </div></td>
    </tr>
  `;
}

function renderTransactions() {
  const items = state.transactions
    .slice()
    .reverse()
    .map(renderTransaction)
    .join("");

  return `
    ${renderStats()}
    <section class="panel">
      <div class="panel-header"><h2>Transactions</h2></div>
      <div class="transactions-list">${items || `<div class="empty-state">No transactions yet.</div>`}</div>
    </section>
  `;
}

function renderTransaction(tx) {
  const passenger = state.passengers.find((p) => p.id === tx.passengerId);
  const detail = tx.companyName
    ? ` &middot; ${escapeHtml(tx.companyName)}${tx.vehicleName ? ` / ${escapeHtml(tx.vehicleName)}` : ""}${tx.routeName ? ` / ${escapeHtml(tx.routeName)}` : ""}`
    : "";
  return `<div class="transaction">
    <strong>${escapeHtml(tx.type)} &middot; ${escapeHtml(passenger?.name || "Deleted passenger")}${detail}</strong>
    <span class="${tx.amount >= 0 ? "amount-credit" : "amount-debit"}">${tx.amount >= 0 ? "+" : "-"}PHP ${peso(Math.abs(tx.amount))}</span>
    <small>${new Date(tx.createdAt).toLocaleString("en-PH")} &middot; Balance after PHP ${peso(tx.balanceAfter)}</small>
  </div>`;
}

function renderModal() {
  if (modal?.type === "routeStop") return renderRouteStopModal();

  const passenger = state.passengers.find((p) => p.id === modal.passengerId);
  return `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="panel-header"><h2>Top Up ${escapeHtml(passenger?.name || "")}</h2><button class="btn icon" data-action="closeModal">&times;</button></div>
        <div class="modal-body">
          <div class="balance-box"><span>Current Balance (PHP)</span><strong>${peso(passenger?.balance || 0)}</strong></div>
          <div class="field"><label for="modalTopupAmount">Top Up Amount</label><input id="modalTopupAmount" type="number" min="1" step="0.01" value="100.00" /></div>
          <button class="btn primary" data-action="modalTopUp" data-id="${passenger?.id}">Add Balance</button>
        </div>
      </section>
    </div>
  `;
}

function renderRouteStopModal() {
  const company = state.companies.find((item) => item.id === modal.companyId);
  const baseVehicle = company?.vehicles.find((vehicle) => vehicle.id === modal.vehicleId);
  const baseRoute = routeLabel(baseVehicle) || "No base route stated";
  const editingRoute = baseVehicle?.routeFares?.find((routeFare) => routeFare.id === modal.editingRouteFareId);
  const destinationOptions = renderRouteDestinationOptions();
  const existingRows = (baseVehicle?.routeFares || [])
    .map((routeFare) => `
      <tr>
        <td>${escapeHtml(routeFare.routeTo || "No destination")}</td>
        <td style="font-weight:900">PHP ${peso(routeFare.fare)}</td>
        <td><div class="row-actions">
          <button class="btn icon" type="button" title="Edit route fare" data-action="editRouteFare" data-id="${baseVehicle.id}" data-route-id="${routeFare.id}">${icon("edit")}</button>
          <button class="btn icon danger" type="button" title="Delete route fare" data-action="deleteRouteFare" data-id="${baseVehicle.id}" data-route-id="${routeFare.id}">${icon("trash")}</button>
        </div></td>
      </tr>
    `)
    .join("");
  const draftRows = routeStopDrafts
    .map((draft, index) => `
      <tr>
        <td>${escapeHtml(draft.destinationName)}</td>
        <td style="font-weight:900">PHP ${peso(draft.fare)}</td>
        <td><button class="btn icon danger" title="Remove destination" data-action="removeRouteDraft" data-index="${index}">${icon("trash")}</button></td>
      </tr>
    `)
    .join("");

  return `
    <div class="modal-backdrop">
      <section class="modal wide-modal">
        <div class="panel-header">
          <h2>Add Route Fare</h2>
          <button class="btn icon" data-action="closeModal">&times;</button>
        </div>
        <form id="routeStopForm" class="modal-body">
          <div class="field">
            <label>Bus / Unit</label>
            <div class="readonly-value">${escapeHtml(baseVehicle?.name || "")}${baseVehicle?.plate ? ` - ${escapeHtml(baseVehicle.plate)}` : ""}</div>
          </div>
          <div class="field">
            <label>Base Route</label>
            <div class="readonly-value">${escapeHtml(baseRoute)}</div>
          </div>
          <div class="route-draft-grid">
            <div class="field">
              <label for="routeStopDestination">Passenger Destination / Stop</label>
              <div class="custom-combobox" id="routeDestinationCombobox">
                <div class="custom-combobox-control">
                  <input id="routeStopDestination" name="routeStopDestination" value="${escapeHtml(editingRoute?.routeTo || "")}" placeholder="Type passenger destination" autocomplete="off" data-action="filterRouteDestinations" />
                  <button class="custom-combobox-toggle" type="button" data-action="toggleRouteDestinations" aria-label="Show passenger destinations">${icon("chevron")}</button>
                </div>
                <div class="custom-options" id="passengerDestinationList">${destinationOptions}</div>
              </div>
            </div>
            <div class="field">
              <label for="routeStopFare">Fixed Fare (PHP)</label>
              <input id="routeStopFare" name="routeStopFare" type="number" min="1" step="0.01" value="${peso(editingRoute?.fare || 15)}" />
            </div>
            <button class="btn" type="button" data-action="addRouteDraft">${editingRoute ? icon("edit") + " Save Edit" : icon("plus") + " Add to List"}</button>
            ${editingRoute ? `<button class="btn" type="button" data-action="cancelRouteFareEdit">Cancel Edit</button>` : ""}
          </div>
          <div class="table-wrap compact-table">
            <table>
              <thead><tr><th>Destination</th><th>Fixed Fare</th><th>Actions</th></tr></thead>
              <tbody>${draftRows || `<tr><td colspan="3"><div class="empty-state">Add one or more destinations before saving.</div></td></tr>`}</tbody>
            </table>
          </div>
          <div class="table-wrap compact-table">
            <table>
              <thead><tr><th>Existing Route</th><th>Fixed Fare</th><th>Actions</th></tr></thead>
              <tbody>${existingRows || `<tr><td colspan="3"><div class="empty-state">No extra routes saved for this bus yet.</div></td></tr>`}</tbody>
            </table>
          </div>
          <div class="hint">Passenger destination choices come from the admin Passenger Destination page. New route fares are saved under this bus.</div>
          <button class="btn primary" type="submit">Save Route Fares</button>
        </form>
      </section>
    </div>
  `;
}

function input(name, label, value, placeholder, type = "text", step = "", attributes = "") {
  return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${step ? `step="${step}"` : ""} ${attributes} /></div>`;
}

function select(name, label, options, value, attributes = "") {
  return `<div class="field select-field"><label for="${name}">${label}</label><select id="${name}" name="${name}" ${attributes}>${options.map((option) => `<option ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></div>`;
}

function passengerDestinationLabel(destination) {
  if (!destination) return "";
  return `${destination.name}${destination.area ? ` - ${destination.area}` : ""}`;
}

function passengerDestinationOptions(selectedValue = "") {
  return state.destinations
    .filter((destination) => destination.status === "Active")
    .map((destination) => {
      const label = passengerDestinationLabel(destination);
      return `<option value="${escapeHtml(label)}" ${label === selectedValue ? "selected" : ""}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function renderRouteDestinationOptions(query = "") {
  const normalized = query.trim().toLowerCase();
  const options = state.destinations
    .filter((destination) => {
      if (destination.status !== "Active") return false;
      if (!normalized) return true;
      return [destination.name, destination.area].join(" ").toLowerCase().includes(normalized);
    })
    .map((destination) => {
      const label = passengerDestinationLabel(destination);
      return `<button class="custom-option" type="button" data-action="selectRouteDestination" data-value="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
    })
    .join("");

  return options || `<div class="custom-option empty">No match. Add to List creates it.</div>`;
}

function passengerOptions(selectedId) {
  return state.passengers
    .map((p) => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.name)} - ${escapeHtml(p.rfid)}</option>`)
    .join("");
}

function vehicleOptions(company, selectedId) {
  const vehicles = companyFareProfiles(company);
  return vehicles
    .map((vehicle) => `<option value="${vehicle.id}" ${vehicle.id === selectedId ? "selected" : ""}>${escapeHtml(vehicle.name)} - ${escapeHtml(routeLabel(vehicle) || "No route")} - PHP ${peso(vehicle.fare)}</option>`)
    .join("");
}

function companyFareProfiles(company) {
  return (company?.vehicles || []).flatMap((vehicle) => [
    vehicle,
    ...(vehicle.routeFares || []).map((routeFare) => ({
      ...vehicle,
      ...routeFare,
      id: routeFare.id,
      baseVehicleId: vehicle.id,
      routeFareId: routeFare.id,
      name: vehicle.name,
      plate: vehicle.plate,
      isRouteFare: true,
    })),
  ]);
}

function routeLabel(vehicle) {
  if (!vehicle) return "";
  const from = vehicle.routeFrom?.trim();
  const to = vehicle.routeTo?.trim();
  if (from && to) return `${from} to ${to}`;
  return from || to || "";
}

function pricingLabel(vehicle) {
  if (!vehicle) return "";
  if (vehicle.pricingMode === "Per kilometer") {
    return `${peso(vehicle.distanceKm)} km x PHP ${peso(vehicle.pricePerKm)}/km`;
  }
  return "Fixed fare";
}

function calculateVehicleFare(data) {
  if (data.pricingMode === "Per kilometer") {
    return Number(data.distanceKm || 0) * Number(data.pricePerKm || 0);
  }
  return Number(data.vehicleFare || 0);
}

function updatePricingFields(pricingMode) {
  const isPerKm = pricingMode === "Per kilometer";
  document.querySelectorAll(".fixed-fare-field").forEach((field) => {
    field.classList.toggle("is-hidden", isPerKm);
    field.querySelectorAll("input").forEach((inputEl) => {
      inputEl.disabled = isPerKm;
    });
  });
  document.querySelectorAll(".per-km-field").forEach((field) => {
    field.classList.toggle("is-hidden", !isPerKm);
    field.querySelectorAll("input").forEach((inputEl) => {
      inputEl.disabled = !isPerKm;
    });
  });
}

function randomRfid() {
  let cardId = "";
  do {
    cardId = Array.from({ length: 8 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase(),
    ).join(" ");
  } while (state?.passengers?.some((passenger) => passenger.rfid === cardId));
  return cardId;
}

function bindEvents() {
  const loginForm = document.querySelector("#loginForm");
  if (loginForm) loginForm.onsubmit = login;

  const publicRegisterForm = document.querySelector("#publicRegisterForm");
  if (publicRegisterForm) publicRegisterForm.onsubmit = publicRegister;

  const passengerForm = document.querySelector("#passengerForm");
  if (passengerForm) passengerForm.onsubmit = savePassenger;

  const companyForm = document.querySelector("#companyForm");
  if (companyForm) companyForm.onsubmit = saveCompany;

  const vehicleForm = document.querySelector("#vehicleForm");
  if (vehicleForm) vehicleForm.onsubmit = saveVehicle;

  const routeStopForm = document.querySelector("#routeStopForm");
  if (routeStopForm) routeStopForm.onsubmit = saveRouteStopFare;

  const destinationForm = document.querySelector("#destinationForm");
  if (destinationForm) destinationForm.onsubmit = saveDestination;

  const passengerTopUpForm = document.querySelector("#passengerTopUpForm");
  if (passengerTopUpForm) passengerTopUpForm.onsubmit = passengerTopUp;

  const pricingMode = document.querySelector("#pricingMode");
  if (pricingMode) updatePricingFields(pricingMode.value);

  const app = document.querySelector("#app");
  app.onclick = handleAction;
  app.onchange = handleAction;
  app.oninput = handleAction;
}

function login(event) {
  event.preventDefault();
  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value.trim();
  if (username === "admin" && password === "admin123") {
    state.isLoggedIn = true;
    state.role = "admin";
    state.sessionPassengerId = null;
    state.sessionCompanyId = null;
    persist();
    render();
    return;
  }

  const company = state.companies.find((item) => item.email.toLowerCase() === username.toLowerCase() && item.password === password && item.status === "Active");
  if (company) {
    state.isLoggedIn = true;
    state.role = "company";
    state.sessionPassengerId = null;
    state.sessionCompanyId = company.id;
    companyView = "fares";
    selectedCompanyVehicleId = company.vehicles[0]?.id ?? null;
    persist();
    render();
    return;
  }

  const account = state.accounts.find((item) => {
    const login = username.toLowerCase();
    return item.password === password && (item.email?.toLowerCase() === login || item.username?.toLowerCase() === login);
  });
  if (account) {
    state.isLoggedIn = true;
    state.role = "passenger";
    state.sessionPassengerId = account.passengerId;
    state.sessionCompanyId = null;
    persist();
    render();
    return;
  }

  document.querySelector("#loginError").textContent = "Invalid credentials.";
}

function handleAction(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !event.currentTarget.contains(target)) return;

  const action = target.dataset.action;
  const id = Number(target.dataset.id);

  if (event.type === "click" && (target.tagName === "SELECT" || action === "selectPassenger" || action === "selectVehicle" || action === "pricingMode" || action === "search" || action === "searchDestinations")) return;
  if (event.type === "input" && action !== "search" && action !== "searchDestinations" && action !== "filterRouteDestinations") return;
  if (event.type === "change" && action !== "selectPassenger" && action !== "selectVehicle" && action !== "pricingMode") return;

  if (action === "landingTab") {
    landingTab = target.dataset.tab;
    render();
  }
  if (action === "togglePassword") {
    const input = document.querySelector("#password");
    if (!input) return;
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    target.setAttribute("aria-label", willShow ? "Hide password" : "Show password");
    target.setAttribute("aria-pressed", String(willShow));
  }
  if (action === "view") {
    currentView = target.dataset.view;
    message = "";
    render();
  }
  if (action === "companyView") {
    companyView = target.dataset.view;
    message = "";
    render();
  }
  if (action === "logout") {
    state.isLoggedIn = false;
    state.role = null;
    state.sessionPassengerId = null;
    state.sessionCompanyId = null;
    persist();
    render();
  }
  if (action === "cancelEdit") {
    editingId = null;
    render();
  }
  if (action === "cancelCompanyEdit") {
    editingCompanyId = null;
    render();
  }
  if (action === "cancelDestinationEdit") {
    editingDestinationId = null;
    render();
  }
  if (action === "editPassenger") {
    editingId = id;
    currentView = "register";
    render();
  }
  if (action === "editCompany") {
    editingCompanyId = id;
    currentView = "companies";
    render();
  }
  if (action === "editDestination") {
    editingDestinationId = id;
    currentView = "destinations";
    render();
  }
  if (action === "deleteCompany") deleteCompany(id);
  if (action === "deleteDestination") deleteDestination(id);
  if (action === "openRouteModal") {
    routeStopDrafts = [];
    modal = { type: "routeStop", companyId: state.sessionCompanyId, vehicleId: id, editingRouteFareId: null };
    render();
  }
  if (action === "deleteVehicle") deleteVehicle(id);
  if (action === "deleteRouteFare") deleteRouteFare(id, Number(target.dataset.routeId));
  if (action === "editRouteFare") editRouteFare(Number(target.dataset.routeId));
  if (action === "deletePassenger") deletePassenger(id);
  if (action === "openTopUp") {
    modal = { passengerId: id };
    render();
  }
  if (action === "closeModal") {
    modal = null;
    routeStopDrafts = [];
    render();
  }
  if (action === "modalTopUp") topUpPassenger(id, Number(document.querySelector("#modalTopupAmount").value));
  if (action === "topUp") topUpPassenger(selectedPassengerId, Number(document.querySelector("#topupAmount").value));
  if (action === "deductFare") deductFare(Number(document.querySelector("#fare").value));
  if (action === "companyDeductFare") companyDeductFare();
  if (action === "addRouteDraft") addRouteDraft();
  if (action === "cancelRouteFareEdit") {
    modal = { ...modal, editingRouteFareId: null };
    render();
  }
  if (action === "toggleRouteDestinations") toggleRouteDestinationOptions();
  if (action === "selectRouteDestination") selectRouteDestination(target.dataset.value);
  if (action === "removeRouteDraft") {
    routeStopDrafts = routeStopDrafts.filter((_, index) => index !== Number(target.dataset.index));
    render();
  }
  if (action === "selectPassenger") {
    selectedPassengerId = Number(target.value);
    message = "";
    render();
  }
  if (action === "selectVehicle") {
    selectedCompanyVehicleId = Number(target.value);
    message = "";
    render();
  }
  if (action === "pricingMode") {
    updatePricingFields(target.value);
  }
  if (action === "search") {
    const panel = target.closest(".panel");
    const tbody = panel.querySelector("tbody");
    const query = target.value.toLowerCase();
    const filtered = state.passengers.filter((p) => [p.rfid, p.name, p.email, p.contact, p.govIdNumber].join(" ").toLowerCase().includes(query));
    tbody.innerHTML = filtered.map(renderPassengerRow).join("");
  }
  if (action === "searchDestinations") {
    const panel = target.closest(".panel");
    const tbody = panel.querySelector("tbody");
    const query = target.value.toLowerCase();
    const filtered = state.destinations.filter((destination) => [destination.name, destination.area, destination.status].join(" ").toLowerCase().includes(query));
    tbody.innerHTML = filtered.map(renderDestinationRow).join("");
  }
  if (action === "filterRouteDestinations") {
    filterRouteDestinations(target.value);
  }
}

function saveCompany(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const email = data.companyEmail.trim().toLowerCase();
  const company = {
    id: editingCompanyId || state.nextCompanyId,
    name: data.companyName.trim(),
    email,
    password: data.companyPassword.trim(),
    contact: data.companyContact.trim(),
    address: data.companyAddress.trim(),
    status: data.companyStatus,
    vehicles: editingCompanyId ? state.companies.find((item) => item.id === editingCompanyId)?.vehicles || [] : [],
  };

  if (!company.name || !company.email || !company.password) {
    showToast("Company name, admin email, and password are required.");
    return;
  }
  if (!company.email.includes("@") || !company.email.includes(".")) {
    showToast("Please enter a valid company email address.");
    return;
  }
  if (state.companies.some((item) => item.email.toLowerCase() === company.email && item.id !== company.id)) {
    showToast("Another company already uses that email.");
    return;
  }

  if (editingCompanyId) {
    state.companies = state.companies.map((item) => (item.id === editingCompanyId ? company : item));
    editingCompanyId = null;
  } else {
    state.companies.unshift(company);
    state.nextCompanyId += 1;
  }

  persist();
  render();
}

function deleteCompany(id) {
  const company = state.companies.find((item) => item.id === id);
  if (!company || !confirm(`Delete ${company.name}?`)) return;
  state.companies = state.companies.filter((item) => item.id !== id);
  if (state.sessionCompanyId === id) {
    state.isLoggedIn = false;
    state.role = null;
    state.sessionCompanyId = null;
  }
  persist();
  render();
}

function saveDestination(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const destination = {
    id: editingDestinationId || state.nextDestinationId,
    name: data.destinationName.trim(),
    area: data.destinationArea.trim(),
    status: data.destinationStatus,
  };

  if (!destination.name) {
    showToast("Destination name is required.");
    return;
  }

  const duplicate = state.destinations.find((item) => item.name.toLowerCase() === destination.name.toLowerCase() && item.id !== destination.id);
  if (duplicate) {
    showToast("That destination already exists.");
    return;
  }

  if (editingDestinationId) {
    state.destinations = state.destinations.map((item) => (item.id === editingDestinationId ? destination : item));
    editingDestinationId = null;
  } else {
    state.destinations.unshift(destination);
    state.nextDestinationId += 1;
  }

  persist();
  render();
}

function deleteDestination(id) {
  const destination = state.destinations.find((item) => item.id === id);
  if (!destination || !confirm(`Delete ${destination.name}?`)) return;
  state.destinations = state.destinations.filter((item) => item.id !== id);
  persist();
  render();
}

function saveVehicle(event) {
  event.preventDefault();
  const company = state.companies.find((item) => item.id === state.sessionCompanyId);
  if (!company) return;
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const fare = calculateVehicleFare(data);
  if (!data.vehicleName.trim() || !data.routeFrom.trim() || !data.routeTo.trim() || fare <= 0) {
    showToast("Vehicle name, route locations, and a valid fare are required.");
    return;
  }
  if (data.pricingMode === "Per kilometer" && (Number(data.distanceKm || 0) <= 0 || Number(data.pricePerKm || 0) <= 0)) {
    showToast("Distance and price per kilometer are required for kilometer pricing.");
    return;
  }

  const vehicle = {
    id: state.nextVehicleId,
    name: data.vehicleName.trim(),
    plate: data.vehiclePlate.trim(),
    routeFrom: data.routeFrom.trim(),
    routeTo: data.routeTo.trim(),
    routeFares: [],
    pricingMode: data.pricingMode,
    distanceKm: Number(data.distanceKm || 0),
    pricePerKm: Number(data.pricePerKm || 0),
    fare,
    status: data.vehicleStatus,
  };
  state.companies = state.companies.map((item) => (item.id === company.id ? { ...item, vehicles: [...item.vehicles, vehicle] } : item));
  state.nextVehicleId += 1;
  selectedCompanyVehicleId = vehicle.id;
  persist();
  message = "";
  render();
}

function saveRouteStopFare(event) {
  event.preventDefault();
  const company = state.companies.find((item) => item.id === modal?.companyId);
  const baseVehicle = company?.vehicles.find((vehicle) => vehicle.id === modal?.vehicleId);
  if (!company || !baseVehicle) return;

  const wasEditingRoute = Boolean(modal?.editingRouteFareId);
  if (routeStopDrafts.length === 0) {
    if (!addRouteDraft()) return;
    if (wasEditingRoute) return;
  }

  if (routeStopDrafts.length === 0) {
    showToast("Add at least one destination and fixed fare.");
    return;
  }

  const routeFares = routeStopDrafts.map((draft, index) => ({
    id: state.nextVehicleId + index,
    routeFrom: baseVehicle.routeFrom,
    routeTo: draft.destinationName,
    destinationId: draft.destinationId,
    pricingMode: "Fixed fare",
    distanceKm: 0,
    pricePerKm: 0,
    fare: draft.fare,
    status: "Active",
  }));

  state.companies = state.companies.map((item) =>
    item.id === company.id
      ? {
          ...item,
          vehicles: item.vehicles.map((vehicle) => (vehicle.id === baseVehicle.id ? { ...vehicle, routeFares: [...(vehicle.routeFares || []), ...routeFares] } : vehicle)),
        }
      : item,
  );
  state.nextVehicleId += routeFares.length;
  selectedCompanyVehicleId = routeFares[routeFares.length - 1].id;
  routeStopDrafts = [];
  modal = null;
  message = "";
  persist();
  render();
}

function addRouteDraft() {
  const company = state.companies.find((item) => item.id === modal?.companyId);
  const baseVehicle = company?.vehicles.find((vehicle) => vehicle.id === modal?.vehicleId);
  const destinationEl = document.querySelector("#routeStopDestination");
  const fareEl = document.querySelector("#routeStopFare");
  const destinationValue = destinationEl?.value.trim() || "";
  let destination = state.destinations.find((item) => item.status === "Active" && passengerDestinationLabel(item).toLowerCase() === destinationValue.toLowerCase());
  const fare = Number(fareEl?.value || 0);

  if (!destinationValue || fare <= 0) {
    showToast("Type a destination and enter a valid fixed fare.");
    return false;
  }

  if (!destination) {
    if (!destinationValue.split(" - ")[0].trim()) {
      showToast("Destination name is required.");
      return false;
    }
    destination = createPassengerDestinationFromText(destinationValue);
  }

  if (routeStopDrafts.some((draft) => draft.destinationId === destination.id)) {
    showToast("That destination is already in the list.");
    return false;
  }

  if (modal?.editingRouteFareId && company && baseVehicle) {
    const duplicateRoute = (baseVehicle.routeFares || []).find((routeFare) => routeFare.id !== modal.editingRouteFareId && routeFare.destinationId === destination.id);
    if (duplicateRoute) {
      showToast("That destination is already saved for this bus.");
      return false;
    }

    state.companies = state.companies.map((item) =>
      item.id === company.id
        ? {
            ...item,
            vehicles: item.vehicles.map((vehicle) =>
              vehicle.id === baseVehicle.id
                ? {
                    ...vehicle,
                    routeFares: (vehicle.routeFares || []).map((routeFare) =>
                      routeFare.id === modal.editingRouteFareId
                        ? { ...routeFare, routeTo: passengerDestinationLabel(destination), destinationId: destination.id, fare }
                        : routeFare,
                    ),
                  }
                : vehicle,
            ),
          }
        : item,
    );
    selectedCompanyVehicleId = modal.editingRouteFareId;
    modal = { ...modal, editingRouteFareId: null };
    persist();
    showToast(`${passengerDestinationLabel(destination)} route updated.`, "success");
    return true;
  }

  routeStopDrafts = [...routeStopDrafts, { destinationId: destination.id, destinationName: passengerDestinationLabel(destination), fare }];
  persist();
  showToast(`${passengerDestinationLabel(destination)} added to the route list.`, "success");
  return true;
}

function editRouteFare(routeFareId) {
  routeStopDrafts = [];
  modal = { ...modal, editingRouteFareId: routeFareId };
  render();
}

function createPassengerDestinationFromText(value) {
  const [namePart, ...areaParts] = value.split(" - ");
  const destination = {
    id: state.nextDestinationId,
    name: namePart.trim(),
    area: areaParts.join(" - ").trim(),
    status: "Active",
  };
  state.destinations = [destination, ...state.destinations];
  state.nextDestinationId += 1;
  return destination;
}

function filterRouteDestinations(query) {
  const list = document.querySelector("#passengerDestinationList");
  const combobox = document.querySelector("#routeDestinationCombobox");
  if (!list || !combobox) return;
  list.innerHTML = renderRouteDestinationOptions(query);
  combobox.classList.add("open");
}

function toggleRouteDestinationOptions() {
  const inputEl = document.querySelector("#routeStopDestination");
  const list = document.querySelector("#passengerDestinationList");
  const combobox = document.querySelector("#routeDestinationCombobox");
  if (!inputEl || !list || !combobox) return;
  list.innerHTML = renderRouteDestinationOptions(inputEl.value);
  combobox.classList.toggle("open");
  inputEl.focus();
}

function selectRouteDestination(value) {
  const inputEl = document.querySelector("#routeStopDestination");
  const combobox = document.querySelector("#routeDestinationCombobox");
  if (!inputEl || !value) return;
  inputEl.value = value;
  combobox?.classList.remove("open");
}

function deleteVehicle(id) {
  const company = state.companies.find((item) => item.id === state.sessionCompanyId);
  if (!company) return;
  const vehicle = company.vehicles.find((item) => item.id === id);
  if (!vehicle || !confirm(`Delete ${vehicle.name}?`)) return;
  state.companies = state.companies.map((item) => (item.id === company.id ? { ...item, vehicles: item.vehicles.filter((v) => v.id !== id) } : item));
  if (selectedCompanyVehicleId === id) {
    const remaining = state.companies.find((item) => item.id === company.id)?.vehicles || [];
    selectedCompanyVehicleId = remaining[0]?.id ?? null;
  }
  persist();
  render();
}

function deleteRouteFare(vehicleId, routeFareId) {
  const company = state.companies.find((item) => item.id === state.sessionCompanyId);
  if (!company) return;
  const vehicle = company.vehicles.find((item) => item.id === vehicleId);
  const routeFare = vehicle?.routeFares?.find((item) => item.id === routeFareId);
  if (!vehicle || !routeFare || !confirm(`Delete ${routeFare.routeTo}?`)) return;
  state.companies = state.companies.map((item) =>
    item.id === company.id
      ? { ...item, vehicles: item.vehicles.map((v) => (v.id === vehicleId ? { ...v, routeFares: (v.routeFares || []).filter((fare) => fare.id !== routeFareId) } : v)) }
      : item,
  );
  if (selectedCompanyVehicleId === routeFareId) selectedCompanyVehicleId = vehicleId;
  persist();
  render();
}

function publicRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const name = data.publicName.trim();
  const email = data.publicEmail.trim().toLowerCase();
  const password = data.publicPassword.trim();

  if (!name || !email || !password || !data.publicGovIdNumber.trim()) {
    showToast("Full name, email, password, and government ID number are required.");
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    showToast("Please enter a valid email address.");
    return;
  }

  if (state.accounts.some((account) => account.email?.toLowerCase() === email)) {
    showToast("An account with that email already exists.");
    return;
  }

  const passenger = {
    id: state.nextId,
    rfid: randomRfid(),
    govIdType: data.publicGovIdType,
    govIdNumber: data.publicGovIdNumber.trim(),
    name,
    email,
    birthday: data.publicBirthday,
    age: Number(data.publicAge || calculateAge(data.publicBirthday)),
    contact: data.publicContact.trim(),
    address: data.publicAddress.trim(),
    balance: 0,
    status: "Active",
    notes: data.publicNotes.trim(),
  };

  state.passengers.unshift(passenger);
  state.accounts.push({ passengerId: passenger.id, username: passenger.name, email, password });
  state.nextId += 1;
  selectedPassengerId = passenger.id;
  persist();
  form.reset();
  document.querySelector("#publicRegisterMessage").textContent = `Created. Sign in with ${passenger.email}. Starting balance: PHP 0.00.`;
}

function savePassenger(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const existing = editingId ? state.passengers.find((p) => p.id === editingId) : null;
  const passenger = {
    id: editingId || state.nextId,
    rfid: existing?.rfid || randomRfid(),
    govIdType: data.govIdType,
    govIdNumber: data.govIdNumber.trim(),
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    birthday: data.birthday,
    age: Number(data.age || calculateAge(data.birthday)),
    contact: data.contact.trim(),
    address: data.address.trim(),
    balance: existing ? Number(existing.balance) : 0,
    status: data.status,
    notes: data.notes.trim(),
  };

  if (!passenger.name || !passenger.govIdNumber) {
    showToast("Name and government ID number are required.");
    return;
  }

  if (passenger.email && (!passenger.email.includes("@") || !passenger.email.includes("."))) {
    showToast("Please enter a valid email address.");
    return;
  }

  const emailOwner = state.accounts.find((account) => account.email?.toLowerCase() === passenger.email && account.passengerId !== passenger.id);
  if (passenger.email && emailOwner) {
    showToast("Another passenger account already uses that email.");
    return;
  }

  if (editingId) {
    state.passengers = state.passengers.map((p) => (p.id === editingId ? passenger : p));
    state.accounts = state.accounts.map((account) => (account.passengerId === editingId ? { ...account, username: passenger.name, email: passenger.email } : account));
    editingId = null;
  } else {
    state.passengers.unshift(passenger);
    state.nextId += 1;
    selectedPassengerId = passenger.id;
  }

  persist();
  currentView = "passengers";
  render();
}

function calculateAge(birthday) {
  if (!birthday) return "";
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function deletePassenger(id) {
  const passenger = state.passengers.find((p) => p.id === id);
  if (!passenger || !confirm(`Delete ${passenger.name}?`)) return;
  state.passengers = state.passengers.filter((p) => p.id !== id);
  state.accounts = state.accounts.filter((account) => account.passengerId !== id);
  if (selectedPassengerId === id) selectedPassengerId = state.passengers[0]?.id ?? null;
  persist();
  render();
}

function topUpPassenger(id, amount) {
  if (!id || amount <= 0) return;
  state.passengers = state.passengers.map((p) => {
    if (p.id !== id) return p;
    const balanceAfter = Number(p.balance) + amount;
    state.transactions.push(transactionSeed(id, "Top up", amount, balanceAfter));
    return { ...p, balance: balanceAfter };
  });
  modal = null;
  message = `Top up successful: PHP ${peso(amount)}`;
  persist();
  render();
}

function passengerTopUp(event) {
  event.preventDefault();
  const amount = Number(document.querySelector("#passengerTopUpAmount").value);
  if (!state.sessionPassengerId || amount <= 0) return;
  topUpPassenger(state.sessionPassengerId, amount);
}

function deductFare(amount, details = {}) {
  const passenger = state.passengers.find((p) => p.id === selectedPassengerId);
  if (!passenger || amount <= 0) return;
  if (passenger.status !== "Active") {
    message = "Card is inactive.";
    render();
    return;
  }
  if (passenger.balance < amount) {
    message = "Insufficient Balance";
    render();
    return;
  }

  state.passengers = state.passengers.map((p) => {
    if (p.id !== passenger.id) return p;
    const balanceAfter = Number(p.balance) - amount;
    state.transactions.push(transactionSeed(p.id, "Ride fare", -amount, balanceAfter, details));
    return { ...p, balance: balanceAfter };
  });
  message = `Fare deducted: PHP ${peso(amount)}`;
  persist();
  render();
}

function companyDeductFare() {
  const company = state.companies.find((item) => item.id === state.sessionCompanyId);
  const vehicle = companyFareProfiles(company).find((item) => item.id === selectedCompanyVehicleId);
  if (!company || !vehicle) {
    message = "No active vehicle selected.";
    render();
    return;
  }
  if (vehicle.status !== "Active") {
    message = "Selected vehicle is inactive.";
    render();
    return;
  }
  deductFare(Number(vehicle.fare), {
    companyId: company.id,
    companyName: company.name,
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    routeName: routeLabel(vehicle),
    pricingMode: vehicle.pricingMode,
    distanceKm: vehicle.distanceKm,
    pricePerKm: vehicle.pricePerKm,
  });
}

render();
