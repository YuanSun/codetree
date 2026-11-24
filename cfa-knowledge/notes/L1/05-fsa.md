# Financial Statement Analysis
@topic fsa

## Financial statement analysis framework
@id fsa-framework
@r 27
@aka steps of financial analysis; analysis framework; purpose context; collect data; process data; analyze interpret; report conclusions; follow up
@see financial-statements; ratio-analysis

A six-step process:

1. **Define the purpose and context** (what question, for whom, by when).
2. **Collect data** (statements, notes, industry and economic data, management discussions).
3. **Process data** (adjust statements, compute ratios, common-size statements, charts).
4. **Analyze and interpret** the processed data.
5. **Develop and communicate conclusions and recommendations.**
6. **Follow up** (update periodically).

## The financial statements and other sources
@id financial-statements
@r 27
@aka balance sheet; income statement; cash flow statement; statement of changes in equity; notes to financial statements; MD&A; management commentary; audit report; auditor opinion; 10-K; 10-Q; annual report; proxy statement
@see fsa-framework; ifrs-vs-gaap; audit-opinion

- **Balance sheet (statement of financial position)**: assets, liabilities and equity at a point in time.
- **Income statement (statement of profit or loss)**: revenues, expenses and profit over a period; **comprehensive income** adds items that bypass profit (e.g. some FX translation and pension remeasurement).
- **Cash flow statement**: cash from operating, investing and financing activities.
- **Statement of changes in equity**: how each equity component changed.
- **Notes**: accounting policies, estimates and detail; essential reading.
- **Management commentary (MD&A)**: results, trends, risks and known uncertainties from management's view.

Other sources: regulatory filings (e.g. 10-K annual, 10-Q quarterly, 8-K events, proxy statements in the US), earnings calls, industry data, economic data, alternative data.

## Audit report and opinions
@id audit-opinion
@r 27, 36
@aka auditor's opinion; unqualified opinion; clean opinion; qualified opinion; adverse opinion; disclaimer of opinion; key audit matters; critical audit matters; internal control
@see financial-statements; reporting-quality

An independent auditor states whether the statements are fairly presented under the reporting framework. It gives **reasonable** assurance, not a guarantee.

| Opinion | Meaning |
|---|---|
| Unqualified (unmodified, "clean") | Fairly presented |
| Qualified | Fairly presented except for a specific issue |
| Adverse | Not fairly presented |
| Disclaimer | Auditor could not form an opinion |

Reports also list **key/critical audit matters** (areas of significant judgment) and may include a going-concern paragraph. In the US, auditors of public companies also opine on internal controls.

## IFRS vs. US GAAP: key differences
@id ifrs-vs-gaap
@r 27, 30, 32, 33, 34
@aka IFRS; US GAAP; IASB; FASB; accounting standards differences; conceptual framework; LIFO not allowed under IFRS; revaluation model; interest paid classification
@see financial-statements

Standard setters: **IASB** (IFRS) and **FASB** (US GAAP); regulators (e.g. SEC) enforce them. Differences that matter most at Level I:

| Item | IFRS | US GAAP |
|---|---|---|
| LIFO inventory | Not allowed | Allowed |
| Inventory write-down reversal | Allowed (up to the original cost) | Not allowed (for LCM inventory) |
| PP&E | Cost or **revaluation** model | Cost only |
| Investment property | Cost or fair value | Cost |
| Development costs | Capitalize when criteria met | Expense (software exceptions) |
| Impairment reversal (non-goodwill) | Allowed | Not allowed for assets held for use |
| Interest paid in cash flow | Operating or financing | Operating |
| Interest/dividends received | Operating or investing | Operating |
| Dividends paid | Operating or financing | Financing |
| Lessee lease expense | Single model (all leases: depreciation + interest) | Finance vs operating lease (operating: single straight-line cost) |

## Revenue recognition
@id revenue-recognition
@r 28
@aka five step model; IFRS 15; ASC 606; performance obligations; transaction price; contract with customer; recognize revenue; percentage of completion; principal vs agent; gross vs net revenue
@see expense-recognition; reporting-quality

Under the converged standard, revenue is recognized when control of goods or services passes to the customer, in five steps:

1. Identify the **contract**.
2. Identify the separate **performance obligations**.
3. Determine the **transaction price** (including variable consideration, only if a reversal is unlikely).
4. **Allocate** the price to the obligations (by standalone selling prices).
5. Recognize revenue when (or as) each obligation is **satisfied** (at a point in time, or over time, e.g. by percentage of completion on long-term contracts).

