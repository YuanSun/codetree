# Equity Valuation
@topic equity2

## Intrinsic value, mispricing and definitions of value
@id value-definitions
@r 17
@aka intrinsic value; sources of mispricing; going concern value; liquidation value; fair market value; fair value accounting; investment value; orderly liquidation
@see price-vs-value; valuation-models

**Intrinsic value** is the value an investor with complete understanding would assign. The gap between market price and your estimate = true mispricing + error in your estimate:

$$IV_{analyst} - P = (IV_{actual} - P) + (IV_{analyst} - IV_{actual})$$

Definitions of value:

- **Going concern value**: the company keeps operating. **Liquidation value**: assets sold off (orderly or forced).
- **Fair market value**: the price between willing, informed buyer and seller with no compulsion.
- **Fair value** (accounting): the exit price in an orderly transaction.
- **Investment value**: value to a specific buyer (including that buyer's synergies).

For public company equity, intrinsic going-concern value is usually the relevant definition.

## Applications of equity valuation
@id valuation-applications
@r 17
@aka uses of valuation; stock selection; inferring market expectations; corporate events valuation; fairness opinions; portfolio management valuation; private business appraisal
@see value-definitions; valuation-process

Uses: selecting stocks; **inferring market expectations** (what growth does the price imply? a reverse DCF); evaluating corporate events (M&A, divestitures, spin-offs, buyouts, recapitalizations); **fairness opinions** for deals; evaluating business strategies; communicating with analysts and shareholders; appraising private businesses; and share-based payment valuation.

## Valuation process and choosing a model
@id valuation-process
@r 17
@aka valuation process steps; choosing a valuation model; absolute vs relative valuation; model selection criteria; quality of earnings analysis in valuation
@see valuation-models; industry-analysis; sum-of-the-parts

Steps: (1) understand the business (industry, competitive position, strategy); (2) forecast performance; (3) select the model; (4) convert forecasts to a value; (5) apply the conclusions.

Choose a model that is **consistent with the company's characteristics** (is it a dividend payer? does it have positive FCF? is it asset-heavy?), **appropriate for the quality and availability of data**, and consistent with the purpose and perspective (minority vs control). **Absolute** models (DCF, residual income, asset-based) estimate intrinsic value directly; **relative** models (multiples) compare with peers.

## Sum-of-the-parts and conglomerate discount
@id sum-of-the-parts
@r 17, 16
@aka sum of the parts; SOTP; breakup value; conglomerate discount; holding company discount; segment valuation
@see valuation-process; restructuring-valuation

Value each business segment separately (often with different multiples or DCFs), add them, and subtract net debt and holding-company costs. Conglomerates often trade at a **conglomerate discount** to their SOTP value. Explanations: inefficient internal capital allocation, poor governance or agency problems, **endogenous factors** (companies diversify because their core business is weak), and research measurement errors. A large discount can be a catalyst for spin-offs or activist pressure.

## Dividends vs. FCF vs. residual income as model inputs
@id dcf-input-choice
@r 18
@aka which cash flow to discount; DDM vs FCF vs residual income; when to use DDM; when to use free cash flow model; control perspective
@see ddm; fcfe; residual-income

| Input | Appropriate when | Not appropriate when |
|---|---|---|
| Dividends | Company pays dividends with a policy linked to profitability; minority perspective | No dividends, or payout unrelated to earnings |
| Free cash flow | No or erratic dividends; control perspective; FCF tracks profitability | FCF negative for long periods |
| Residual income | No dividends, negative FCF, transparent accounting; financial firms | Poor accounting quality, many accounting adjustments needed |

A **control** buyer can change the payout, so FCF (cash available to owners) is the natural measure for takeovers.

## Gordon growth model: assumptions and implied growth
@id ggm-l2
@r 18
@aka Gordon growth model assumptions; implied growth rate; implied required return; GGM strengths and limitations; sensitivity of GGM; preferred stock perpetuity
@see gordon-growth-model; pvgo; multistage-ddm-l2

The [[gordon-growth-model]] assumes dividends grow at a constant rate forever, with g < r; it's best for mature, stable payers growing at or below the economy's rate.

Rearranged: implied growth \(g = r - D_1/P_0\); implied required return \(r = D_1/P_0 + g\). Comparing implied with your own estimates says whether the price looks fair.

Limits: very sensitive to r − g; unsuitable for non-payers or companies whose growth will change; the long-run g should not exceed nominal GDP growth.

## Present value of growth opportunities (PVGO)
@id pvgo
@r 18
@aka PVGO; present value of growth opportunities; no growth value; E over r; value of growth; leading PE components; franchise value
@see ggm-l2; justified-pe

Split value into the value of current earnings as a perpetuity (no growth, all earnings paid out) plus the value of future growth investments:

$$V_0 = \frac{E_1}{r} + PVGO \qquad \frac{P_0}{E_1} = \frac{1}{r} + \frac{PVGO}{E_1}$$

Growth adds value only if new investments earn **more than r**. A high PVGO share means the price depends heavily on uncertain future projects (typical of growth stocks).

## Justified P/E from the Gordon model
@id justified-pe-l2
@r 18, 20
@aka justified leading PE; justified trailing PE; PE from fundamentals; payout ratio and PE; growth and PE
@see justified-pe; pvgo; justified-multiples

$$\frac{P_0}{E_1} = \frac{1-b}{r-g} \qquad \frac{P_0}{E_0} = \frac{(1-b)(1+g)}{r-g}$$

A higher justified P/E comes from a higher payout (holding g fixed), higher growth, or a lower required return. Compare the justified P/E with the actual: if the actual is lower, the stock may be undervalued.

## Multistage DDM: two-stage, H-model, three-stage
@id multistage-ddm-l2
@r 18
@aka two stage DDM; H model; three stage DDM; growth phase transition phase maturity phase; declining growth; supernormal growth; spreadsheet modeling
@see multistage-ddm; ggm-l2; terminal-value

Companies pass through **growth**, **transition** and **maturity** phases. Models:

- **Two-stage**: high growth for n years, then stable growth forever.
- **H-model**: growth **declines linearly** from \(g_S\) to \(g_L\) over 2H years:

$$V_0 = \frac{D_0(1+g_L)}{r - g_L} + \frac{D_0\,H\,(g_S - g_L)}{r - g_L}$$

(H = half the length of the declining period.)

- **Three-stage**: high growth, then a transition (often linear decline), then stable growth.
- **Spreadsheet modeling**: forecast each year explicitly with flexible assumptions.

The required return implied by a price can be backed out of any of these (solve for r), e.g. for the H-model: \(r = \frac{D_0}{P_0}[(1+g_L) + H(g_S - g_L)] + g_L\).

## Terminal value approaches
@id terminal-value
@r 18, 19, 20
@aka terminal value; continuing value; exit multiple; Gordon growth terminal value; perpetuity growth terminal value; horizon value
@see multistage-ddm-l2; fcf-multistage; justified-multiples

The value at the end of the explicit forecast, which often dominates total value. Two approaches:

- **Gordon growth (perpetuity)**: \(TV_n = CF_{n+1}/(r - g)\). Consistent with fundamentals; very sensitive to g.
- **Market multiple (exit multiple)**: \(TV_n = \text{justified or peer P/E} \times E_n\) (or EV/EBITDA × EBITDA). Market-based, but brings today's market pricing into an intrinsic model, and the multiple must be consistent with the growth assumed.

Sanity-check one with the other: an exit multiple implies a perpetual growth rate.

## Sustainable growth and DuPont
@id sustainable-growth-l2
@r 18
@aka sustainable growth rate; PRAT model; retention times ROE; profit margin retention asset turnover leverage
@see sustainable-growth; dupont

$$g = b \times ROE = b \times \frac{NI}{Sales}\times\frac{Sales}{Assets}\times\frac{Assets}{Equity}$$

(the "PRAT" model: Profit margin, Retention, Asset turnover, Total leverage). Growth can come from retaining more, operating better (margin, turnover) or using more leverage. It assumes a constant capital structure and no new equity.

## FCFF vs. FCFE: which to use
@id fcff-vs-fcfe
@r 19
@aka FCFF vs FCFE; firm value vs equity value; when to use FCFF; ownership perspective FCFE; leverage changing; FCFE vs dividends
@see fcff; fcfe; fcf-calculation

- **FCFF** (to all capital providers, discounted at WACC; subtract debt for equity) is preferred when leverage is high or changing, or FCFE is negative.
- **FCFE** (to shareholders, discounted at the cost of equity) is simpler when the capital structure is stable.

**FCFE** takes a **control** perspective: it's what could be paid out. Compared with the DDM, FCFE models value what a company **can** pay rather than what it **does** pay, so they suit non-payers and takeover analysis.

## Calculating FCFF and FCFE
@id fcf-calculation
@r 19
@aka FCFF formula; FCFE formula; FCFF from net income; FCFF from CFO; FCFF from EBIT; FCFF from EBITDA; FCFE from FCFF; working capital investment; fixed capital investment
@see free-cash-flow; fcff-vs-fcfe; fcf-forecasting

Starting points:

| From | FCFF = |
|---|---|
| Net income | NI + NCC + Int(1 − t) − FCInv − WCInv |
| CFO | CFO + Int(1 − t) − FCInv |
| EBIT | EBIT(1 − t) + Dep − FCInv − WCInv |
| EBITDA | EBITDA(1 − t) + Dep × t − FCInv − WCInv |

$$FCFE = FCFF - Int(1-t) + \text{net borrowing} = NI + NCC - FCInv - WCInv + \text{net borrowing}$$

Notes: NCC = non-cash charges (depreciation, amortization, impairments; subtract non-cash gains). WCInv excludes cash and short-term debt. FCInv = capex − proceeds from asset sales. Dividends, buybacks and share issues **don't** affect FCFF or FCFE (they're uses of FCFE), though leverage changes affect FCFE through net borrowing and interest. Net income and EBITDA are poor cash flow proxies (EBITDA ignores taxes, capex and working capital).

