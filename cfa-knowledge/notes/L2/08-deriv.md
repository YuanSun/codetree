# Derivatives
@topic deriv2

## Carry arbitrage model
@id carry-arbitrage
@r 28
@aka carry arbitrage; cash and carry arbitrage; reverse cash and carry; forward price no arbitrage; cost of carry model; forward price with dividends; forward price with storage costs
@see forward-pricing; cost-of-carry; arbitrage

The forward price is the price at which a **cash-and-carry** (buy the asset, borrow, sell forward) earns exactly the risk-free rate:

$$F_0(T) = S_0(1+r)^T \quad\text{or}\quad F_0(T) = (S_0 - PV(CF) )(1+r)^T = S_0e^{(r - \delta)T}$$

If the market forward is **above** this, do cash-and-carry (buy spot, borrow, sell forward). If **below**, do **reverse** cash-and-carry (short spot, invest the proceeds, buy forward). Underlying cash flows (dividends, coupons) reduce the forward price; storage costs raise it.

## Equity forwards and futures: pricing and value
@id equity-forward-pricing
@r 28
@aka equity forward price; stock index futures price; continuous dividend yield; value of equity forward during life; mark to market equity forward
@see carry-arbitrage; forward-pricing

$$F_0(T) = (S_0 - PVD)(1+r)^T \qquad \text{index: } F_0(T) = S_0e^{(r_c - \delta_c)T}$$

Value to the long at time t:

$$V_t = PV_t[F_t(T) - F_0(T)] = (S_t - PVD_t) - \frac{F_0(T)}{(1+r)^{T-t}}$$

The value is zero at initiation; afterwards it's the PV of the difference between the current and original forward prices.

## Interest rate forwards (FRAs) and futures
@id fra-pricing
@r 28
@aka FRA pricing; forward rate agreement value; FRA settlement; interest rate futures; eurodollar futures; SOFR futures; futures price 100 minus rate; convexity bias
@see fra; carry-arbitrage

An FRA rate is the no-arbitrage forward rate implied by spot rates (MRR curve). E.g. for a 3×9 FRA (6-month rate starting in 3 months):

$$\left(1 + r_9\tfrac{270}{360}\right) = \left(1 + r_3\tfrac{90}{360}\right)\left(1 + FRA\tfrac{180}{360}\right)$$

**Value** of an existing FRA = (new FRA rate for the remaining period − original FRA rate) × period × notional, discounted to today. **Settlement** at the start of the loan period is discounted at the realized MRR. **Interest rate futures** are quoted as 100 − rate; because of daily settlement they differ slightly from FRAs (convexity bias).

## Fixed-income forwards and futures
@id bond-futures
@r 28
@aka bond futures; Treasury futures; conversion factor; cheapest to deliver; CTD; quoted futures price; accrued interest futures; quality option; bond forward price
@see carry-arbitrage; accrued-interest

A bond forward price follows carry arbitrage using the **full** price (with accrued interest) and subtracting the FV of coupons received:

$$F_0(T) = [B_0 + AI_0](1+r)^T - AI_T - FVCI$$

**Bond futures** allow the short to deliver any of several eligible bonds; a **conversion factor** (CF) adjusts each bond's price. Quoted futures price \(QFP = F_0(T)/CF\). The short delivers the **cheapest-to-deliver** bond (the one that maximizes the short's profit), a valuable option that lowers the futures price.

## Interest rate swaps: pricing and valuation
@id irs-pricing
@r 28
@aka swap rate formula; swap pricing discount factors; value of interest rate swap after initiation; pay fixed swap value; swap fixed rate; par swap
@see swap-pricing; swaps

The fixed swap rate makes the PV of fixed payments equal the PV of floating payments (equivalently a par bond):

$$SFR = \frac{1 - PV_n}{\sum_{i=1}^{n} PV_i}$$

(PVᵢ = discount factors for each payment date).

**Value** to the **fixed payer** after initiation:

$$V = (FS_{new} - FS_{old}) \times \sum PV_i \times \text{notional}$$

The fixed payer gains when swap rates **rise**.

## Currency swaps: pricing and valuation
@id currency-swap-pricing
@r 28
@aka currency swap pricing; cross currency swap; exchange of notional principal; currency swap value; fixed for fixed currency swap
@see irs-pricing; forward-exchange-rate

A **currency swap** exchanges interest payments (and usually notional principal at the start and end) in two currencies. Each fixed rate is the swap rate in its own currency: \(r = (1 - PV_n)/\sum PV_i\) using that currency's discount factors. The notional amounts are set at the spot rate at initiation.

**Value** later = PV of one currency's remaining payments (converted at the current spot rate) − PV of the other's. Changes in either interest rate curve or the exchange rate change the value.

## Equity swaps: pricing and valuation
@id equity-swap-pricing
@r 28
@aka equity swap; total return swap equity; equity swap value; pay equity receive fixed; equity swap reset
@see irs-pricing

One party pays the **return on an equity index** (including dividends, if a total return swap) and receives a fixed or floating rate. At initiation the fixed rate equals the ordinary swap rate. After initiation the value to the **equity receiver** = (current value of the equity position since the last reset, i.e. notional × (S_t/S_{reset})) − PV of the fixed leg remaining (including notional). Because the equity leg resets each period, value is driven by equity performance since the last reset.

## Two-period binomial option model
@id binomial-two-period
@r 29
@aka two period binomial model; risk neutral probability; hedge ratio delta; replicating portfolio; option value as expected payoff discounted; up and down factors; American option binomial early exercise
@see binomial-model; risk-neutral-valuation; option-value-factors