Related ideas: a **principal** reports gross revenue, an **agent** only its commission (net); contract costs are capitalized and amortized; cash received in advance is a **contract liability** (unearned revenue).

> **Watch out** Aggressive revenue recognition (bill-and-hold, channel stuffing, recognizing too early) is the most common route to manipulated earnings. Compare revenue growth with receivables and cash collections.

## Expense recognition
@id expense-recognition
@r 28
@aka matching principle; accrual accounting; period costs; capitalize vs expense; doubtful accounts; warranty expense; bad debt allowance
@see revenue-recognition; depreciation; capitalization-vs-expensing

Expenses are recognized under the **matching principle**: cost of goods sold in the period the related revenue is recognized; period costs (admin, salaries) when incurred. Estimates involved: **bad debt allowances**, **warranty provisions**, depreciation lives and salvage values, inventory write-downs. Changing these estimates shifts profit between periods; compare them with peers and over time.

## Non-recurring items and accounting changes
@id non-recurring-items
@r 28
@aka discontinued operations; unusual or infrequent items; extraordinary items; restructuring charges; change in accounting policy; change in accounting estimate; prior period restatement; one off items
@see revenue-recognition; reporting-quality

- **Discontinued operations**: a component sold or held for sale that is a separate line of business; reported separately, net of tax, below income from continuing operations.
- **Unusual or infrequent items**: in pre-tax income from continuing operations (e.g. restructuring, gains on asset sales). IFRS and US GAAP no longer allow "extraordinary items".
- **Change in accounting policy**: applied **retrospectively** (prior years restated) for comparability.
- **Change in accounting estimate**: applied **prospectively**.
- **Correction of an error**: prior periods restated; a red flag about controls.

> **At work** Forecasts should usually exclude one-offs, but a company that has "non-recurring" restructuring charges every year has recurring costs.

## Earnings per share (basic and diluted)
@id eps
@r 28
@aka EPS; basic EPS; diluted EPS; weighted average shares; treasury stock method; if converted method; dilutive; antidilutive; convertible bonds dilution; stock options dilution
@see pe-ratio

$$\text{Basic EPS} = \frac{\text{net income} - \text{preferred dividends}}{\text{weighted average common shares}}$$

Weight shares by the time outstanding; stock splits and stock dividends are applied **retroactively** to all periods.

**Diluted EPS** assumes all dilutive securities are converted:

- **Convertible preferred** (if-converted): add back preferred dividends; add the new shares.
- **Convertible bonds** (if-converted): add back after-tax interest; add the new shares.
- **Options and warrants** (treasury stock method): assume exercise and that proceeds buy back shares at the average market price; only the net new shares are added. Only dilutive when the exercise price < average market price.

A security is **antidilutive** if including it would raise EPS; exclude it. Diluted EPS ≤ basic EPS always.

## Common-size statements
@id common-size
@r 28, 29, 31, 37
@aka vertical common size; horizontal common size; percent of sales; percent of total assets; trend analysis
@see ratio-analysis

Express each line as a percentage of a base so companies of different size, or one company over time, can be compared.

- **Vertical** common-size: income statement lines as % of revenue; balance sheet lines as % of total assets; cash flow lines as % of revenue or of total inflows.
- **Horizontal** (trend): each line as a % of its value in a base year.

## Intangible assets
@id intangible-assets
@r 29, 33
@aka intangibles; identifiable intangibles; patents; trademarks; software; research and development; R&D; amortization; indefinite life intangibles; internally generated intangibles
@see goodwill; capitalization-vs-expensing; impairment

Non-physical assets. Accounting depends on how they arose:

- **Purchased** individually: recorded at cost.
- **Acquired in a business combination**: recorded at fair value; anything not identifiable goes to [[goodwill]].
- **Internally developed**: mostly expensed. Research is always expensed. Under IFRS, development costs are capitalized once technical feasibility and other criteria are met; US GAAP expenses most R&D (software developed for sale is capitalized after technological feasibility).

Finite-life intangibles are amortized; indefinite-life ones (some brands, licences) are not amortized but tested for impairment annually.

> **At work** Companies that build intangibles internally (software, pharma, brands) often look more profitable on ROA and have lower book values than ones that acquired the same assets.

## Goodwill
@id goodwill
@r 29, 33
@aka goodwill; acquisition premium; purchase price allocation; goodwill impairment; business combination; bargain purchase
@see intangible-assets; impairment

In an acquisition, goodwill = purchase price − fair value of identifiable net assets acquired. It is **not amortized** under IFRS or US GAAP (US private companies may elect to amortize); it is tested for **impairment** at least annually. A large goodwill impairment means the acquirer overpaid. Analysts often remove goodwill from assets and equity when comparing ratios, and ignore impairment charges in forecasting since they are non-cash and backward-looking.