## Forecasting free cash flow
@id fcf-forecasting
@r 19
@aka forecasting FCFF; forecasting FCFE; sales driven FCF forecast; target debt ratio FCFE; incremental capex and working capital; sensitivity analysis DCF
@see fcf-calculation; pro-forma-model

Two approaches: (1) grow current FCF at a constant rate; (2) forecast the components, usually as functions of **sales**: EBIT margin, net investment in fixed capital (capex − depreciation) and working capital as % of the **sales increase**. With a target debt ratio DR, FCFE ≈ NI − (1 − DR)(FCInv − Dep) − (1 − DR)WCInv.

Use **sensitivity analysis** on the key drivers (growth, margins, required return, terminal growth) to see which assumptions matter.

## Single-stage and multistage FCF models
@id fcf-multistage
@r 19
@aka single stage FCFF; stable growth FCFE; two stage FCF model; three stage FCF model; DCF valuation; overvalued undervalued DCF
@see fcf-forecasting; terminal-value; multistage-ddm-l2

$$V_{firm} = \frac{FCFF_1}{WACC - g} \qquad V_{equity} = \frac{FCFE_1}{r - g}$$

Multistage versions forecast FCF explicitly during high growth, then add a terminal value. Growth can differ for sales, earnings and FCF; in the stable phase, capex should be close to depreciation and the WACC or r may fall as risk declines. Equity value = firm value − market value of debt (and preferred); add non-operating assets such as excess cash. Compare value per share with price.