Value a European option as the **expected payoff at expiry**, under risk-neutral probabilities, discounted at the risk-free rate:

$$\pi = \frac{1 + r - d}{u - d} \qquad c_0 = \frac{\pi^2 c_{uu} + 2\pi(1-\pi)c_{ud} + (1-\pi)^2c_{dd}}{(1+r)^2}$$

The **hedge ratio** \(h = (c_u - c_d)/(S_u - S_d)\) gives the shares needed per option for a riskless position; it changes each period (dynamic replication). If the market option price differs from the model value, an arbitrage exists: buy the cheap side, sell the replicating portfolio.

**American options**: at each node compare the exercise value with the value of holding (the discounted expected value) and take the larger. Early exercise of American **puts** can be optimal; American calls on non-dividend-paying stocks should not be exercised early.

## Interest rate options in a binomial tree
@id interest-rate-options
@r 29
@aka interest rate call; interest rate put; caplet; floorlet; interest rate cap; interest rate floor; option on interest rates binomial; payer swaption; receiver swaption
@see binomial-rate-tree; capped-floored-floaters; black-model

An **interest rate call** pays when a reference rate exceeds the strike rate (a caplet); an **interest rate put** pays when it falls below (a floorlet). Payoff = notional × max(0, rate − strike) × period (paid in arrears). Value them in a rate tree with expected payoffs discounted along the tree. A **cap** is a series of caplets; a **floor**, a series of floorlets. Long cap + short floor at the same strike = pay-fixed swap.

## Black-Scholes-Merton model: assumptions and components
@id bsm
@r 29
@aka Black Scholes Merton; BSM; Black Scholes formula; N(d1); N(d2); assumptions of BSM; lognormal stock prices; continuous trading; option as leveraged stock position
@see binomial-two-period; option-greeks; black-model

Assumptions: the underlying follows **geometric Brownian motion** (lognormal prices), continuous trading, constant known volatility and risk-free rate, no arbitrage, no transaction costs or taxes, short selling allowed, European exercise.

$$c_0 = S_0e^{-\delta T}N(d_1) - Xe^{-rT}N(d_2) \qquad p_0 = Xe^{-rT}N(-d_2) - S_0e^{-\delta T}N(-d_1)$$

Interpretation: a call = a **leveraged long position** in the stock: buy \(N(d_1)\) shares (the delta) financed by borrowing \(Xe^{-rT}N(d_2)\). \(N(d_2)\) is the risk-neutral probability the call ends in the money. A put = short stock + long bonds. For **currency options**, replace δ with the foreign risk-free rate.

## Black model: options on futures, rates and swaptions
@id black-model
@r 29
@aka Black model; options on futures; Black 76; interest rate options Black model; swaption; payer swaption; receiver swaption; caplet valuation
@see bsm; interest-rate-options

The **Black model** adapts BSM to options on **futures or forwards**: replace \(S_0e^{-\delta T}\) with \(F_0 e^{-rT}\):

$$c = e^{-rT}[F_0N(d_1) - XN(d_2)]$$

Applied to **interest rate options**: use the forward rate as the underlying, the strike rate as X, and multiply by notional × period, discounting from the payment date. **Swaptions**: options to enter a swap. A **payer swaption** (right to pay fixed) gains when swap rates rise; a **receiver swaption** gains when they fall. Value = annuity factor × notional × Black value on the forward swap rate. Payer − receiver (same strike) = forward pay-fixed swap.

## Option Greeks
@id option-greeks
@r 29
@aka Greeks; delta; gamma; vega; theta; rho; option sensitivities; call delta; put delta; time decay
@see bsm; delta-hedging; implied-volatility

| Greek | Sensitivity to | Call | Put |
|---|---|---|---|
| **Delta** | Underlying price | 0 to +1 (= \(e^{-\delta T}N(d_1)\)) | −1 to 0 |
| **Gamma** | Change in delta | Positive (highest at the money near expiry) | Positive |
| **Vega** | Volatility | Positive | Positive |
| **Theta** | Time passing | Usually negative (time decay) | Usually negative |
| **Rho** | Risk-free rate | Positive | Negative |

Approximate option price change ≈ delta × ΔS + ½ × gamma × (ΔS)².

## Delta hedging and gamma risk
@id delta-hedging
@r 29
@aka delta hedge; delta neutral; dynamic hedging; rebalancing hedge; gamma risk; gamma hedging; number of options to hedge
@see option-greeks

A **delta-neutral** position offsets the delta of options with shares (or vice versa): number of options to hedge a stock position = −(portfolio delta / option delta). Because delta changes as the price moves (gamma), the hedge must be **rebalanced**; with large moves or jumps the hedge is imperfect. That leftover exposure is **gamma risk**: short-option positions have negative gamma and lose on big moves in either direction. Gamma can be reduced only with other options, not with the underlying.

## Implied volatility
@id implied-volatility
@r 29
@aka implied volatility; IV; volatility smile; volatility skew; volatility surface; VIX; trading volatility; historical volatility
@see option-greeks; bsm

The volatility that, plugged into an option model, makes the model price equal the market price. It's the market's forecast of future volatility (plus a risk premium). Traders quote options in implied volatility rather than price; compare across strikes and maturities (the **volatility smile/skew** and **surface**); and trade volatility itself, e.g. buying options when implied volatility looks low relative to expected realized volatility. Indexes like the VIX track implied volatility on equity indexes.
