# Financial Statement Analysis
@topic fsa2

## Intercorporate investments: categories
@id intercorporate-investments
@r 7
@aka intercorporate investments; investment in associates; significant influence; control; subsidiaries; joint ventures; financial assets; 20 percent rule; equity method vs consolidation
@see financial-instruments-accounting; equity-method; business-combinations

Accounting depends on how much influence the investor has:

| Influence | Typical stake | Accounting |
|---|---|---|
| None (financial asset) | < 20% | Fair value through profit or loss or OCI, or amortized cost for debt ([[financial-instruments-accounting]]) |
| Significant influence (associate) | 20–50% | [[equity-method]] |
| Joint control (joint venture) | Shared | Equity method |
| Control (subsidiary) | > 50% | Full consolidation ([[business-combinations]]) |

The percentages are guides; influence is judged by board seats, policy participation, material transactions and exchange of key staff.

## Equity method
@id equity-method
@r 7
@aka equity method; associates accounting; share of profit of associates; one line consolidation; investment in associate carrying value; excess purchase price amortization; upstream downstream sales
@see intercorporate-investments; business-combinations

The investment is recorded at cost, then **increased by the investor's share of the investee's profit** and **reduced by dividends received** (dividends are a return of capital, not income). The income statement shows one line: share of associate's profit.

- Excess of purchase price over book value is allocated to identifiable assets (amortized/depreciated over their lives) and goodwill (not amortized).
- **Unrealized profits** on sales between investor and associate (upstream or downstream) are eliminated in proportion to the ownership stake until sold to outsiders.
- The investment is tested for impairment.

Analyst angle: the associate's debt, revenue and assets stay off the investor's balance sheet, so margins look higher and leverage lower than under consolidation; equity method profits aren't cash.

## Business combinations and consolidation
@id business-combinations
@r 7
@aka acquisition method; consolidation; full goodwill; partial goodwill; non controlling interest; minority interest; purchase price allocation; bargain purchase; consolidated financial statements
@see goodwill; intercorporate-investments; equity-method

When the investor controls the investee, the **acquisition method** consolidates 100% of the subsidiary's assets, liabilities, revenue and expenses at fair value, even if ownership is below 100%. The portion not owned is **non-controlling (minority) interest**, shown in equity.

- **Full goodwill** (required by US GAAP; optional under IFRS): goodwill measured on the whole company; NCI at fair value.
- **Partial goodwill** (IFRS option): goodwill only on the acquirer's share; NCI at its share of identifiable net assets.

Net income and equity are the same as under the equity method (attributable to parent), but consolidated revenue, assets and liabilities are larger, so ROA, margins and leverage ratios differ. Full goodwill gives higher assets and equity than partial goodwill, hence lower ROA and ROE.

## Investments in financial assets (IFRS 9)
@id financial-assets-l2
@r 7
@aka IFRS 9 classification; business model test; contractual cash flow test; SPPI; amortized cost; FVOCI; FVPL; reclassification of financial assets; expected credit losses
@see financial-instruments-accounting; intercorporate-investments

Under IFRS 9, debt instruments are measured at **amortized cost** if held to collect contractual cash flows that are solely payments of principal and interest; at **FVOCI** if held both to collect and to sell; otherwise at **FVPL**. Equity investments are at FVPL, with an irrevocable election for FVOCI (gains never recycled to profit). US GAAP uses held-to-maturity, available-for-sale (debt only) and trading categories; equity investments are at fair value through net income. Impairment of debt assets follows an **expected credit loss** model.

## Types of employee compensation
@id employee-compensation
@r 8
@aka employee compensation; short term benefits; post employment benefits; share based payment; deferred compensation; salary bonuses; long term incentives
@see share-based-compensation; pensions; db-pension-l2

- **Short-term**: salaries, bonuses, paid leave; expensed as earned.
- **Post-employment**: pensions (defined contribution or defined benefit) and other benefits such as retiree healthcare.
- **Share-based**: stock options, restricted stock, performance shares, stock appreciation rights.

Long-term incentives aim to align management with shareholders but add complexity and can encourage short-termism or excessive risk if poorly designed.

## Share-based compensation in models and valuation
@id sbc-modeling
@r 8
@aka stock based compensation forecasting; SBC in valuation; dilution forecast; treasury stock method forecast; is SBC a real expense; SBC add back cash flow
@see share-based-compensation; eps; fcff

Share-based pay is a non-cash expense in the income statement but a real cost to shareholders through **dilution**. In models:

- Forecast SBC expense (often as % of revenue) and the resulting **share count** growth (new grants less buybacks), using the treasury stock method for options.
- Don't simply add SBC back to cash flow and ignore the dilution: either treat it as a cash-like expense, or keep it non-cash and fully reflect future dilution in shares outstanding. Doing neither overstates value per share.

## Defined benefit pensions: deeper analysis
@id db-pension-l2
@r 8
@aka defined benefit obligation; DBO; PBO; funded status; net pension asset; periodic pension cost; service cost; net interest; remeasurements; actuarial assumptions; discount rate pension; expected return on plan assets; pension in valuation
@see pensions; db-vs-dc

**Funded status** = fair value of plan assets − DBO (PBO). The DBO rises with service cost, interest cost and actuarial losses, and falls with benefits paid and actuarial gains.

| Assumption change | Effect on DBO | Effect on cost |
|---|---|---|
| Higher discount rate | Lower | Usually lower |
| Higher salary growth | Higher | Higher |
| Longer life expectancy | Higher | Higher |
| Higher expected return (US GAAP) | No effect | Lower reported cost |

**IFRS**: service cost and net interest in profit; remeasurements in OCI, never recycled. **US GAAP**: service cost, interest cost, expected return on assets and amortization of past items in profit; differences go through OCI and are amortized later.

For analysis and valuation: treat an underfunded deficit as **debt** (after tax) in EV and leverage; move interest cost and expected return out of operating expense into financing; use **total economic pension cost** (change in funded status excluding contributions) to judge the true cost; and compare company contributions with economic cost (excess contributions are like debt repayment).

## Functional, presentation and local currency
@id functional-currency
@r 9
@aka functional currency; presentation currency; reporting currency; local currency; foreign currency translation; foreign operations; currency of primary economic environment
@see current-rate-method; temporal-method; fx-transaction-exposure

- **Local currency**: the currency of the country where an entity is located.
- **Functional currency**: the currency of the primary economic environment in which it generates and spends cash (determined by judgment: sales prices, costs, financing).
- **Presentation (reporting) currency**: the currency of the consolidated statements.

If a foreign subsidiary's functional currency is its local currency, translate with the [[current-rate-method]]. If its functional currency is the parent's, **remeasure** with the [[temporal-method]].

## Foreign currency transaction exposure
@id fx-transaction-exposure
@r 9
@aka transaction exposure; foreign currency transaction gains and losses; receivable in foreign currency; payable in foreign currency; settlement date; balance sheet date
@see functional-currency

When a company buys or sells on credit in a foreign currency, it bears exchange risk until settlement. The transaction is recorded at the spot rate on the transaction date; at each balance sheet date and at settlement, the receivable or payable is re-measured and the **gain or loss goes to profit**.

| Position | Foreign currency strengthens | Foreign currency weakens |
|---|---|---|
| Export sale (receivable) | Gain | Loss |
| Import purchase (payable) | Loss | Gain |

Companies differ in where they show these gains (operating vs non-operating income), which affects operating margin comparisons.

## Current rate method
@id current-rate-method
@r 9
@aka current rate method; translation; cumulative translation adjustment; CTA; OCI translation; average rate for income statement; net asset exposure
@see temporal-method; functional-currency; fx-translation-ratios

Used when the subsidiary's functional currency is its **local** currency.

- **Assets and liabilities**: current (balance sheet date) rate.
- **Equity**: historical rates.
- **Revenues and expenses**: average rate (or rate on the transaction date).
- The translation difference goes to equity as the **cumulative translation adjustment (CTA)** in OCI, not to profit.

Exposure = **net assets**. If the foreign currency appreciates and the subsidiary has positive net assets, the parent records a translation **gain** in CTA. Most original financial ratios of the subsidiary are preserved in translation.

## Temporal method (remeasurement)
@id temporal-method
@r 9
@aka temporal method; remeasurement; monetary assets; nonmonetary assets; historical rate; remeasurement gain loss in income; net monetary exposure
@see current-rate-method; functional-currency; hyperinflation-accounting

Used when the subsidiary's functional currency is the **parent's** currency (e.g. an integrated sales office).

- **Monetary** assets and liabilities (cash, receivables, payables, debt): current rate.
- **Non-monetary** items carried at historical cost (inventory, PP&E): historical rates. Their related expenses (COGS, depreciation) also use historical rates.
- Other revenues and expenses: average rate.
- The remeasurement gain or loss goes **to profit**, so earnings are more volatile.

Exposure = **net monetary assets (or liabilities)**. Most subsidiaries have net monetary liabilities, so an appreciating foreign currency produces a remeasurement **loss**.