## Method of comparables vs. forecasted fundamentals (Level II)
@id relative-valuation-l2
@r 20
@aka comparables approach; forecasted fundamentals; justified multiple; relative valuation; benchmark value of multiple; peer median multiple
@see method-of-comparables; justified-multiples; multiples-central-tendency

As at Level I: the **method of comparables** compares a firm's multiple with peers (relative value, law of one price), while **forecasted fundamentals** derive a justified multiple from a DCF model. At Level II the focus is on **adjusting for fundamentals**: a higher P/E is justified by higher expected growth, a higher payout or lower risk, so compare peers with similar fundamentals or adjust (PEG, regression).

## Justified P/E, P/B, P/S and dividend yield
@id justified-multiples
@r 20
@aka justified PB; justified PS; justified price to book; justified price to sales; justified dividend yield; multiples from Gordon growth
@see justified-pe-l2; relative-valuation-l2; residual-income-model-l2

From the Gordon model:

| Multiple | Justified value |
|---|---|
| Leading P/E | \((1-b)/(r-g)\) |
| P/B | \((ROE - g)/(r - g)\) |
| P/S | \(\frac{(E_0/S_0)(1-b)(1+g)}{r-g}\) |
| Dividend yield | \(D_0/P_0 = (r - g)/(1 + g)\) |

