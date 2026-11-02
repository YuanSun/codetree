/* Course map: drives the home page, top nav, prev/next links and progress tracking. */
window.FAA_MODULES = [
  { id: "01", icon: "🏛️", track: "core",   file: "01-industry-and-structures.html", title: "The Fund Industry & Structures",  mins: 25, blurb: "Who does what: GP, manager, administrator, custodian, prime broker, auditor. Hedge, PE, mutual and master-feeder structures." },
  { id: "02", icon: "🧮", track: "core",   file: "02-accounting-fundamentals.html", title: "Accounting Fundamentals for Funds", mins: 35, blurb: "Double entry, accruals, trade-date accounting, realized vs unrealized P&L and the journal entries behind every trade." },
  { id: "03", icon: "🔄", track: "core",   file: "03-nav-cycle.html",               title: "The NAV Cycle",                    mins: 30, blurb: "From trade capture to a signed-off NAV: the daily and month-end process, reasonableness checks, and NAV errors." },
  { id: "04", icon: "📈", track: "core",   file: "04-instruments.html",             title: "Instruments & How to Book Them",   mins: 45, blurb: "Equities, bonds and accrued interest, FX, futures, options, swaps, short sales and corporate actions." },
  { id: "05", icon: "🏷️", track: "core",   file: "05-pricing-fair-value.html",      title: "Pricing & Fair Value",             mins: 25, blurb: "Price sources, stale prices, the Level 1/2/3 hierarchy, challenges and pricing committees." },
  { id: "06", icon: "👥", track: "core",   file: "06-investor-accounting.html",     title: "Investor Accounting",              mins: 40, blurb: "Capital accounts, subscriptions, redemptions, allocations, series, equalization, side pockets and gates." },
  { id: "07", icon: "💰", track: "core",   file: "07-fees-and-waterfalls.html",     title: "Fees, Expenses & Waterfalls",      mins: 40, blurb: "Management and performance fees, HWM, hurdles, crystallization; PE waterfalls, IRR, MOIC, DPI, TVPI." },
  { id: "08", icon: "🔍", track: "core",   file: "08-reconciliation-controls.html", title: "Reconciliation & Controls",        mins: 30, blurb: "Cash, position and broker recs, break ageing, four-eyes review, SOC 1, and building a defensible process." },
  { id: "09", icon: "📑", track: "core",   file: "09-financial-statements.html",    title: "Financial Statements & Audit",     mins: 35, blurb: "ASC 946 / IFRS statements, schedule of investments, financial highlights, audit PBC and tax basics." },
  { id: "10", icon: "🧭", track: "geneva", file: "10-geneva-mental-model.html",     title: "Geneva: The Mental Model",         mins: 35, blurb: "How Geneva is organised: entities, transactions, lots, ledger, the two time axes (effective date and knowledge date)." },
  { id: "11", icon: "⚙️", track: "geneva", file: "11-geneva-daily-workflow.html",   title: "Geneva: Daily & Month-End Workflow", mins: 40, blurb: "Loading trades, prices and FX, processing corporate actions, rolling forward, allocating and closing a period." },
  { id: "12", icon: "📊", track: "geneva", file: "12-geneva-reports-recs.html",     title: "Geneva: Reports, Recs & Troubleshooting", mins: 40, blurb: "Reading the standard reports, reconciling to brokers and the admin ledger, and diagnosing common breaks." },
  { id: "13", icon: "🎯", track: "senior", file: "13-thinking-like-a-senior.html",  title: "Thinking Like a Senior",           mins: 30, blurb: "Review technique, materiality, error correction, escalation, communication and owning the close." }
];
window.FAA_TRACKS = {
  core:   { label: "Core fund accounting", color: "var(--core)" },
  geneva: { label: "Advent Geneva",        color: "var(--geneva)" },
  senior: { label: "Senior skills",        color: "var(--senior)" }
};
