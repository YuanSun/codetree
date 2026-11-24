# Alternative Investments
@topic alt

## Features and categories of alternative investments
@id alternatives-overview
@r 80
@aka alternative investments; alternatives; alts; private markets; illiquid investments; categories of alternatives; low correlation; diversification alternatives
@see investment-methods; fund-structures; alt-performance

Investments outside traditional long-only stocks, bonds and cash: **private capital** (private equity, private debt), **real assets** (real estate, infrastructure, natural resources), **hedge funds**, and **digital assets**.

Common features: specialized managers, **illiquidity**, low transparency, limited historical data, high fees, use of leverage, restrictions on redemptions, and low correlation with traditional assets (part real, part an artefact of smoothed appraisal-based valuations). They offer diversification and possibly higher returns, at the price of complexity and harder due diligence.

## Direct investment, co-investment and fund investment
@id investment-methods
@r 80
@aka fund investing; co investing; direct investing; LP investing; how to invest in private equity; due diligence alternatives
@see fund-structures; alternatives-overview

| Method | What it is | Pros | Cons |
|---|---|---|---|
| Fund investment | Invest as an LP in a manager's fund | Diversification, manager expertise; small minimum relative to direct | Highest fees; no control over picks |
| Co-investment | Invest alongside a fund directly in a specific deal | Lower or no fees on that portion; learning; more control | Adverse selection risk (offered weaker deals); less diversification |
| Direct investment | Buy assets or companies without an intermediary | Control, no fund fees, flexibility | Needs expertise and scale; concentrated |

## Ownership and compensation structures
@id fund-structures
@r 80
@aka limited partnership; general partner; limited partner; GP; LP; management fee; incentive fee; carried interest; carry; hurdle rate; high water mark; catch up clause; clawback; waterfall; two and twenty
@see alt-performance; hedge-funds

Most private funds are **limited partnerships**: the **GP** manages the fund and has unlimited liability; **LPs** (investors) commit capital and have limited liability. Terms are set in the **limited partnership agreement**; side letters may give some LPs special terms.

Compensation:

- **Management fee**: % of committed or invested capital (or AUM for hedge funds), e.g. 1.5–2%.
- **Incentive fee / carried interest**: share of profits, e.g. 20%, often only above a **hurdle rate** (soft hurdle: fee on all profit once exceeded; hard hurdle: only on profit above it).
- **Catch-up clause**: lets the GP receive a larger share after the hurdle until it reaches its full share of profits.
- **High-water mark**: no incentive fee until losses are recovered.
- **Waterfall**: **European (whole-of-fund)**: GP gets carry only after LPs get back all capital plus the hurdle; **American (deal-by-deal)**: carry paid per deal, earlier for the GP.
- **Clawback**: GP must return carry if later losses mean it was overpaid.

## Performance appraisal of alternatives
@id alt-performance
@r 81
@aka alternative investment performance; IRR for private equity; multiple of invested capital; MOIC; TVPI; DPI; RVPI; J curve; Sortino ratio alternatives; Calmar ratio; drawdown; appraisal smoothing
@see fund-structures; alt-fee-calculation; sortino-ratio

Challenges: illiquidity, valuations based on appraisals or models (smoothed returns understate volatility and correlation), non-normal returns, leverage and short histories.

Measures:

- **IRR** (money-weighted) for private funds where the GP controls cash flow timing.
- **Multiples**: TVPI (total value / paid-in), DPI (distributions / paid-in, i.e. cash returned), RVPI (residual value / paid-in). TVPI = DPI + RVPI. Also MOIC.
- **Downside measures** for hedge funds: [[sortino-ratio]], maximum drawdown, Calmar ratio (return / max drawdown).

Private equity funds show a **J-curve**: negative returns early (fees, unrealized investments) before gains are realized.

## Calculating returns before and after fees
@id alt-fee-calculation
@r 81
@aka net of fees return; hedge fund fee calculation; incentive fee calculation; 2 and 20 calculation; fee drag; fee on fee fund of funds
@see fund-structures

Steps for a typical "2 and 20" fund:

1. Management fee = 2% × assets (beginning or ending, per the terms).
2. Incentive fee = 20% × profit, calculated **net of the management fee** or **independently** (on gross profit), and only on gains above the hurdle and high-water mark.
3. Investor's net return = (ending value − fees − beginning value) / beginning value.