So P/B rises with ROE relative to r; P/S rises with profit margin. Justified multiples show what the multiple **should** be, given fundamentals.

## Choosing and calculating price multiples
@id price-multiples-l2
@r 20
@aka P/E rationale and drawbacks; P/B adjustments; P/S advantages; P/CF definitions; cash flow multiples; EBITDA per share; FCFE per share; dividend yield valuation; adjusted book value
@see price-multiples; ev-multiples-l2; normalized-eps

| Multiple | Rationale | Drawbacks |
|---|---|---|
| P/E | Earning power drives value; widely used | Zero/negative EPS; one-offs; accounting choices |
| P/B | Positive, stable; good for financial firms and liquidation analysis | Intangibles missing; accounting differences; inflation |
| P/S | Rarely negative; hard to manipulate; good for start-ups and cyclicals | Ignores margins and costs; revenue recognition games |
| P/CF | Harder to manipulate than EPS | Definitions vary (CF, adjusted CFO, FCFE, EBITDA) |
| Dividend yield | Component of total return; stable | Only one part of return; dividends may be cut |

Adjust book value for goodwill (tangible book), off-balance-sheet items and fair values of assets.

## Underlying and normalized EPS; earnings yield
@id normalized-eps
@r 20
@aka underlying earnings; persistent earnings; normalized EPS; historical average EPS; average ROE method; earnings yield; E/P; cyclical earnings
@see pe-ratio; price-multiples-l2

- **Underlying (core) earnings** remove non-recurring items.
- **Normalized EPS** estimates mid-cycle earnings for cyclical firms:
  - **Historical average EPS** over the last full cycle (ignores changes in size).
  - **Average ROE** × current book value per share (reflects size changes; better).
- **Earnings yield (E/P)**: use when EPS is zero or negative (P/E is meaningless) to rank stocks; higher E/P = cheaper.

## Cross-sectional regression and PEG
@id pe-regression-peg
@r 20
@aka predicted PE regression; cross sectional regression of PE; PEG ratio; PE to growth; limitations of PEG
@see justified-pe-l2; relative-valuation-l2

**Predicted P/E**: regress peers' P/Es on fundamentals (payout, growth, beta) and plug in the company's values; compare with its actual P/E. Limits: relationships are specific to the sample and period, and the fundamentals are often correlated with each other (multicollinearity).

**PEG** = P/E ÷ expected growth (in %): stocks with lower PEGs look cheaper. It assumes a linear relationship between P/E and growth, ignores risk, payout and growth duration.

## Terminal value with multiples; cross-border comparisons; momentum
@id multiples-other-uses
@r 20
@aka terminal value using price multiple; exit multiple; cross border valuation differences; IFRS vs GAAP multiples; momentum indicators; earnings surprise; standardized unexpected earnings; SUE; relative strength
@see terminal-value; relative-valuation-l2

- **Terminal value**: justified or peer multiple × forecast fundamental at the horizon.
- **Cross-border comparisons**: differences in accounting standards, culture, risk, growth and inflation distort multiples; P/E is most affected, cash flow and EV multiples less so.
- **Momentum indicators**: **earnings surprise** (actual − expected EPS), **standardized unexpected earnings** \(SUE = \frac{EPS - E(EPS)}{\sigma(\text{surprise})}\), and **relative strength** (stock vs index or own past performance). Used in screening, assuming trends persist.