## Translation effects on financial ratios
@id fx-translation-ratios
@r 9
@aka effect of exchange rates on ratios; current rate vs temporal method ratios; pure balance sheet ratio; mixed ratios translation
@see current-rate-method; temporal-method

Under the **current rate method**, pure income-statement ratios and pure balance-sheet ratios are unchanged from local currency; **mixed ratios** (e.g. turnover = sales at average rate / assets at current rate) change. Under the **temporal method**, many ratios change because items use different rates.

Direction of reported numbers when the foreign currency **appreciates**: current rate method raises translated sales, assets and net income; temporal method raises sales but net income depends on the remeasurement gain or loss. Analysts should separate organic growth from currency effects.

## Hyperinflationary economies
@id hyperinflation-accounting
@r 9
@aka hyperinflation; IAS 29; restate for inflation; purchasing power gain; 100 percent cumulative inflation; highly inflationary
@see temporal-method; current-rate-method

An economy is hyperinflationary if cumulative inflation over three years approaches or exceeds 100%.

- **US GAAP**: use the **temporal method** (the parent's currency is treated as functional).
- **IFRS**: **restate** the subsidiary's statements for inflation using a price index (non-monetary items and income statement items), then translate everything at the **current** rate. A net monetary asset position produces a purchasing-power loss in profit; a net monetary liability position, a gain.

Results differ, so compare companies' methods carefully.

## Multinational operations: tax rate and sales growth
@id multinational-tax-sales
@r 9
@aka multinational effective tax rate; geographic mix and tax; sales growth decomposition; organic growth; FX impact on sales; constant currency growth; price vs volume growth
@see effective-tax-rate; fx-translation-ratios

The effective tax rate of a multinational depends on the **mix of profits** across countries with different rates, tax treaties and the timing of repatriation. Changes in mix change the rate.

Sales growth can come from **volume, price, acquisitions and currency**. Organic, constant-currency volume growth is the most sustainable. Growth driven by currency moves or price increases in inflationary economies may reverse. Companies often disclose "constant currency" or "organic" growth.

## Financial institutions: how they differ
@id financial-institutions
@r 10
@aka banks analysis; financial institutions differ; systemic importance; Basel III; capital requirements; liquidity coverage ratio; net stable funding ratio; bank regulation; insurance regulation
@see camels; insurance-analysis

Financial institutions differ from other companies: their assets are mostly **financial** (loans, securities) carried at or near fair value; they are highly **leveraged**; failures can trigger **systemic** crises; so they are heavily **regulated**.

Bank regulation (Basel III) sets: minimum **capital** relative to risk-weighted assets (Common Equity Tier 1, Tier 1, total capital, plus buffers), a **leverage ratio**, and liquidity standards: the **liquidity coverage ratio** (high-quality liquid assets vs 30 days of stressed outflows) and the **net stable funding ratio** (available stable funding vs required).

## CAMELS bank analysis
@id camels
@r 10
@aka CAMELS; capital adequacy; asset quality; management; earnings; liquidity; sensitivity to market risk; bank ratios; nonperforming loans; loan loss reserve; net interest margin; CET1 ratio
@see financial-institutions; industry-ratios

A framework for analysing banks:

- **C**apital adequacy: CET1, Tier 1 and total capital ratios vs requirements.
- **A**sset quality: non-performing loans, loan-loss allowances and provisions, concentration, securities valuation (Level 3 fair value).
- **M**anagement: governance, risk management, internal controls.
- **E**arnings: level, quality and sustainability: **net interest margin**, fee income, reliance on trading gains, cost-to-income, provisions.
- **L**iquidity: LCR, NSFR, deposit base stability, reliance on wholesale funding.
- **S**ensitivity to market risk: interest rate gap, FX and equity exposures, VaR.

Also consider: government support, mission (e.g. cooperative), off-balance-sheet items, segment mix and accounting for loan losses.

## Insurance company analysis
@id insurance-analysis
@r 10
@aka insurance analysis; property and casualty insurer; life insurer; combined ratio; loss ratio; expense ratio; underwriting profit; float; investment income insurers; reserves
@see financial-institutions

**Property and casualty** insurers: short-term, volatile claims. Key ratios: **loss ratio** (claims / premiums), **expense ratio**, **combined ratio** = loss + expense ratios (< 100% = underwriting profit), dividends to policyholders, and investment returns on the **float**. Underwriting is cyclical.

**Life and health** insurers: long-term, more predictable liabilities. Focus on product mix, investment returns and asset quality, reserve adequacy, liquidity (surrender risk), and capital adequacy. Both types: watch for reserve releases used to smooth earnings.

## Framework for assessing financial reporting quality
@id reporting-quality-framework
@r 11
@aka evaluating quality of financial reports; reporting quality steps; earnings quality analysis; red flags; aggressive accounting choices; Beneish M score
@see reporting-quality; earnings-manipulation-warning-signs; earnings-quality-indicators

Steps: (1) understand the company, industry and accounting policies; (2) understand management, incentives and governance; (3) identify significant accounting areas, especially those with judgment; (4) compare with peers and over time; (5) check for warning signs (revenue growing faster than receivables collections, inventory build-up, unusual changes in estimates); (6) look at segments and related parties; (7) use quantitative tools.

Quantitative screens: the **Beneish M-score** (a probit model using ratios like days sales in receivables, gross margin, asset quality and accruals; higher = more likely manipulator) and the **Altman Z-score** for bankruptcy risk. Both have limits: based on historical relationships, and manipulators adapt.

## Earnings quality, persistence and accruals
@id earnings-quality-indicators
@r 11
@aka earnings quality; earnings persistence; sustainable earnings; accruals ratio; cash vs accrual earnings; mean reversion in earnings; beating benchmarks; recurring vs nonrecurring
@see reporting-quality; reporting-quality-framework; cash-flow-ratios

High-quality earnings are **sustainable (persistent)** and backed by cash. Persistence: \(E_{t+1} = \alpha + \beta E_t + \varepsilon\); higher β means more persistent.

Earnings = cash flow + **accruals**. The accrual component is less persistent than the cash component, so earnings with high accruals **revert to the mean faster**. Measure with the **accruals ratio**: (net operating assets end − beginning) / average NOA (balance sheet basis), or (NI − CFO − CFI) / average NOA (cash flow basis).

Other indicators: recurring vs one-off items, consistent beating of analyst forecasts by tiny amounts, external indicators of poor quality (restatements, enforcement actions), and earnings that rely on gains or reserve releases.

## Cash flow quality and balance sheet quality
@id cash-flow-bs-quality
@r 11
@aka cash flow quality; manipulating operating cash flow; stretching payables; selling receivables; classification shifting; balance sheet quality; off balance sheet obligations; completeness of liabilities; fair value level 3
@see reporting-quality-framework; cash-flow-statement

**Cash flow quality**: CFO should be positive, derived from sustainable operations and adequate to cover capex, dividends and debt. Warning signs: CFO boosted by stretching payables, selling receivables (factoring), cutting inventory, or **classification shifting** (operating costs pushed into investing, interest received in operating vs investing choices under IFRS).

**Balance sheet quality**: **completeness** (no hidden obligations: purchase commitments, guarantees, unconsolidated entities), **unbiased measurement** (goodwill, Level 3 fair values, pension and reserve assumptions), and **clear presentation**. Large goodwill relative to equity, or rising assets with no matching revenue, deserve scrutiny.

## Sources of information about risk
@id risk-information-sources
@r 11
@aka risk disclosures; notes; MD&A risk factors; auditor's opinion; going concern; financial press; covenant disclosures
@see financial-statements; audit-opinion

Risk information sits in the notes (contingencies, commitments, financial instruments and their fair-value levels), management's discussion (risk factors, critical accounting estimates), the auditor's report (key audit matters, going-concern doubts), filings about auditor changes or late filings, debt covenant disclosures, and the financial press. A sudden auditor resignation or a delayed filing is a strong signal.

## Integrating financial statement analysis
@id fsa-integration
@r 12
@aka integrated financial analysis; extended DuPont; earnings normalization; balance sheet adjustments; segment analysis; cash flow adjustments; comparability adjustments; analyst adjustments
@see fsa-framework; dupont; reporting-quality

Applying the [[fsa-framework]] to a real question (e.g. "is this company's ROE sustainable?" or "is it worth more than its price?"):

- **Decompose returns**: extended DuPont, and separate equity-method income and non-operating items from core operations.
- **Asset base composition**: how much is goodwill, intangibles, financial assets?
- **Segment analysis**: margins, capital and returns by business and region; where is capital being deployed?
- **Accruals and cash conversion**: earnings quality.
- **Adjustments for comparability**: capitalize or expense items consistently, convert LIFO to FIFO, treat pension deficits and leases as debt, normalize one-off items, adjust for different accounting standards.
- Assess how a change in accounting standards would alter key ratios.