> **Example** 100 grows to 115. Management fee 2% of 115 = 2.30. Incentive fee (net of management fee) = 20% × (115 − 100 − 2.30) = 2.54. Net value 110.16 → net return 10.2% vs gross 15%.

**Funds of funds** add a second layer of fees but offer diversification, due diligence and access to closed funds.

## Private equity
@id private-equity
@r 82
@aka private equity; PE; startup investing; how to value a startup; leveraged buyout; LBO; management buyout; MBO; venture capital; VC; growth equity; seed; early stage; late stage; exit strategies; trade sale; secondary sale; IPO exit
@see private-debt; investment-methods; alt-performance

Equity in private companies, or public companies taken private.

- **Leveraged buyouts (LBOs)**: buy a mature company with heavy debt; returns come from operational improvements, debt paydown and multiple expansion. **MBO**: management buys the company.
- **Venture capital**: minority stakes in young companies, by stage: pre-seed/seed (idea), early stage (product launched), late stage (scaling). High failure rates; returns concentrated in a few winners.
- **Growth equity**: minority stakes in established, growing firms to fund expansion.

Exit routes: **trade sale** to a strategic buyer, **IPO**, **secondary sale** to another PE firm, recapitalization (re-leveraging to pay a dividend), liquidation. Risks: illiquidity, leverage, concentration, valuation opacity, manager dispersion is large (top-quartile managers matter).

## Private debt
@id private-debt
@r 82
@aka private credit; direct lending; mezzanine debt; venture debt; distressed debt; unitranche; leveraged loans private; special situations
@see private-equity; seniority

Loans made outside public bond markets, mostly by funds:

- **Direct lending**: senior, often secured, floating-rate loans to mid-sized companies (frequently PE-owned); **unitranche** loans combine senior and subordinated tranches in one.
- **Mezzanine debt**: subordinated, often with warrants or conversion features; higher yield.
- **Venture debt**: loans to VC-backed start-ups, usually with warrants.
- **Distressed debt**: buying debt of troubled companies at deep discounts, sometimes to gain control in restructuring.

Higher yields than public debt (illiquidity and complexity premiums); floating rates limit rate risk; credit and liquidity risk are the main concerns.

## Diversification benefits of private capital
@id private-capital-diversification
@r 82
@aka private equity correlation; private debt diversification; smoothed returns; illiquidity premium
@see private-equity; private-debt; alternatives-overview

Private equity's returns are highly correlated with public equity over full cycles (same economic drivers, plus leverage), so its diversification benefit is smaller than reported volatility suggests. Appraisal-based valuations **smooth** returns, making volatility and correlation look lower. Private debt offers income, floating rates and some diversification from public credit. The main argument for both is an **illiquidity premium** and access to a different opportunity set, rather than low correlation.

## Real estate: features and forms
@id real-estate
@r 83
@aka real estate investment; direct real estate; REIT; real estate investment trust; commercial real estate; residential real estate; core core plus value add opportunistic; cap rate; leases; property types
@see reit; real-estate-valuation; infrastructure

Property and land, held directly or indirectly:

| | Equity | Debt |
|---|---|---|
| Private | Direct ownership, private funds | Mortgages, private real estate loans |
| Public | REITs, real estate company shares | MBS, CMBS |

Property types: residential, office, retail, industrial/logistics, hospitality, and others (data centres, healthcare). Strategies by risk: **core** (stabilized, high-quality, income), **core-plus**, **value-add** (renovation, re-leasing) and **opportunistic** (development, distressed). Characteristics: heterogeneous assets, large lot sizes, high transaction costs, illiquidity, need for local expertise, and appraisal-based values.

## Real estate investment characteristics and valuation
@id real-estate-valuation
@r 83
@aka cap rate; capitalization rate; net operating income; NOI; income approach; cost approach; sales comparison approach; real estate returns; inflation hedge
@see real-estate; reit

Return comes from rental income and price appreciation. Leases make income bond-like; property values make it equity-like. Partial inflation hedge (rents can rise with inflation).

Valuation approaches:

- **Income approach**: \(Value = NOI_1 / \text{cap rate}\), or a DCF of rents. NOI = rental income − operating expenses (before financing and taxes).
- **Cost approach**: replacement cost of the building + land value − depreciation.
- **Sales comparison approach**: prices of similar properties recently sold.