## Average multiples for a peer group: mean, harmonic mean, median
@id multiples-central-tendency
@r 20
@aka harmonic mean of multiples; weighted harmonic mean; median peer multiple; arithmetic mean PE; index PE
@see harmonic-mean; relative-valuation-l2

The **arithmetic mean** of peers' P/Es is pulled up by high outliers. The **harmonic mean** \(n / \sum(1/X_i)\) is less affected by large outliers (but more by small ones). The **weighted harmonic mean** (weights = portfolio weights) gives the P/E of a portfolio or index exactly. The **median** is robust to outliers in both directions.

## Enterprise value multiples (Level II)
@id ev-multiples-l2
@r 20
@aka EV to EBITDA; EV/EBITDA; EV to FCFF; EV to sales; EV to invested capital; enterprise value calculation; total invested capital
@see ev-multiples; book-value-market-cap-ev

EV = market value of equity + market value of debt + preferred + minority interest − cash and investments. Pair EV with measures before interest: **EBITDA**, EBIT, FCFF, sales. EV/EBITDA suits comparing firms with different leverage and capital intensity, and loss-making firms (EBITDA usually positive). Drawbacks: EBITDA overstates cash flow when capex is large, and ignores working capital and taxes. **EV / total invested capital** is an alternative to P/B. Definitions of cash flow (CFO, FCFF, EBITDA) each have limits; use one consistently across peers.

## Residual income, EVA and MVA
@id residual-income-l2
@r 21
@aka residual income; economic value added; EVA; market value added; MVA; NOPAT; abnormal earnings; equity charge; capital charge
@see residual-income; residual-income-model-l2; roic

**Residual income** = net income − equity charge = \(NI_t - r_e B_{t-1} = (ROE - r_e)B_{t-1}\).

**Economic value added (EVA)** applies the idea to the whole firm: \(EVA = NOPAT - WACC \times \text{invested capital}\), with accounting adjustments (capitalize R&D, add back deferred taxes, etc.).

**Market value added** = market value of the company − total invested capital. Positive RI, EVA and MVA indicate value creation.

## Residual income model of valuation
@id residual-income-model-l2
@r 21
@aka residual income model; RI model valuation; single stage residual income; multistage residual income; continuing residual income; persistence factor; justified PB residual income; implied growth residual income
@see residual-income-l2; justified-multiples; ri-vs-dcf

$$V_0 = B_0 + \sum_{t=1}^{\infty}\frac{(ROE_t - r)B_{t-1}}{(1+r)^t}$$

**Single-stage (constant growth)**: \(V_0 = B_0 + \frac{(ROE - r)B_0}{r - g}\), which gives justified P/B = 1 + (ROE − r)/(r − g) (equivalent to (ROE − g)/(r − g)). Implied growth from the market P/B can be solved from this.

**Multistage**: forecast RI explicitly, then a **continuing residual income** term assuming RI: (1) persists forever, (2) falls to zero immediately, (3) **declines to zero over time** (the usual assumption: competition erodes excess returns), or (4) reflects mean reversion of ROE to the industry level. A **persistence factor** ω (0 to 1) captures the decay: continuing value = \(RI_T / (1 + r - \omega)\).

## Residual income vs. DDM and FCF; strengths and accounting issues
@id ri-vs-dcf
@r 21
@aka residual income strengths weaknesses; clean surplus relation; dirty surplus; value recognition timing; accounting adjustments for residual income
@see residual-income-model-l2; dcf-input-choice

**Value recognition**: RI models recognize value earlier (book value is already in hand), so they're less sensitive to terminal value than DDM or FCF models.

**Strengths**: suits firms with no dividends or negative FCF, financial institutions, uncertain terminal values; uses readily available accounting data; focuses on economic profitability.

**Weaknesses and accounting issues**: relies on accounting data that may be manipulated; needs the **clean surplus relation** (ending book = beginning book + NI − dividends). Items that bypass income through OCI ("dirty surplus": FX translation, pension remeasurements, some fair value changes) break it, so adjust. Also adjust for off-balance-sheet items, non-recurring items, and aggressive accounting; use consistent book values.