## Financial instruments: measurement
@id financial-instruments-accounting
@r 29
@aka fair value through profit or loss; FVPL; FVOCI; amortized cost; held to maturity; available for sale; trading securities; marketable securities; unrealized gains; other comprehensive income
@see financial-statements

How investments in securities are measured:

| Category (IFRS / US GAAP) | Balance sheet | Unrealized gains/losses |
|---|---|---|
| Amortized cost / held-to-maturity (debt held to collect cash flows) | Amortized cost | Not recognized |
| FVOCI / available-for-sale (debt) | Fair value | Other comprehensive income |
| FVPL / trading | Fair value | Profit or loss |

Equity securities are generally at fair value through profit or loss (IFRS allows an irrevocable FVOCI election for equities not held for trading). Derivatives are at fair value through profit unless in a hedge relationship.

## Non-current liabilities
@id non-current-liabilities
@r 29, 34
@aka long term debt; bonds payable; amortized cost of debt; effective interest method; deferred taxes; lease liabilities; pension obligations; provisions
@see bond-accounting; leases; pensions; deferred-taxes

Obligations due beyond a year: long-term debt, lease liabilities, pension and other post-employment obligations, deferred tax liabilities and provisions. Bonds are generally carried at **amortized cost** using the effective interest method: interest expense = carrying value × market rate at issue. Fair value disclosures in the notes show what the debt would cost today.

## Bond accounting (premium and discount)
@id bond-accounting
@r 29, 34
@aka bond issued at discount; bond issued at premium; effective interest method; amortization of discount; interest expense vs coupon; debt extinguishment gain loss
@see non-current-liabilities

When a bond is issued, the liability is recorded at the cash received (the PV of payments at the market rate). Interest expense = market rate at issue × carrying value.

- Issued at a **discount** (coupon < market rate): interest expense > coupon; carrying value rises to par.
- Issued at a **premium**: interest expense < coupon; carrying value falls to par.

The cash coupon is an operating outflow under US GAAP; repaying principal is financing. A gain or loss arises when debt is repurchased at a price different from its carrying value.

## Cash flow statement: links to other statements
@id cash-flow-statement
@r 30
@aka statement of cash flows; CFO; operating cash flow; CFI; investing cash flow; CFF; financing cash flow; cash flow classification; noncash investing and financing
@see indirect-method; direct-method; free-cash-flow

The cash flow statement explains the change in cash on the balance sheet:

- **Operating (CFO)**: cash from the business's normal activities (customers, suppliers, employees, taxes, interest under US GAAP).
- **Investing (CFI)**: buying and selling long-term assets and investments.
- **Financing (CFF)**: borrowing and repaying debt, issuing and buying back shares, paying dividends.

Non-cash transactions (converting debt to equity, assets acquired with a lease) are disclosed in the notes, not in the statement. Changes in current assets and liabilities on the balance sheet connect net income to CFO.

## Indirect method (CFO)
@id indirect-method
@r 30
@aka indirect method; reconciling net income to cash flow; add back depreciation; changes in working capital; operating cash flow calculation
@see cash-flow-statement; direct-method

Start with net income and adjust:

1. **Add back non-cash charges** (depreciation, amortization, impairments, deferred tax expense).
2. **Remove non-operating gains/losses** (subtract a gain on an asset sale; add back a loss).
3. **Adjust for working capital**: an increase in an operating current **asset** (receivables, inventory) reduces cash; an increase in an operating current **liability** (payables, accrued expenses) increases cash.

> **Example** NI 100, depreciation 30, receivables up 20, payables up 10, gain on sale 5. CFO = 100 + 30 − 20 + 10 − 5 = 115.

## Direct method (CFO)
@id direct-method
@r 30
@aka direct method; cash collected from customers; cash paid to suppliers; cash paid for operating expenses; converting indirect to direct
@see indirect-method; cash-flow-statement

Shows actual operating cash receipts and payments:

- Cash collected from customers = revenue − increase in receivables (+ increase in unearned revenue).
- Cash paid to suppliers = −COGS − increase in inventory + increase in payables.
- Cash paid to employees, for other expenses, interest and taxes: expense adjusted for the change in the related accrual or prepayment.

It is more informative about where cash comes from, but most companies report the indirect method (IFRS and US GAAP encourage direct; US GAAP then requires an indirect reconciliation too).