Appraisal-based indices lag and smooth market moves; **REIT** prices react faster.

## REITs
@id reit
@r 83
@aka REIT; real estate investment trust; equity REIT; mortgage REIT; FFO; AFFO; funds from operations; net asset value REIT; pass through REIT tax
@see real-estate; real-estate-valuation

Publicly traded companies that own income-producing property (**equity REITs**) or real estate loans (**mortgage REITs**). They avoid corporate tax by distributing most income. Liquid, diversified, professionally managed access to real estate, but share prices behave more like equities in the short run. Analysed with **FFO** (net income + depreciation − gains on property sales) and **AFFO** (FFO − recurring capex), and by premium/discount to net asset value.

## Infrastructure
@id infrastructure
@r 83
@aka infrastructure investment; economic infrastructure; social infrastructure; brownfield; greenfield; public private partnership; PPP; toll roads; utilities; availability payments; concessions
@see real-estate

Long-lived real assets providing essential services:

- **Economic**: transport (toll roads, airports, ports), utilities (power, water), communications (towers, fibre).
- **Social**: schools, hospitals, prisons, often via **public-private partnerships**.

**Brownfield** = existing, operating assets with established cash flows (lower risk). **Greenfield** = assets to be built (construction and demand risk). Revenue models: regulated returns, long-term contracts, **availability payments** (paid for keeping the asset available), or demand-based (traffic). Characteristics: stable, often inflation-linked cash flows, monopoly-like positions, high leverage, long horizons, regulatory and political risk, illiquidity.

## Natural resources: land, timber, farmland
@id natural-resources
@r 84
@aka raw land; timberland; farmland; natural resources investment; timber returns; biological growth; farmland returns; land as inflation hedge
@see commodities; real-estate

- **Raw land**: undeveloped land; returns from appreciation or development; option-like.
- **Timberland**: returns from **biological growth** of trees, timber prices and land value. Flexible harvest timing (grow on when prices are low) is a real option. Also used for carbon credits.
- **Farmland**: returns from crop sales or lease income and land appreciation. Harvests are less flexible than timber; weather and commodity-price risk.

Common characteristics: inflation hedge, low correlation with stocks and bonds, illiquidity, high transaction costs, ESG considerations (sustainability, water).

## Commodities
@id commodities
@r 84
@aka commodity investing; commodity futures; energy; metals; agriculture; roll yield; contango; backwardation; collateral yield; spot price return; commodity index
@see natural-resources; cost-of-carry

Physical goods (energy, industrial and precious metals, grains, livestock, softs), usually accessed through **futures** (or commodity-producer equities, ETFs and swaps).

Return on a fully collateralized futures position = **spot price change** + **roll yield** + **collateral yield** (interest on the cash backing the futures).

- **Roll yield** is positive in **backwardation** (futures below spot: selling the expiring contract high and buying the next one cheaper) and negative in **contango**.
- Prices are driven by supply and demand, inventories, weather, geopolitics and the economic cycle.

Commodities can hedge inflation and diversify, but are volatile and earn no income themselves.

## Hedge funds: features and strategies
@id hedge-funds
@r 85
@aka hedge funds; equity long short; market neutral; event driven; merger arbitrage; distressed securities; relative value; convertible arbitrage; fixed income arbitrage; global macro; managed futures; CTA; multi strategy; activist
@see hedge-fund-vehicles; fund-structures; hedge-fund-risk-return

Pooled vehicles with flexible mandates: they can short, use leverage and derivatives, and invest across asset classes. Strategy groups:

- **Equity hedge**: long/short equity, market neutral, short bias, fundamental growth or value, quantitative.
- **Event-driven**: **merger arbitrage** (long target, short acquirer), distressed and restructuring, activist, special situations.
- **Relative value**: exploit pricing gaps: convertible arbitrage, fixed-income arbitrage, volatility arbitrage.
- **Opportunistic**: **global macro** (top-down bets on rates, currencies, indices) and **managed futures / CTAs** (often trend-following).
- **Multi-strategy**: several strategies under one roof, with capital allocated between teams.

Compared with mutual funds: less regulation and transparency, higher fees, lock-ups and notice periods, and absolute-return objectives.

