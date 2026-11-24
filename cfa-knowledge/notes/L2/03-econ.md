# Economics
@topic econ2

## Bid-offer spreads in FX
@id fx-bid-offer
@r 5
@aka bid ask spread currency; bid offer; dealer quote; FX spread; interbank market; what affects FX spreads
@see fx-market; triangular-arbitrage

A dealer **bids** (buys the base currency) at the lower price and **offers** (sells it) at the higher price. To convert, you sell at the bid and buy at the offer. Spreads are wider for less liquid currency pairs, larger trades, outside the main trading hours, in volatile markets, for longer forward maturities, and for clients with weaker relationships or credit.

## Triangular arbitrage with bid-offer quotes
@id triangular-arbitrage
@r 5
@aka triangular arbitrage; cross rate bid offer; currency arbitrage; three currencies arbitrage
@see cross-rate; fx-bid-offer

Compute the implied cross rate's bid and offer from two quotes against a third currency (multiply bids by bids and offers by offers, after arranging so the common currency cancels; take reciprocals and swap bid/offer when a quote must be inverted). If a dealer's direct cross quote lies **outside** the implied bid-offer range (its bid is above the implied offer, or its offer below the implied bid), a riskless profit exists: buy the currency where it's cheap and sell where it's dear, going around the triangle.

## Forward premium/discount and mark-to-market of FX forwards
@id fx-forward-valuation
@r 5
@aka forward premium; forward discount; forward points; mark to market forward contract; value of FX forward; closing out a forward
@see forward-exchange-rate; covered-interest-parity

Forward premium (discount) = F − S, quoted in points. A positive value means the base currency trades at a **premium** forward.

**Mark-to-market value** of an existing forward: offset it with a new forward for the same settlement date, then discount the locked-in difference at the price currency's interest rate for the remaining time:

$$V_t = \frac{(F_t - F_0)\times\text{notional}}{1 + i_{price}\,(\tfrac{days}{360})}$$

(for a long base-currency position; use the bid or offer side the offsetting trade would actually hit).

## Covered and uncovered interest rate parity
@id covered-interest-parity
@r 5
@aka covered interest rate parity; uncovered interest rate parity; UIP; CIP; interest rate differential; expected currency change; forward rate as predictor
@see forward-exchange-rate; international-parity-conditions; carry-trade

- **Covered interest parity** (an arbitrage condition, holds closely): the forward premium equals the interest-rate differential. \(F_{f/d} = S_{f/d}\frac{1+i_f}{1+i_d}\).
- **Uncovered interest parity** (an expectation, often fails in the short run): the **expected** change in the spot rate equals the interest differential: \(\%\Delta S^e_{f/d} \approx i_f - i_d\). The high-yield currency is expected to depreciate by exactly the yield advantage, so unhedged returns are equal.

If UIP held, the forward rate would be an unbiased forecast of the future spot rate. In practice high-yield currencies often don't depreciate as much as UIP says, which is why the [[carry-trade]] earns money on average.

## International parity conditions
@id international-parity-conditions
@r 5
@aka purchasing power parity; PPP; relative PPP; absolute PPP; international Fisher effect; real interest rate parity; forward rate parity; parity relationships
@see covered-interest-parity; real-exchange-rate; fx-forecasting

- **Absolute PPP**: identical goods cost the same everywhere after conversion; the exchange rate equals the ratio of price levels.
- **Relative PPP**: the exchange rate changes by the inflation differential: \(\%\Delta S_{f/d} \approx \pi_f - \pi_d\). Holds better over long horizons.
- **Ex ante PPP**: expected exchange-rate change = expected inflation differential.
- **International Fisher effect**: nominal rate differential = expected inflation differential (real rates are equal across countries).
- **Forward rate parity**: the forward rate is an unbiased predictor of the future spot rate (requires CIP and UIP).

If all hold, the forward premium, the interest differential, the expected inflation differential and the expected change in the spot rate are all equal, and real exchange rates stay constant.

## Forecasting exchange rates
@id fx-forecasting
@r 5
@aka exchange rate forecast; long run fair value of currency; PPP fair value; real exchange rate equilibrium; balance of payments approach; current account and currencies; Mundell Fleming
@see international-parity-conditions; balance-of-payments-fx; carry-trade

No single method works well short term. Tools:

- **Current spot** (random walk) is a hard benchmark to beat in the short run.
- **Forward rate** and **UIP**: biased predictors in the short run.
- **PPP**: a guide to **long-run** fair value; deviations can last years.
- **Real interest differentials**: a currency with higher real rates tends to have a stronger real value.
- **Current account and capital flows**, risk premiums and fiscal sustainability: persistent current account deficits and rising debt tend to weaken a currency over time.

## Carry trade
@id carry-trade
@r 5
@aka carry trade; borrow low yield currency; invest high yield currency; forward rate bias; crash risk; negative skew currency
@see covered-interest-parity

Borrow in a low-interest currency and invest in a high-interest currency, unhedged. It profits if the high-yield currency does **not** depreciate by the full interest differential (i.e. if UIP fails, as it often does). Profit ≈ interest differential − depreciation of the investment currency.

Returns are **negatively skewed**: steady gains punctuated by sharp losses when risk aversion rises and investors unwind positions all at once ("going up by the stairs, down by the elevator").

## Balance of payments flows and exchange rates
@id balance-of-payments-fx
@r 5
@aka balance of payments; current account deficit currency; capital account flows; portfolio flows; hot money; flow supply demand currency; stock vs flow approach
@see exchange-rate-trade; fx-forecasting

A **current account deficit** must be financed by capital inflows. Over time, persistent deficits tend to weaken the currency (via the flow supply of currency, and through investors' unwillingness to keep accumulating claims, especially with rising foreign debt). **Capital flows** move faster and are larger than trade flows; they dominate short-term exchange rates. Sudden reversals of capital inflows (often after a boom) can trigger sharp depreciations, especially in emerging markets.

## Monetary and fiscal policy effects on exchange rates
@id policy-fx
@r 5
@aka Mundell Fleming model; monetary approach to exchange rates; Dornbusch overshooting; portfolio balance approach; fiscal policy and currency; tight monetary loose fiscal
@see monetary-policy; fiscal-policy; balance-of-payments-fx

- **Mundell-Fleming** (short run, high capital mobility): tight monetary policy → higher rates → **appreciation**; expansionary fiscal policy → higher rates → **appreciation**. Tight money + loose fiscal = strong currency; loose money + tight fiscal = weak currency. With low capital mobility, fiscal expansion worsens the trade balance and weakens the currency.
- **Monetary approach** (long run): faster money growth → higher inflation → depreciation (consistent with PPP). **Dornbusch overshooting**: because prices adjust slowly, the exchange rate initially overshoots its long-run level.
- **Portfolio balance** (long run): persistent fiscal deficits mean investors must hold more government debt; they eventually demand a cheaper currency or higher return, so the currency weakens.

## Central bank intervention and capital controls
@id fx-intervention
@r 5
@aka currency intervention; capital controls; sterilized intervention; foreign exchange reserves; defending a currency; why governments intervene
@see capital-restrictions; currency-crisis

Objectives: prevent excessive appreciation (to protect exporters) or disorderly depreciation, reduce volatility, and limit "hot money" flows. Intervention is generally **ineffective** in large developed markets (FX turnover dwarfs reserves) but can work in emerging markets with ample reserves, especially combined with capital controls. Capital controls are now accepted as a legitimate tool to manage surges in inflows, though they can deter investment.

## Warning signs of a currency crisis
@id currency-crisis
@r 5
@aka currency crisis; currency collapse; early warning signs; emerging market crisis; sudden stop; devaluation risk
@see fx-intervention; balance-of-payments-fx

Common precursors:

- Capital market liberalization followed by large capital inflows (often short-term).
- Real exchange rate **overvalued** relative to its mean.
- Falling **foreign exchange reserves**.
- Weak terms of trade; current account deficits.
- Rapid **money and credit growth**; asset price bubbles, especially housing.
- High inflation relative to trading partners; a fixed or managed exchange rate.
- Banking crises, which often happen together with currency crises.

## Factors favouring and limiting economic growth
@id growth-factors
@r 6
@aka economic growth drivers; developed vs developing growth; savings and investment; financial markets and growth; political stability; property rights; education; trade openness; tax and regulation
@see growth-accounting; growth-theories

Potential growth depends on: **savings and investment** (capital accumulation), **financial markets** that channel savings efficiently, **political stability, rule of law and property rights**, **education and health** (human capital), sensible **tax and regulatory** systems, **free trade and capital flows** (access to markets, technology and capital), and **technology**. Developing countries often lack several of these, which can hold them back, but also have more room to catch up.

## Potential GDP and why it matters to investors
@id potential-gdp
@r 6
@aka potential GDP; potential growth; long run growth rate; output gap; stock market and GDP growth; earnings growth and GDP
@see growth-accounting; business-cycle

**Potential GDP** is the output an economy can produce with full use of its resources without accelerating inflation. Its growth rate sets the long-run ceiling for aggregate corporate earnings growth.

- **Equity**: over long periods, stock market value can't outgrow GDP indefinitely: \(\%\Delta P = \%\Delta GDP + \%\Delta(E/GDP) + \%\Delta(P/E)\), and the last two can't trend forever.
- **Fixed income**: higher potential growth usually means higher real interest rates; a positive output gap signals inflation pressure and tighter policy; growth affects government credit quality.

## Growth accounting and labour productivity
@id growth-accounting
@r 6
@aka growth accounting; Cobb Douglas production function; total factor productivity; TFP; Solow residual; capital deepening; labor productivity; potential GDP forecast
@see growth-theories; potential-gdp

With a Cobb-Douglas production function \(Y = A K^{\alpha} L^{1-\alpha}\):

$$\frac{\Delta Y}{Y} = \frac{\Delta A}{A} + \alpha\frac{\Delta K}{K} + (1-\alpha)\frac{\Delta L}{L}$$

GDP growth = TFP growth + contribution of capital + contribution of labour (α ≈ capital's share of income). Equivalently, potential growth ≈ labour force growth + labour productivity growth.

- **Capital deepening** (more capital per worker) raises productivity but faces **diminishing returns**, so it can't sustain growth forever.
- **Technological progress** (TFP) shifts the whole production function up and is the only source of permanent per-capita growth.

## Natural resources, demographics and growth
@id growth-resources-labour
@r 6
@aka natural resources and growth; resource curse; Dutch disease; demographics; labour force participation; immigration; aging population; human capital
@see growth-factors; growth-accounting

- **Natural resources** help but aren't necessary (resource-poor economies have grown fast). The **resource curse**: resource booms can strengthen the currency and hurt other exports (**Dutch disease**), and invite poor governance.
- **Labour input**: population growth, **labour force participation** (e.g. more women working), **immigration**, and average hours worked. Ageing populations slow growth.
- **Human capital** (education, skills, health) and **physical capital** both raise productivity; **public infrastructure** and **R&D** create spillovers.

## Classical, neoclassical and endogenous growth theories
@id growth-theories
@r 6
@aka classical growth theory; Malthusian; neoclassical growth theory; Solow model; steady state growth; endogenous growth theory; increasing returns; knowledge spillovers
@see growth-accounting; convergence

- **Classical (Malthusian)**: growth in per-capita income is temporary; population rises until income falls back to subsistence. Ignores technology.
- **Neoclassical (Solow)**: capital has diminishing returns; in the **steady state** per-capita growth equals the rate of technological progress, which is external to the model. Steady-state growth rate of output = θ/(1 − α) + labour force growth (θ = TFP growth). Higher saving raises the **level** of output, not its long-run growth.
- **Endogenous**: technology and knowledge come from investment in R&D and human capital, which create **spillovers**, so returns to capital need not diminish for the economy as a whole. Saving and investment can raise growth **permanently**; this justifies government support for R&D and education.

## Convergence hypotheses
@id convergence
@r 6
@aka convergence; absolute convergence; conditional convergence; club convergence; catch up growth; poor countries grow faster
@see growth-theories

- **Absolute convergence**: all countries' per-capita incomes converge to the same level (because technology is shared).
- **Conditional convergence**: countries converge only if they share the same savings rate, population growth and production function.
- **Club convergence**: countries in a "club" (with the right institutions) converge; poorer countries can join by reforming. Those outside may fall further behind (non-convergence trap).

Neoclassical theory predicts convergence; endogenous growth theory does not necessarily.

## Removing trade barriers: growth effects
@id trade-openness-growth
@r 6
@aka free trade and growth; trade liberalization effects; openness; capital flows and growth; inward vs outward oriented policies
@see international-trade; growth-factors

Opening to trade and capital flows tends to raise growth: access to bigger markets and economies of scale, more competition, technology transfer, foreign capital to supplement domestic saving, and specialization by comparative advantage. In capital-poor countries capital inflows raise investment and growth; wages rise in sectors with comparative advantage. Some industries and workers lose out in the short run. Outward-oriented (export-led) strategies have generally outperformed inward-oriented (import substitution) ones.