## Free cash flow (FCFF and FCFE)
@id free-cash-flow
@r 31, 44
@aka FCFF; FCFE; free cash flow to the firm; free cash flow to equity; FCF; owner earnings; cash available to investors
@see fcff; fcfe; cash-flow-statement

Cash a company generates after the investment needed to sustain and grow the business, available to pay capital providers.

$$FCFF = CFO + Int(1-t) - FCInv$$

$$FCFE = CFO - FCInv + \text{net borrowing}$$

FCFF belongs to all capital providers (discount at WACC); FCFE to shareholders only (discount at the cost of equity). Under IFRS, adjust for where interest paid is classified. See [[fcff]] and [[fcfe]] for valuation use.

## Cash flow ratios
@id cash-flow-ratios
@r 31
@aka cash flow to revenue; cash return on assets; cash to income; debt coverage ratio; interest coverage cash basis; reinvestment ratio; dividend payment ratio; quality of earnings cash
@see free-cash-flow; reporting-quality

**Performance**: CFO/revenue (cash margin), CFO/average assets (cash ROA), CFO/operating income (cash-to-income; low values flag accrual-heavy earnings), CFO per share.

**Coverage**: CFO/total debt (debt coverage), (CFO + interest + taxes)/interest (interest coverage), CFO/cash paid for long-term assets (reinvestment), CFO/dividends paid, CFO/(debt repayment + capex + dividends) (investing and financing).

> **At work** Net income that grows while CFO stagnates is a classic warning sign: profits are piling up as receivables or inventory, not cash.

## Inventory cost flow methods (FIFO, LIFO, weighted average)
@id inventory-methods
@r 32
@aka FIFO; LIFO; weighted average cost; specific identification; inventory valuation; cost of goods sold; COGS; inflation effect on inventory; LIFO reserve; LIFO liquidation
@see lifo-reserve; inventory-writedown

How the cost of goods sold and ending inventory are measured:

- **FIFO**: oldest costs go to COGS; ending inventory is at recent costs.
- **LIFO** (US GAAP only): newest costs go to COGS; ending inventory reflects old costs.
- **Weighted average**: average cost for both.
- **Specific identification**: for unique items.

When **prices are rising** (and inventory quantities stable or growing):

| | LIFO vs FIFO |
|---|---|
| COGS | Higher |
| Gross profit, net income | Lower |
| Taxes paid | Lower (so higher CFO) |
| Ending inventory, working capital | Lower |
| Inventory turnover | Higher |

FIFO gives the more accurate balance sheet; LIFO the more economically relevant COGS. Reverse everything when prices fall.

## LIFO reserve and LIFO liquidation
@id lifo-reserve
@r 32
@aka LIFO reserve; converting LIFO to FIFO; LIFO liquidation; inventory layers; comparing LIFO and FIFO companies
@see inventory-methods

The **LIFO reserve** = FIFO inventory − LIFO inventory, disclosed by LIFO firms. To compare with a FIFO firm:

- FIFO inventory = LIFO inventory + LIFO reserve.
- FIFO COGS = LIFO COGS − increase in the LIFO reserve.
- Equity (retained earnings) rises by reserve × (1 − t); a deferred tax liability of reserve × t is usually assumed.

**LIFO liquidation**: when a LIFO firm sells more than it buys, old cheap cost layers flow into COGS, temporarily inflating profit. It is not sustainable, so remove it when forecasting.

## Inventory write-downs (lower of cost and NRV)
@id inventory-writedown
@r 32
@aka net realisable value; NRV; lower of cost or market; LCM; inventory write down; inventory impairment; obsolete inventory
@see inventory-methods

Inventory is carried at the **lower of cost and net realizable value** (estimated selling price − costs to complete and sell). US GAAP uses this for FIFO and average cost, and "lower of cost or market" for LIFO. A write-down reduces inventory and profit in the period it happens; IFRS allows reversals, US GAAP does not. Repeated write-downs signal weak demand, obsolete products or poor inventory management.

## Capitalization vs. expensing
@id capitalization-vs-expensing
@r 33, 36
@aka capitalize costs; capitalized interest; expensing; capex; effect of capitalizing on ratios; cash flow classification of capitalized costs
@see depreciation; intangible-assets

Capitalizing a cost records it as an asset and spreads it over time via depreciation; expensing hits profit immediately.

| Effect of capitalizing (vs expensing) | |
|---|---|
| Profit in the first year | Higher (later years lower) |
| Earnings volatility | Smoother |
| Total assets, equity | Higher |
| CFO | Higher (the outflow is in CFI) |
| CFI | Lower |
| Leverage ratios | Lower (looks better) |