## Hedge fund investment forms and vehicles
@id hedge-fund-vehicles
@r 85
@aka master feeder structure; separately managed account; SMA; fund of funds; funds of hedge funds; lockup period; notice period; redemption gates; side pocket; liquid alternatives; UCITS hedge fund
@see hedge-funds

- **Master-feeder structure**: onshore and offshore feeder funds invest in a single master fund that trades; tax efficiency for different investor types.
- **Separately managed accounts (SMAs)**: the investor owns the assets; full transparency and customization; higher minimums.
- **Funds of funds**: diversification and due diligence, at an extra fee layer.
- **Liquid alternatives**: hedge-fund-like strategies in regulated, daily-liquid mutual funds or UCITS.

Liquidity terms: **lock-up periods**, **notice periods**, redemption frequency, **gates** (caps on withdrawals) and **side pockets** for illiquid holdings.

## Hedge fund risk, return and diversification
@id hedge-fund-risk-return
@r 85
@aka hedge fund diversification; survivorship bias hedge funds; backfill bias; hedge fund indices; leverage risk; liquidity risk hedge funds; tail risk hedge funds
@see hedge-funds; alt-performance; skewness

Return sources: manager skill (alpha), exposure to risk premia (equity, credit, volatility, illiquidity) and leverage. Many strategies are **negatively skewed** with fat tails (they earn small, steady gains and occasionally lose a lot), so standard deviation understates risk; correlations with equities rise in crises.

Hedge fund index data suffer from **survivorship bias** (failed funds drop out) and **backfill bias** (funds add their good early history when they join), so they overstate returns. Dispersion between managers is wide, so manager selection matters more than in traditional assets.

## Distributed ledger technology and blockchain
@id dlt-blockchain
@r 86
@aka distributed ledger; blockchain; DLT; consensus mechanism; proof of work; proof of stake; smart contracts; permissioned vs permissionless; tokenization; decentralized finance; DeFi
@see digital-assets

A **distributed ledger** is a database shared across a network, where participants agree on its state through a **consensus mechanism** without a central authority. A **blockchain** groups transactions into cryptographically linked blocks.

- **Proof of work** (miners solve puzzles; energy-intensive) vs **proof of stake** (validators stake tokens).
- **Permissionless** (anyone can join, e.g. public blockchains) vs **permissioned** (approved participants, e.g. bank consortiums).
- **Smart contracts**: code that executes automatically when conditions are met.

Financial applications: **tokenization** of real assets (property, bonds, art), faster post-trade clearing and settlement, cross-border payments, **DeFi** (lending and trading without intermediaries), and record-keeping and compliance.

## Digital assets: types and investment features
@id digital-assets
@r 86
@aka digital assets; cryptocurrency; crypto; bitcoin; stablecoins; tokens; NFTs; non fungible tokens; central bank digital currency; CBDC; security tokens; utility tokens; governance tokens
@see dlt-blockchain; digital-asset-vehicles

Types:

- **Cryptocurrencies**: native tokens of blockchains (e.g. bitcoin), used as a medium of exchange or store of value; no cash flows.
- **Stablecoins**: tokens pegged to a currency or asset, backed by reserves or algorithms.
- **Tokens**: utility tokens (access to a platform), governance tokens, **security tokens** (claims on assets or cash flows).
- **NFTs**: unique tokens representing ownership of a digital or physical item.
- **CBDCs**: digital money issued by a central bank.

Investment features compared with traditional assets: no intrinsic cash flows for most cryptocurrencies (value depends on adoption and network effects), extreme volatility, 24/7 trading, regulatory uncertainty, custody and cyber-theft risk, and correlations with equities that have risen over time.

## Digital asset investment vehicles and risks
@id digital-asset-vehicles
@r 86
@aka bitcoin ETF; crypto ETF; crypto trust; coin trusts; crypto futures; crypto exchanges; custody; private keys; crypto risks; digital asset diversification
@see digital-assets

Ways to invest: **direct** ownership via exchanges or wallets (you hold the private keys); **coin trusts** (can trade at premiums or discounts to holdings); **ETFs and ETPs** (spot or futures-based); **futures and options** on regulated exchanges; shares of crypto-related companies (miners, exchanges); and venture or hedge funds specializing in digital assets.

Risks: price volatility, fraud and exchange failures, loss of private keys, smart-contract bugs, regulatory changes, limited investor protection and liquidity mismatches. Diversification benefits have been inconsistent.
