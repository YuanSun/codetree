# Equity Investments
@topic equity

## Types of equity securities
@id equity-types
@r 39, 40
@aka common stock; ordinary shares; preferred stock; preference shares; cumulative preferred; participating preferred; convertible preferred; callable shares; putable shares; dual class shares
@see preferred-stock-valuation; voting-rights

- **Common shares**: residual claim on assets and earnings, voting rights, dividends at the board's discretion. Can be callable (by the company) or putable (by the holder).
- **Preferred shares**: priority over common for dividends and in liquidation; dividends usually fixed; usually no vote. **Cumulative** preferred dividends not paid accumulate and must be paid before any common dividend. **Participating** preferred can share extra profits. **Convertible** preferred can be exchanged for common shares.
- **Dual-class shares**: classes with different voting rights (e.g. founders' super-voting shares).

Risk ranking, most to least risky for the investor: common, preferred, debt.

## Public vs. private equity securities
@id public-vs-private-equity
@r 39
@aka listed equity; private equity securities; liquidity of private shares; venture capital; private investment in public equity; PIPE
@see public-vs-private-companies; private-equity

Private equity: shares not listed; illiquid; no market price; fewer reporting requirements; investors are usually institutions or wealthy individuals and often have more control and a longer horizon. Public equity: liquid, price discovery, strict disclosure, shorter-term market pressure. Types of private equity: venture capital, buyouts, and **PIPEs** (private investment in public equity, often for companies needing capital quickly).

## Voting rights and proxy process
@id voting-rights
@r 40
@aka proxy voting; statutory voting; cumulative voting; proxy advisors; shareholder meeting; asset managers stewardship; say on pay; shareholder proposals
@see corporate-governance; equity-types

How shareholders exercise control:

- **Statutory voting**: one vote per share per board seat; the majority elects every director.
- **Cumulative voting**: votes = shares × seats, and can be concentrated on one candidate, which helps minority holders get board representation.
- **Proxy voting**: voting by delegating to someone else; most votes are cast this way.

Roles: **management** proposes items and runs the meeting; the **board** recommends votes; **proxy advisors** research and recommend votes for institutions; **asset managers** vote for their clients (stewardship); **asset owners** set voting policies or vote directly. Jurisdictions differ in investor protections, ownership concentration and the rights of different share classes.

## Primary and secondary equity markets; IPOs
@id ipo
@r 41
@aka initial public offering; IPO; seasoned offering; secondary offering; underwriting; book building; rights offering; private placement; shelf registration; primary market; secondary market
@see public-vs-private-companies; trading-venues

The **primary market** is where issuers sell new securities and receive the money: **IPOs**, **seasoned (follow-on) offerings**, **rights offerings** (existing shareholders get the right to buy new shares at a discount), private placements and shelf registrations. Investment banks usually **underwrite** offerings, often through **book building**. IPOs tend to be underpriced on average.

The **secondary market** is where investors trade existing securities with each other. It provides liquidity and price discovery, which makes primary issuance possible.

## Trading venues: exchange, off-exchange, OTC
@id trading-venues
@r 41
@aka stock exchange; dark pools; alternative trading system; ATS; MTF; OTC trading; quote driven; order driven; brokered market; market maker; limit order book
@see equity-liquidity

- **Exchanges**: regulated, transparent order books, listing standards.
- **Off-exchange venues**: alternative trading systems / multilateral trading facilities, including **dark pools** that don't show orders before execution (useful for large institutional trades, but less transparent).
- **OTC (dealer) markets**: trades negotiated with dealers who quote bid and ask prices.

Market structures: **quote-driven** (dealers provide prices), **order-driven** (orders matched by rules, usually price then time priority), and **brokered** (brokers find counterparties for illiquid assets).

## Equity liquidity measures, float and ADV
@id equity-liquidity
@r 41
@aka liquidity; bid ask spread; market depth; float; free float; average daily volume; ADV; market impact; turnover
@see trading-venues

How easily a security can be traded without moving the price:

- **Bid–ask spread**: the round-trip cost; narrower = more liquid.
- **Depth**: size available at the best prices.
- **Float**: shares available to public investors = shares outstanding − shares held by insiders, governments and strategic holders.
- **Average daily volume (ADV)**: average shares traded per day; position size / ADV gives days to trade.

## Equity indexes
@id equity-indexes
@r 41
@aka stock index; broad market index; sector index; style index; growth vs value index; multi market index; MSCI; S&P 500
@see index-weighting

Types: **broad market** (large share of a market's capitalization), **multi-market** (several countries or regions), **sector** (one industry), and **style** (value vs growth, size). Uses: benchmarks, measuring market return and beta, the basis of index funds and ETFs, and model portfolios. Construction choices (which stocks, how weighted, how often rebalanced) shape their risk; see [[index-weighting]].

## Dividends, buybacks and splits
@id dividends-buybacks
@r 42
@aka cash dividends; stock dividends; special dividends; share repurchase; buyback; stock split; reverse split; dividend policy; dividend payout; return of capital
@see dividend-chronology; total-return-equity

- **Regular cash dividend**: steady payment; cutting it is a negative signal.
- **Special dividend**: one-off payment from excess cash.
- **Stock dividend**: new shares instead of cash; no change in total value.
- **Stock split**: more shares at a proportionally lower price (2-for-1 halves the price); **reverse split** does the opposite, often to lift a low share price. Neither changes value.
- **Share repurchase**: buying back shares (open market, tender offer, Dutch auction, direct negotiation). Flexible, can signal undervaluation, can offset option dilution, and may be tax-efficient.

A buyback at the market price is economically equivalent to a cash dividend of the same amount (ignoring taxes and signalling). Buybacks can raise EPS if the earnings yield exceeds the after-tax cost of the funds used.

## Dividend payment chronology
@id dividend-chronology
@r 42
@aka declaration date; ex dividend date; holder of record date; record date; payment date; ex date; when do I get the dividend
@see dividends-buybacks

1. **Declaration date**: the board announces the dividend.
2. **Ex-dividend date**: the first day the share trades without the dividend; the price usually drops by about the dividend. Buy before this date to receive it.
3. **Holder-of-record date**: shareholders on the register receive the dividend (usually one business day after the ex-date with T+1 settlement).
4. **Payment date**: cash is paid.

## Price return and total return on equities
@id total-return-equity
@r 42
@aka total shareholder return; TSR; price return; dividend yield plus capital gain; equity total return
@see hpr; dividends-buybacks

$$\text{Total return} = \frac{P_1 - P_0 + D}{P_0} = \text{price return} + \text{dividend yield}$$

Over long horizons reinvested dividends are a large share of equity total returns. Index providers publish both price-return and total-return versions.

## Price vs. intrinsic value
@id price-vs-value
@r 43
@aka intrinsic value; fair value; mispricing; overvalued; undervalued; market price; margin of safety
@see valuation-models; book-value-market-cap-ev

**Intrinsic value** is the value of a security given a full understanding of its characteristics, estimated with a model. The **market price** is what it trades at. If the estimate > price, the security looks **undervalued**; if below, **overvalued**. The gap may reflect your error rather than the market's, so consider the confidence in your inputs and why the mispricing should close.

## Book value, market capitalization and enterprise value
@id book-value-market-cap-ev
@r 43, 45
@aka book value of equity; market cap; market value of equity; enterprise value; EV; net debt; price to book
@see ev-multiples; price-vs-value

- **Book value of equity**: assets − liabilities on the balance sheet; historical cost, and misses internally built intangibles.
- **Market capitalization**: share price × shares outstanding; the market's view of equity value.
- **Enterprise value (EV)**: the value of the whole business to all capital providers: market cap + debt + preferred stock + minority interest − cash and short-term investments.

EV is independent of capital structure, so it suits comparisons of firms with different leverage; pair it with pre-interest measures (EBITDA, EBIT, sales).

## Equity valuation model categories
@id valuation-models
@r 43
@aka valuation approaches; how to value a company; which valuation method; present value models; DCF; multiplier models; relative valuation; asset based valuation; absolute valuation
@see ddm; fcfe; fcff; residual-income; method-of-comparables; asset-based-valuation

1. **Present value (absolute) models**: value = PV of expected future benefits. Dividend discount, free cash flow (FCFF, FCFE) and residual income models.
2. **Multiplier (relative) models**: price or EV multiples (P/E, P/B, P/S, EV/EBITDA) compared with peers or a justified value.
3. **Asset-based models**: value of assets − liabilities, adjusted to market values.

| Model | Good for | Weaknesses |
|---|---|---|
| Dividend discount | Stable dividend payers | Non-payers, payout not tied to profit |
| Free cash flow | Most firms, including non-payers | Negative FCF; many forecasts needed |
| Residual income | Non-payers, negative FCF | Accounting quality; clean surplus needed |
| Multiples | Quick comparisons | Whole peer group could be mispriced |
| Asset-based | Holding companies, liquidation, natural resources | Intangibles, going concern value |

## Dividend discount model (DDM)
@id ddm
@r 44
@aka dividend discount model; DDM; one period DDM; multi period DDM; present value of dividends
@see gordon-growth-model; multistage-ddm; cost-of-equity

The value of a share is the present value of all expected future dividends, discounted at the cost of equity.

$$V_0 = \sum_{t=1}^{\infty}\frac{D_t}{(1+r_e)^t}$$

For a finite holding period: \(V_0 = \sum_{t=1}^{n}\frac{D_t}{(1+r_e)^t} + \frac{P_n}{(1+r_e)^n}\). Works best for mature firms whose dividends track their profitability.

## Gordon (constant) growth model
@id gordon-growth-model
@r 44
@aka Gordon growth model; constant growth DDM; GGM; D1 over r minus g; terminal value; justified price; stable growth
@see ddm; perpetuity; sustainable-growth; justified-pe

$$V_0 = \frac{D_1}{r_e - g} = \frac{D_0(1+g)}{r_e - g}$$

Requires \(r_e > g\) and a growth rate sustainable forever (no higher than long-run nominal GDP growth). Value is extremely sensitive to the spread \(r - g\).

> **Example** D₀ = 2.00, g = 4%, r = 9%: V = 2.08 / 0.05 = 41.60. At r = 8%, V = 52.00, a 25% jump from a one-point change.

## Sustainable growth rate
@id sustainable-growth
@r 44
@aka sustainable growth; g equals b times ROE; retention ratio; plowback; payout ratio; internal growth
@see gordon-growth-model; dupont

The growth a company can finance from retained earnings without changing leverage:

$$g = b \times ROE, \qquad b = 1 - \text{payout ratio}$$

Combine with [[dupont]] to see what drives it: margin, turnover, leverage and retention.

## Multistage dividend and cash flow models
@id multistage-ddm
@r 44
@aka two stage DDM; three stage model; H model; supernormal growth; high growth then stable growth; terminal value calculation; multistage DCF
@see gordon-growth-model; fcfe

For companies whose growth will change: forecast dividends (or FCF) individually during the high-growth period, compute a **terminal value** with the Gordon model when growth becomes stable, and discount everything back.

$$V_0 = \sum_{t=1}^{n}\frac{D_t}{(1+r)^t} + \frac{1}{(1+r)^n}\cdot\frac{D_{n+1}}{r-g_L}$$

> **Watch out** The terminal value is often 60–80% of the total. Small changes to long-run growth or the discount rate dominate the result. Model shortcomings: growth rarely drops in neat steps, and the stable-growth assumptions may not fit cyclical firms.

## Free cash flow to equity (FCFE) model
@id fcfe
@r 44, 31
@aka FCFE; free cash flow to equity; equity DCF; levered free cash flow
@see free-cash-flow; fcff; cost-of-equity

Value equity directly as the PV of FCFE at the cost of equity.

$$FCFE = NI + \text{non-cash charges} - FCInv - WCInv + \text{net borrowing}$$

$$V_{equity} = \frac{FCFE_1}{r_e - g}$$

Useful for non-dividend payers or companies whose dividends differ from their capacity to pay. Assumes a stable capital structure, since net borrowing is in the cash flow.

## Free cash flow to the firm (FCFF) model
@id fcff
@r 44, 31
@aka FCFF; free cash flow to the firm; unlevered free cash flow; enterprise DCF; firm value
@see free-cash-flow; fcfe; wacc

Value the whole firm as the PV of FCFF at the WACC, then subtract debt (and preferred) to get equity.

$$FCFF = EBIT(1-t) + Dep - FCInv - WCInv = NI + NCC + Int(1-t) - FCInv - WCInv$$

$$V_{firm} = \frac{FCFF_1}{WACC - g}, \qquad V_{equity} = V_{firm} - \text{debt}$$

Preferred to FCFE when leverage is high or changing, or FCFE is negative.

## Residual income model
@id residual-income
@r 44
@aka residual income; economic value added; EVA; abnormal earnings; book value plus PV of residual income; RI model
@see valuation-models; roic

Residual income = net income − equity charge = \((ROE - r_e)\times B_{t-1}\). Value = current book value + PV of future residual income.

$$V_0 = B_0 + \sum_{t=1}^{\infty}\frac{RI_t}{(1+r_e)^t}$$

Value is created only when ROE exceeds the cost of equity. Useful for firms without dividends or with negative free cash flow (e.g. banks); depends on accounting quality.

## Preferred stock valuation
@id preferred-stock-valuation
@r 44
@aka value of preferred stock; preferred dividend perpetuity; callable preferred; putable preferred; convertible preferred valuation
@see perpetuity; equity-types

A non-callable, non-convertible preferred with a fixed dividend and no maturity is a perpetuity:

$$V_0 = \frac{D_p}{r_p}$$

With a maturity, value it like a bond. **Callable** preferred is worth less (the issuer will call when rates fall); **putable** preferred is worth more; **convertible** preferred is worth at least its conversion value.

## Method of comparables vs. forecasted fundamentals
@id method-of-comparables
@r 45
@aka relative valuation; comparables; peer multiples; trading comps; justified multiple; forecasted fundamentals; law of one price equity
@see justified-pe; price-multiples; peer-group

Two ways to use multiples:

- **Method of comparables**: compare a firm's multiple with peers, the industry or its own history. A lower multiple suggests relative undervaluation (assuming similar risk and growth). Quick and market-based, but the whole group could be mispriced.
- **Method of forecasted fundamentals**: compute a **justified multiple** from a DCF model (e.g. the Gordon model), then compare it with the actual multiple.

## Justified P/E from fundamentals
@id justified-pe
@r 45
@aka justified P/E; justified leading P/E; trailing P/E formula; P/E and growth; what P/E should a stock have; justified P/B
@see gordon-growth-model; pe-ratio

Divide the Gordon model by earnings:

$$\frac{P_0}{E_1} = \frac{D_1/E_1}{r - g} = \frac{1-b}{r-g} \qquad \frac{P_0}{E_0} = \frac{(1-b)(1+g)}{r-g}$$

A higher payout, higher growth or lower required return justify a higher P/E (payout and growth trade off, since \(g = b \times ROE\)). Justified P/B = \((ROE - g)/(r - g)\).

## Price multiples (P/E, P/B, P/S, P/CF)
@id price-multiples
@r 45
@aka price to earnings; PE ratio; price to book; PB; price to sales; PS; price to cash flow; earnings yield; trailing vs leading multiples; PEG ratio
@see pe-ratio; ev-multiples; method-of-comparables

| Multiple | Strengths | Weaknesses |
|---|---|---|
| P/E | Earnings drive value; widely used | Negative or volatile EPS; accounting choices |
| P/B | Book value stable, usually positive; good for banks and asset-heavy firms | Ignores intangibles; inflation and history distort book |
| P/S | Sales rarely negative; harder to manipulate | Ignores profitability and costs |
| P/CF | Cash flow harder to manipulate | Definitions vary; ignores capex in simple versions |

**Trailing** multiples use the last 12 months; **leading (forward)** multiples use forecasts. Pick one consistently across peers.

## Price-to-earnings ratio (P/E)
@id pe-ratio
@r 45, 28
@aka P/E; PE ratio; earnings multiple; trailing PE; forward PE; earnings yield; normalized earnings; underlying earnings; PEG
@see justified-pe; price-multiples; eps

Share price / EPS: how much investors pay per unit of earnings. Its inverse, the **earnings yield** (E/P), works when earnings are negative or near zero.

- Use **underlying (persistent) earnings**, excluding one-offs.
- For cyclical firms use **normalized** earnings (mid-cycle) to avoid high P/Es at troughs and low ones at peaks.
- **PEG ratio** = P/E ÷ expected growth (in %); a rough adjustment for growth that ignores risk and payout.

## Enterprise value multiples
@id ev-multiples
@r 45
@aka EV to EBITDA; EV/EBITDA; EV/EBIT; EV to sales; enterprise multiple; capital structure neutral multiple
@see book-value-market-cap-ev; ebitda; price-multiples

EV divided by a measure that belongs to all capital providers: **EV/EBITDA** (most common), EV/EBIT, EV/sales, EV/FCFF. They are useful for comparing firms with different leverage or tax regimes and for capital-intensive firms; EBITDA is usually positive when earnings are not. EBITDA ignores capex needs and working capital, so EV/EBITDA can flatter capital-intensive businesses.

## EBITDA
@id ebitda
@r 45, 36, 66
@aka earnings before interest taxes depreciation and amortization; EBITDA; operating cash flow proxy; adjusted EBITDA; EBITDA margin
@see ev-multiples; non-gaap; credit-ratios

EBIT plus depreciation and amortization: a rough measure of operating cash generation before capital structure, taxes and non-cash charges. Widely used in leverage tests (debt/EBITDA) and EV multiples. It ignores the cost of replacing assets (capex), working capital needs and taxes, so it is not cash flow.

## Peer group selection
@id peer-group
@r 45, 47
@aka comparable companies; peer group; comparable selection; industry classification peers; drivers of return
@see method-of-comparables; industry-classification

Comparable companies should share the same **drivers of value**: business model, growth, risk, profitability and capital intensity. Start with an industry classification, then refine by size, geography, business mix, and growth and margin profiles. Too few peers gives noisy medians; too many includes unlike companies. Use the median (not the mean) to limit outliers.

## Asset-based valuation
@id asset-based-valuation
@r 43
@aka net asset value; NAV; liquidation value; replacement cost; sum of the parts; asset based approach
@see valuation-models

Value equity as the market value of assets minus liabilities. Suits companies with mostly tangible or financial assets (holding companies, resource firms, real estate, firms being liquidated). It struggles with intangible-heavy or high-growth firms, where much value lies in future opportunities.

## Financial statement forecasting in equity valuation
@id financial-statement-forecasting
@r 46
@aka forecast model; valuation model construction; revenue drivers; scenario analysis; sensitivity analysis; model output to value
@see pro-forma-model; fcff; fcfe

A forecast model projects the three statements, then turns them into free cash flows or earnings that feed a DCF or multiple. Match the model to the company: segment revenue drivers for a conglomerate, capacity and pricing for a commodity producer, users and monetization for a platform. Check consistency (capex supports the growth, working capital fits the revenue), run **sensitivity** and **scenario** analyses on the key assumptions, and reconcile the value with market multiples.

## Industry and competitive analysis process
@id industry-analysis
@r 47
@aka industry analysis; competitive analysis; industry life cycle; market size; industry growth; market share trends; TAM; total addressable market; embryonic growth shakeout mature decline
@see porters-five-forces; pestle; industry-classification; competitive-strategy

Steps: define the industry and its boundaries; assess **size and growth** (market size, total addressable market, history and drivers); look at **profitability** (margins, returns on capital) and **market share trends** (concentration); analyze **structure** ([[porters-five-forces]]) and **external influences** ([[pestle]]); and place the industry in its **life cycle**:

| Stage | Growth | Profits | Competition |
|---|---|---|---|
| Embryonic | Slow, uncertain | Losses | Few firms |
| Growth | Rapid | Rising | Low; new entrants |
| Shakeout | Slowing | Falling | Intense; weak firms exit |
| Mature | Slow, stable | Stable, high for leaders | Consolidated |
| Decline | Negative | Falling | Overcapacity, price competition |

## Industry classification systems
@id industry-classification
@r 47
@aka GICS; ICB; industry classification benchmark; sector classification; cyclical vs defensive; sector grouping; statistical clustering
@see peer-group; industry-analysis

Ways to group companies:

- **Products and services** (commercial systems like GICS, ICB, RBICS): by principal business activity, usually by revenue share.
- **Business-cycle sensitivity**: **cyclical** (autos, materials, discretionary) vs **non-cyclical/defensive** (staples, utilities, health care).
- **Statistical** grouping by return correlation (unstable over time).

Government systems (e.g. NAICS) also exist. Classification is a starting point; firms in the same sector can differ a lot.

## Porter's five forces
@id porters-five-forces
@r 47, 38
@aka five forces; industry structure; threat of new entrants; threat of substitutes; bargaining power of buyers; bargaining power of suppliers; rivalry; pricing power
@see industry-analysis; barriers-to-entry; competitive-strategy

Five forces determine how profitable an industry can be:

1. **Threat of new entrants** (low when [[barriers-to-entry]] are high).
2. **Threat of substitutes**.
3. **Bargaining power of buyers** (high when buyers are concentrated or can switch easily).
4. **Bargaining power of suppliers**.
5. **Rivalry among existing competitors** (high with many similar firms, slow growth, high fixed costs, low switching costs, exit barriers).

Weaker forces mean more pricing power and higher long-run returns.

## PESTLE analysis
@id pestle
@r 47
@aka PESTLE; PEST analysis; political economic social technological legal environmental; macro influences on industry; external factors
@see industry-analysis; porters-five-forces

External influences on an industry: **P**olitical (stability, trade policy, subsidies), **E**conomic (growth, rates, inflation, FX), **S**ocial (demographics, tastes), **T**echnological (disruption, automation), **L**egal (regulation, liability), **E**nvironmental (climate, resources, emissions rules).

## Competitive strategy and positioning
@id competitive-strategy
@r 48
@aka cost leadership; differentiation; focus strategy; competitive advantage; generic strategies; competitive position; moat
@see porters-five-forces; business-models; company-analysis

Porter's generic strategies: **cost leadership** (lowest cost producer, compete on price), **differentiation** (unique product customers pay more for), and **focus** (cost or differentiation in a narrow segment). Being "stuck in the middle" is usually unprofitable. Assess the strategy's sustainability: scale, brand, patents, network effects, switching costs.

## Company analysis: revenue, profitability, capital
@id company-analysis
@r 48
@aka company analysis; revenue drivers; volume and price; pricing power; operating profitability; unit economics; operating leverage; working capital needs; capital intensity; capital allocation history
@see competitive-strategy; operating-leverage; working-capital; roic

Questions to ask:

- **Revenue drivers**: volume × price; customer counts and spending; segment and geographic mix; organic vs acquired growth.
- **Pricing power**: can price rise faster than costs? (Look at gross margin stability through cycles.)
- **Operating profitability**: cost structure (fixed vs variable), [[operating-leverage]], margins vs peers.
- **Working capital**: [[cash-conversion-cycle]] and its trend.
- **Capital investment**: maintenance vs growth capex, capex/depreciation, [[roic]] vs WACC.
- **Capital structure**: leverage and coverage, refinancing needs.

## Operating and financial leverage
@id operating-leverage
@r 48, 25
@aka degree of operating leverage; DOL; degree of financial leverage; DFL; degree of total leverage; DTL; fixed costs; business risk; financial risk; breakeven quantity
@see company-analysis; capital-structure

- **Operating leverage**: fixed operating costs magnify the effect of a sales change on operating income. \(DOL = \%\Delta EBIT / \%\Delta \text{sales}\).
- **Financial leverage**: fixed interest costs magnify the effect of an EBIT change on net income. \(DFL = \%\Delta EPS / \%\Delta EBIT = EBIT/(EBIT - I)\).
- **Total leverage** = DOL × DFL.

Firms with high fixed costs (airlines, software, semiconductors) see profits swing far more than sales.

## Equity research reports
@id research-reports
@r 49
@aka equity research report; sell side; buy side; investment thesis; price target; recommendation; valuation summary; risks to thesis
@see valuation-models

A detailed company report usually covers: the **investment thesis** and recommendation (buy/hold/sell and a target price), business description, industry and competitive position, financial analysis and forecasts, **valuation** (methods and assumptions), **risks** to the thesis, and ESG considerations.

**Sell-side** analysts (at brokers) publish for clients and are judged on influence; their ratings skew positive. **Buy-side** analysts work for asset managers and support the firm's own decisions. Value estimates from the same model differ because of assumptions on revenue growth, margins, investment needs and the discount rate.

## Capital asset pricing model (CAPM)
@id capm
@r 50, 88
@aka CAPM; security market line; SML; expected return; beta; required return; market risk premium; equilibrium model; assumptions of CAPM
@see beta; market-model; capital-allocation-line; apt; cost-of-equity

The expected return of an asset depends only on its systematic risk:

$$E(R_i) = R_f + \beta_i\,[E(R_m) - R_f]$$

Plotting expected return against beta gives the **security market line (SML)**. A stock plotting **above** the SML offers more than its required return: it is undervalued (positive alpha).

Assumptions: risk-averse, utility-maximizing investors; frictionless markets (no taxes or costs, unlimited borrowing at Rf); one period; homogeneous expectations; infinitely divisible, liquid assets; price-taking investors. Uses: cost of equity, project hurdle rates, performance evaluation, security selection. Limits: beta is unstable, the true market portfolio is unobservable, and empirically other factors (size, value, momentum) also explain returns.

## Beta
@id beta
@r 50, 88, 10
@aka beta; systematic risk; market sensitivity; levered beta; asset beta; defensive stock; high beta stock
@see capm; beta-regression; systematic-risk

The sensitivity of an asset's return to the market's:

$$\beta_i = \frac{Cov(R_i,R_m)}{\sigma_m^2} = \rho_{i,m}\frac{\sigma_i}{\sigma_m}$$

β = 1 moves with the market; β > 1 amplifies it; β < 1 dampens it; β of the risk-free asset is 0. The market's beta is 1 and a portfolio's beta is the weighted average of its holdings' betas. Higher leverage raises a company's equity beta.

## Market model
@id market-model
@r 50, 88
@aka market model; single index model; return generating model; alpha; residual return; firm specific return
@see beta-regression; capm; multifactor-models

A return-generating model with one factor, the market:

$$R_i = \alpha_i + \beta_i R_m + e_i$$

It splits return into a part explained by the market and a firm-specific residual. Used to estimate beta, to simplify portfolio calculations (covariances between stocks come only from their betas: \(Cov_{ij} = \beta_i\beta_j\sigma_m^2\)) and to measure abnormal returns in event studies.

## Arbitrage pricing theory and multifactor models
@id apt
@r 50, 88
@aka APT; arbitrage pricing theory; multifactor model; Fama French; three factor model; factor investing; size factor; value factor; momentum; smart beta; macroeconomic factor model
@see capm; market-model; multifactor-models

**APT**: expected return is linear in several factor sensitivities, with no need to identify the market portfolio; it requires only that no arbitrage exists.

$$E(R_i) = R_f + \beta_{i1}\lambda_1 + \beta_{i2}\lambda_2 + \cdots + \beta_{ik}\lambda_k$$

(\(\lambda\) = risk premium per factor). Factors can be **macroeconomic** (GDP surprises, inflation, credit spreads), **fundamental** (size, value, momentum, quality) or **statistical**. The **Fama-French** model adds size (SMB) and value (HML) to the market factor; Carhart adds momentum. Factor models are used for return attribution, risk budgeting and "smart beta" products.

## Multifactor models (uses)
@id multifactor-models
@r 50, 88
@aka factor models; factor exposure; factor tilt; return attribution; risk decomposition
@see apt; market-model

Multifactor models describe a portfolio's exposures to several sources of risk at once. Managers use them to see what really drives returns (is outperformance from stock picking or just a value tilt?), to control unwanted exposures, to build portfolios that tilt to chosen factors, and to hedge macro risks.