**Capitalized interest** on self-constructed assets is added to the asset's cost; for coverage ratios analysts often add it back to interest expense.

## Depreciation methods
@id depreciation
@r 33
@aka straight line depreciation; double declining balance; accelerated depreciation; units of production; useful life; salvage value; residual value; component depreciation; average age of assets
@see capitalization-vs-expensing; impairment

Allocating an asset's cost over its useful life:

- **Straight-line**: (cost − salvage) / useful life.
- **Double-declining balance** (accelerated): 2/life × beginning book value (ignore salvage until the floor).
- **Units of production**: per unit used.

Accelerated methods lower early profits. IFRS requires **component** depreciation (significant parts depreciated separately). Longer lives and higher salvage values raise profit, which is why analysts compare them with peers.

Useful ratios: average age = accumulated depreciation / depreciation expense; remaining life = net PP&E / depreciation expense; total life = gross PP&E / depreciation expense.

## Impairment and derecognition of long-lived assets
@id impairment
@r 33
@aka asset impairment; impairment test; recoverable amount; value in use; fair value less costs to sell; write down of PP&E; derecognition; gain on sale of asset; held for sale
@see goodwill; depreciation

An asset is impaired when its carrying value exceeds what can be recovered.

- **IFRS**: impaired if carrying value > **recoverable amount** = max(fair value less costs to sell, value in use). Write down to recoverable amount; reversals allowed (not for goodwill).
- **US GAAP** (held for use): two steps. Impaired if carrying value > undiscounted future cash flows; then write down to fair value. No reversals.

Impairment cuts assets and equity and hits profit, but has no cash effect (deferred taxes aside). On **sale**, the gain or loss = proceeds − carrying value; it is removed in the indirect CFO and the proceeds go to CFI.

## Revaluation model (IFRS)
@id revaluation-model
@r 33
@aka revaluation surplus; fair value of PP&E; IFRS revaluation; investment property fair value model
@see ifrs-vs-gaap; impairment

IFRS lets companies carry PP&E at fair value. An increase goes to equity (**revaluation surplus**) through OCI, except to the extent it reverses an earlier loss recognized in profit; a decrease goes to profit unless it reverses an earlier surplus. **Investment property** (held for rent or appreciation) can use a fair value model, with all changes through profit. US GAAP does not allow upward revaluation.

## Leases (lessee and lessor)
@id leases
@r 34
@aka right of use asset; ROU asset; lease liability; finance lease; operating lease; IFRS 16; ASC 842; lessor accounting; sales type lease; short term lease exemption
@see non-current-liabilities

**Lessee**: nearly all leases (except short-term or low-value under IFRS) put a **right-of-use asset** and a **lease liability** (PV of lease payments) on the balance sheet.

- **IFRS** (single model): depreciation of the asset + interest on the liability; front-loaded total expense. Principal repayment is financing; interest can be operating or financing.
- **US GAAP**: **finance leases** work like IFRS. **Operating leases** show a single straight-line lease cost in operating expense, and all cash paid is in CFO.

**Lessor**: a **finance (sales-type) lease** derecognizes the asset and records a lease receivable (recognizing a selling profit for a sales-type lease); an **operating lease** keeps the asset, depreciates it, and records rental income.

## Pensions and post-employment benefits
@id pensions
@r 34, 89
@aka defined benefit plan; defined contribution plan; DB vs DC; funded status; net pension liability; projected benefit obligation; PBO; service cost; actuarial gains and losses; remeasurement
@see non-current-liabilities

- **Defined contribution (DC)**: the company pays agreed contributions; the employee bears investment risk. Expense = contributions due. Nothing much on the balance sheet.
- **Defined benefit (DB)**: the company promises a future benefit (e.g. based on salary and years of service) and bears the risk. The balance sheet shows the **funded status** = plan assets − benefit obligation (a net liability if underfunded).

DB pension cost components: **service cost** (and past service cost), **net interest** on the net liability/asset, and **remeasurements** (actuarial gains/losses, return on assets vs the discount rate). Under IFRS, remeasurements go to OCI and are not recycled; US GAAP puts actuarial gains/losses through OCI and amortizes them into profit over time. Key assumptions: the discount rate, salary growth and (US GAAP) expected return on assets.

## Share-based compensation
@id share-based-compensation
@r 34
@aka stock options; stock based compensation; SBC; restricted stock; RSU; employee stock options; grant date fair value; vesting period; stock appreciation rights
@see eps; pensions