## Private company valuation: features and uses
@id private-company-valuation
@r 22
@aka private company valuation; private vs public company differences; company specific factors; stock specific factors; uses of private valuation; transaction purposes; compliance valuation; litigation valuation
@see private-company-cash-flows; private-company-discount-rate; private-valuation-approaches

How private firms differ: **company-specific** (earlier life cycle, smaller size, less depth of management, owner-manager overlap, lower quality and less disclosure, often tax-driven reporting) and **stock-specific** (lower liquidity, concentrated control, restrictions on sale).

Uses: **transactions** (sale, IPO, financing, share-based pay), **compliance** (financial reporting, tax), and **litigation** (damages, disputes, divorce). The purpose determines the definition of value.

## Normalizing earnings and cash flows of private companies
@id private-company-cash-flows
@r 22
@aka normalized earnings private company; owner compensation adjustment; related party leases; nonrecurring items private; discretionary expenses; strategic buyer vs financial buyer; synergies private valuation
@see private-company-valuation; normalized-eps

Private company statements often need adjustments to show economic earnings:

- **Owner compensation** above or below market.
- **Personal expenses** run through the business.
- **Related-party** transactions (e.g. leasing property from the owner at non-market rent).
- **Non-recurring items** and discretionary spending.
- Separating **non-operating assets** (excess real estate, cash).

Cash flows depend on the buyer: a **strategic buyer** includes synergies; a **financial buyer** values the business on a standalone basis. Forecasts from management may be optimistic.

## Discount rates for private companies
@id private-company-discount-rate
@r 22
@aka private company discount rate; expanded CAPM; build up method; size premium; company specific risk premium; small company premium; cost of debt private; acquirer vs target discount rate
@see cost-of-capital-l2; private-company-valuation

Adjustments relative to public companies:

- **Size premium** (small firms are riskier and less diversified), and often a **company-specific risk premium**.
- Lower access to debt, so a **higher cost of debt** and lower leverage.
- Use the **target's** risk, not the acquirer's cost of capital.
- Projection risk: management forecasts may need a higher discount or adjusted cash flows.

Models: **CAPM** (with peer betas, often unsuitable for very small firms), **expanded CAPM** (CAPM + size premium + company-specific premium), and **build-up** (risk-free rate + ERP + size premium + company-specific premium (+ industry adjustment), without beta).

## Control premium and lack of marketability discount
@id dloc-dlom
@r 22
@aka discount for lack of control; DLOC; control premium; discount for lack of marketability; DLOM; minority discount; combining discounts; protective put DLOM
@see private-company-valuation; private-valuation-approaches

- **Control premium**: extra value of being able to set strategy, payouts and management. **Discount for lack of control (DLOC)** = 1 − 1/(1 + control premium).
- **Discount for lack of marketability (DLOM)**: cost of not being able to sell quickly. Estimated from restricted stock studies, pre-IPO transactions, or the price of a **protective put** option.

Apply multiplicatively: total discount = 1 − (1 − DLOC)(1 − DLOM). Whether to apply them depends on the starting point (e.g. guideline public company multiples are marketable, minority values; control transaction multiples already include control).

## Income, market and asset approaches for private companies
@id private-valuation-approaches
@r 22
@aka free cash flow method private; capitalized cash flow method; excess earnings method; guideline public company method; guideline transactions method; prior transaction method; asset based approach private
@see private-company-valuation; dloc-dlom

**Income approach**:

- **Free cash flow method**: DCF of FCF plus terminal value.
- **Capitalized cash flow method**: single-stage, \(V = FCF_1/(r - g)\); for stable, mature firms.
- **Excess earnings method**: value working capital and fixed assets, then capitalize earnings in excess of the required return on them to value **intangibles**; used for small businesses and intangible valuation.

**Market approach**:

- **Guideline public company method**: public peer multiples, adjusted for risk, size and control.
- **Guideline transactions method**: multiples from acquisitions of whole companies (control included).
- **Prior transaction method**: past transactions in the subject company's own shares.

**Asset-based approach**: value of assets minus liabilities; rarely used for going concerns, except for holding companies, resource firms or start-ups with little operating history.