Pay in shares or options aligns employees with shareholders but costs shareholders through dilution. The fair value at **grant date** (options valued with models like Black-Scholes) is expensed over the **vesting (service) period**. Restricted stock is valued at the share price. Cash-settled awards (stock appreciation rights) are remeasured each period. Expense depends heavily on assumptions (volatility, expected life). Many companies exclude SBC from "adjusted" earnings, but it is a real cost.

## Income taxes: accounting profit vs. taxable income
@id income-tax-basics
@r 35
@aka taxable income; accounting profit; income tax expense; taxes payable; temporary differences; permanent differences; tax base; carrying amount
@see deferred-taxes; effective-tax-rate

- **Accounting profit**: pre-tax income per the financial statements.
- **Taxable income**: income per tax rules.
- **Taxes payable**: what is owed this period on taxable income.
- **Income tax expense** = taxes payable + change in deferred tax liabilities − change in deferred tax assets.

**Temporary differences** (between an item's carrying amount and its **tax base**) reverse over time and create deferred taxes. **Permanent differences** (e.g. tax-exempt income, non-deductible fines) never reverse; they create no deferred tax but make the effective rate differ from the statutory rate.

## Deferred tax assets and liabilities
@id deferred-taxes
@r 35
@aka deferred tax liability; DTL; deferred tax asset; DTA; valuation allowance; accelerated tax depreciation; tax loss carryforward; is deferred tax a real liability
@see income-tax-basics; effective-tax-rate

- **Deferred tax liability (DTL)**: taxes payable later; arises when taxable income < accounting profit now, e.g. **accelerated depreciation** for tax. Asset carrying amount > tax base.
- **Deferred tax asset (DTA)**: taxes paid earlier or future deductions; e.g. warranty provisions, **tax loss carryforwards**, bad debt allowances. Asset carrying amount < tax base (or liability carrying amount > tax base).

DTAs are reduced by a **valuation allowance** (US GAAP) or not recognized (IFRS) if they are unlikely to be used; changes in the allowance can be used to manage earnings. Deferred taxes are revalued when tax rates change. If a DTL is not expected to reverse (a growing company's capex keeps it rising), analysts may treat it as equity rather than debt.

## Effective, statutory and cash tax rates
@id effective-tax-rate
@r 35
@aka effective tax rate; ETR; statutory tax rate; cash tax rate; tax rate reconciliation; tax rate drivers
@see income-tax-basics; deferred-taxes

- **Statutory rate**: the legal rate in the jurisdiction.
- **Effective tax rate** = income tax expense / pre-tax income.
- **Cash tax rate** = cash taxes paid / pre-tax income.

The reconciliation note explains differences between statutory and effective rates (foreign rates, permanent differences, tax credits, valuation allowance changes). Recurring differences belong in forecasts; one-offs don't.

## Financial reporting quality vs. quality of earnings
@id reporting-quality
@r 36
@aka financial reporting quality; earnings quality; quality spectrum; conservative accounting; aggressive accounting; earnings management; sustainable earnings; high quality earnings
@see earnings-manipulation-warning-signs; non-gaap

Two separate ideas:

- **Reporting quality**: are the statements GAAP-compliant, decision-useful and faithful?
- **Results (earnings) quality**: are the reported earnings sustainable and adequate (earning a return on capital)?

A spectrum from best to worst: GAAP, decision-useful, sustainable and adequate returns → GAAP but low-quality earnings → GAAP but biased choices → GAAP but managed earnings ("earnings management") → departures from GAAP → fictitious transactions (fraud).

**Conservative** choices understate current profit and assets; **aggressive** ones overstate them. Both are biased: "cookie jar" reserves built in good years can be released later to smooth earnings.

## Motivations and conditions for low-quality reporting
@id fraud-triangle
@r 36
@aka fraud triangle; motivation opportunity rationalization; incentives to manipulate earnings; meeting analyst expectations; covenant pressure; why management manipulates
@see reporting-quality; earnings-manipulation-warning-signs

Motivations: meeting or beating earnings expectations, bonus and option targets, avoiding debt covenant breaches, raising capital on better terms, career concerns.

Conditions conducive to low-quality reporting (the **fraud triangle**): **opportunity** (weak internal controls, board oversight, or wide accounting choice), **motivation/pressure**, and **rationalization** ("everyone does it", "it's only temporary").

Discipline comes from markets, regulators (registration, disclosure, enforcement), auditors, private contracts, and boards; each has limits (auditors rely on sampling; regulators are under-resourced).

## Non-GAAP measures
@id non-gaap
@r 36
@aka adjusted earnings; non-IFRS measures; pro forma earnings; EBITDA; adjusted EBITDA; core earnings; alternative performance measures
@see reporting-quality; ebitda

Measures management defines outside the accounting standards, such as "adjusted EPS" or "adjusted EBITDA", that usually exclude items management considers non-recurring or non-cash. Regulators require a reconciliation to the nearest GAAP measure, equal prominence for GAAP, and an explanation. Use them with care: exclusions tend to remove costs (restructuring every year, stock compensation) and rarely remove gains.

## Earnings manipulation methods and warning signs
@id earnings-manipulation-warning-signs
@r 36
@aka red flags; accounting warning signs; channel stuffing; bill and hold; cookie jar reserves; aggressive capitalization; big bath; accruals; manipulating cash flow; stretching payables
@see reporting-quality; fraud-triangle; cash-flow-ratios

Ways results are managed: recognizing revenue early, under-reserving for bad debts or warranties, extending depreciation lives, capitalizing operating costs, releasing reserves, a "big bath" (dumping losses in one bad year to make later years look better), classifying costs as non-recurring, and managing cash flow (stretching payables, selling receivables, classifying operating outflows as investing).

Warning signs:

- Revenue growing faster than peers or than receivables suggest (rising DSO); large Q4 revenue.
- Inventory growing faster than sales.
- Net income persistently above CFO (high accruals).
- Frequent "one-time" charges, changes in estimates or policies, or auditors.
- Large related-party transactions; aggressive management guidance.
- Depreciation lives or other estimates out of line with peers.

## Ratio analysis: uses and limits
@id ratio-analysis
@r 37
@aka financial ratios; ratio analysis; benchmarks; peer comparison; trend analysis; limitations of ratios; cross sectional analysis
@see activity-ratios; liquidity-ratios; solvency-ratios; profitability-ratios; dupont

Ratios relate figures so firms can be compared over time (**trend**) and against peers (**cross-sectional**). They need context: industry norms, strategy, the economic cycle and accounting choices. Limits: different accounting methods, diversified companies with no clear peers, ratios that conflict, judgment on what's "good", and possible manipulation of reported numbers. Use averages of beginning and ending balance sheet values when pairing with income statement flows.

## Activity ratios
@id activity-ratios
@r 37
@aka efficiency ratios; asset turnover; inventory turnover; receivables turnover; payables turnover; fixed asset turnover; working capital turnover; DSO; days of inventory
@see cash-conversion-cycle; ratio-analysis

How efficiently a company uses its assets:

| Ratio | Formula |
|---|---|
| Inventory turnover | COGS / avg inventory |
| Days of inventory on hand | 365 / inventory turnover |
| Receivables turnover | Revenue / avg receivables |
| Days sales outstanding | 365 / receivables turnover |
| Payables turnover | Purchases / avg payables |
| Days payables | 365 / payables turnover |
| Working capital turnover | Revenue / avg working capital |
| Fixed asset turnover | Revenue / avg net fixed assets |
| Total asset turnover | Revenue / avg total assets |

High inventory turnover can mean efficiency or too little stock (lost sales); compare with sales growth.

## Liquidity ratios
@id liquidity-ratios
@r 37, 23
@aka current ratio; quick ratio; acid test; cash ratio; defensive interval; short term liquidity
@see liquidity; activity-ratios

Ability to meet short-term obligations:

| Ratio | Formula |
|---|---|
| Current ratio | Current assets / current liabilities |
| Quick (acid-test) ratio | (Cash + marketable securities + receivables) / current liabilities |
| Cash ratio | (Cash + marketable securities) / current liabilities |
| Defensive interval | (Cash + securities + receivables) / daily cash expenditures |
| Cash conversion cycle | DIO + DSO − DPO |

Higher ratios mean more liquidity but may also signal idle assets.

## Solvency ratios
@id solvency-ratios
@r 37, 66
@aka leverage ratios; debt to equity; debt to capital; debt to assets; financial leverage ratio; interest coverage; times interest earned; fixed charge coverage; solvency
@see credit-ratios; dupont

Ability to meet long-term obligations:

| Ratio | Formula |
|---|---|
| Debt-to-assets | Total debt / total assets |
| Debt-to-capital | Total debt / (total debt + equity) |
| Debt-to-equity | Total debt / equity |
| Financial leverage | Avg total assets / avg equity |
| Interest coverage | EBIT / interest |
| Fixed charge coverage | (EBIT + lease payments) / (interest + lease payments) |

"Debt" means interest-bearing obligations, including lease liabilities.

## Profitability ratios
@id profitability-ratios
@r 37
@aka gross margin; operating margin; net profit margin; pretax margin; EBITDA margin; return on assets; ROA; return on equity; ROE; return on total capital; return on invested capital
@see dupont; roic

| Ratio | Formula |
|---|---|
| Gross profit margin | Gross profit / revenue |
| Operating margin | Operating income / revenue |
| Pretax margin | EBT / revenue |
| Net profit margin | Net income / revenue |
| ROA | Net income / avg total assets (or EBIT/avg assets as operating ROA) |
| Return on total capital | EBIT / avg (debt + equity) |
| ROE | Net income / avg equity |
| Return on common equity | (NI − pref. dividends) / avg common equity |

## DuPont analysis
@id dupont
@r 37
@aka DuPont; ROE decomposition; three step DuPont; five step DuPont; tax burden; interest burden; EBIT margin; asset turnover; financial leverage; equity multiplier
@see profitability-ratios; solvency-ratios; sustainable-growth

Breaks ROE into its drivers to show **why** it changed.

$$ROE = \underbrace{\frac{NI}{Rev}}_{\text{margin}}\times\underbrace{\frac{Rev}{Assets}}_{\text{turnover}}\times\underbrace{\frac{Assets}{Equity}}_{\text{leverage}}$$

Five-part version:

$$ROE = \frac{NI}{EBT}\times\frac{EBT}{EBIT}\times\frac{EBIT}{Rev}\times\frac{Rev}{Assets}\times\frac{Assets}{Equity}$$

(tax burden × interest burden × EBIT margin × asset turnover × leverage).

> **At work** Two banks with a 12% ROE can be very different: one from margins, one from leverage. DuPont separates operating performance from financial engineering. Buybacks funded by debt raise ROE through leverage alone.

## Industry-specific ratios
@id industry-ratios
@r 37
@aka bank ratios; capital adequacy; Tier 1 capital ratio; same store sales; sales per square foot; revenue per available room; RevPAR; ARPU; loan to deposit; net interest margin; average revenue per user
@see ratio-analysis

Ratios tailored to how an industry makes money:

- **Banks**: capital adequacy (Tier 1 capital / risk-weighted assets), net interest margin, loan-to-deposit, non-performing loans.
- **Retail**: same-store (like-for-like) sales growth, sales per square foot.
- **Hotels**: occupancy, average daily rate, RevPAR.
- **Telecom / internet**: ARPU, churn, subscriber growth.
- **Airlines**: revenue per available seat-mile, load factor.

## Sales-based pro forma model
@id pro-forma-model
@r 38, 46
@aka financial model; forecasting financial statements; three statement model; revenue driven model; forecast horizon; terminal value assumptions
@see forecasting-biases; financial-statement-forecasting

Start with a **revenue forecast** (by segment, from drivers such as volume × price, or market size × share) and project other lines from it:

1. Revenue.
2. COGS and operating expenses (as % of revenue, separating fixed and variable costs).
3. Non-operating items (interest from debt levels and rates; taxes from the effective rate).
4. Balance sheet items (working capital as days or % of revenue; capex and depreciation from PP&E schedules).
5. Cash flow statement and a debt/cash balancing item.

The **explicit forecast horizon** should be long enough for the company to reach a steady state (e.g. after a cycle or a merger integration); beyond it, a terminal value assumes stable growth and margins.

## Analyst forecasting biases
@id forecasting-biases
@r 38
@aka overconfidence in forecasting; illusion of control; conservatism bias; representativeness; confirmation bias; anchoring forecasts; analyst biases remedies
@see behavioral-biases

Behavioural biases that skew analyst forecasts, and remedies:

- **Overconfidence**: too-narrow ranges. Record and check past forecasts; use scenarios.
- **Illusion of control**: too much detail in models. Keep models simple; focus on key drivers.
- **Conservatism**: slow to update for new information. Update deliberately; use Bayesian thinking.
- **Representativeness / base-rate neglect**: judging by similarity. Start from base rates (e.g. how often companies sustain 20% growth).
- **Confirmation bias**: seeking agreeing evidence. Look for disconfirming evidence; talk to people with other views.

## Forecasting with inflation and deflation
@id inflation-forecasting
@r 38
@aka pricing power; passing through cost increases; input cost inflation; revenue inflation; forecasting in inflationary environment
@see pro-forma-model; porters-five-forces

Inflation affects revenue and costs differently, depending on **pricing power** (from industry structure: [[porters-five-forces]]). Forecast volume and price separately; ask whether the company can pass higher input costs to customers (and how fast), and whether demand falls as prices rise. Costs with high inflation sensitivity (energy, wages, commodities) need their own assumptions.
