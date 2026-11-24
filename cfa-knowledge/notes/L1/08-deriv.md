# Derivatives
@topic deriv

## What a derivative is
@id derivative-basics
@r 70
@aka derivative; underlying; derivative contract; notional; leverage; forward commitment; contingent claim; what are derivatives
@see forward-commitment-vs-contingent-claim; otc-vs-exchange

A contract whose value comes from an **underlying**: a stock, bond, index, commodity, currency, interest rate, credit or even weather. Key features: a **notional** amount, a **maturity**, an agreed **price or rate**, and terms for settlement (physical delivery or cash). Derivatives need little or no money up front relative to their exposure, so they give **leverage**.

Two families: **forward commitments** (forwards, futures, swaps: both sides must perform) and **contingent claims** (options, credit derivatives: payoff depends on an event or a choice).

## OTC vs. exchange-traded derivatives
@id otc-vs-exchange
@r 70
@aka over the counter derivatives; exchange traded; clearing house; central counterparty; CCP; standardization; counterparty risk; margin; ISDA; central clearing
@see futures; forward-contract

| | Over-the-counter (OTC) | Exchange-traded |
|---|---|---|
| Terms | Customized | Standardized |
| Counterparty risk | Bilateral (reduced by collateral) | Clearing house guarantees |
| Transparency | Lower | Higher |
| Liquidity | Varies | Usually high |
| Examples | Forwards, swaps, many options | Futures, listed options |

Since 2008, regulators have pushed standard OTC swaps into **central clearing** through central counterparties (CCPs) with margin requirements, and into trade reporting.

## Forward contracts
@id forward-contract
@r 71, 74
@aka forward; forward contract; long forward; short forward; forward price; delivery; cash settled forward; NDF; non deliverable forward; payoff of forward
@see forward-pricing; futures; forward-commitment-vs-contingent-claim

An OTC agreement to buy (long) or sell (short) an asset on a future date at a price fixed today. No money changes hands at the start. Payoff at expiry:

$$\text{Long: } S_T - F_0(T) \qquad \text{Short: } F_0(T) - S_T$$

Linear, symmetric payoff: gains on one side equal losses on the other. Each party bears the other's default risk.

## Futures contracts
@id futures
@r 71, 75
@aka futures; futures contract; mark to market; daily settlement; initial margin; maintenance margin; variation margin; margin call; clearing house; price limits; futures vs forwards
@see forward-contract; futures-vs-forward-pricing; otc-vs-exchange

Standardized, exchange-traded forwards. The key difference is **daily settlement (marking to market)**: gains and losses are paid each day through margin accounts.

- **Initial margin**: deposit to open a position.
- **Maintenance margin**: the minimum balance; below it, a **margin call** requires topping back up to the **initial** margin (variation margin).

The clearing house is the counterparty to every trade, so default risk is very low. Most futures are closed out before delivery.

## Swaps
@id swaps
@r 71, 76
@aka interest rate swap; fixed for floating swap; plain vanilla swap; swap rate; pay fixed; receive fixed; currency swap; equity swap; notional principal; swap as series of forwards
@see swap-pricing; forward-contract

An agreement to exchange a series of cash flows. In a **plain vanilla interest rate swap**, one party pays a fixed rate and receives a floating rate (e.g. SOFR) on the same notional; only the net payment is exchanged. Other swaps: **currency swaps** (exchange principal and interest in two currencies), **equity swaps** (equity return for a fixed or floating rate), commodity swaps.

> **At work** A company with floating-rate bank debt can "pay fixed" on a swap to lock in its borrowing cost. Pay-fixed = economically like issuing a fixed bond and buying a floater.

## Options: calls and puts
@id options-basics
@r 71
@aka call option; put option; option premium; strike price; exercise price; European option; American option; option buyer; option writer; long call; short put; option seller
@see option-payoffs; moneyness; option-value-factors

The **buyer** pays a **premium** for the **right** (not obligation) to buy (**call**) or sell (**put**) the underlying at the **strike (exercise) price**. The **writer (seller)** takes the obligation and keeps the premium. **European** options can only be exercised at expiry; **American** options any time before. Options are used to hedge (buying puts on a portfolio), to take leveraged views, and to earn income (writing covered calls).

## Option payoff and profit at expiration
@id option-payoffs
@r 71
@aka payoff diagram; profit diagram; breakeven of a call; breakeven of a put; maximum loss; intrinsic value at expiry; option profit calculation
@see options-basics; moneyness

| Position | Payoff at expiry | Profit | Max gain | Max loss | Breakeven |
|---|---|---|---|---|---|
| Long call | max(0, S − X) | payoff − c₀ | Unlimited | c₀ | X + c₀ |
| Short call | −max(0, S − X) | c₀ − payoff | c₀ | Unlimited | X + c₀ |
| Long put | max(0, X − S) | payoff − p₀ | X − p₀ | p₀ | X − p₀ |
| Short put | −max(0, X − S) | p₀ − payoff | p₀ | X − p₀ | X − p₀ |

> **Example** Buy a call with X = 100 for 5. At S = 112 the payoff is 12 and profit 7. Below 100 the loss is 5.

## Credit derivatives (CDS)
@id credit-derivatives
@r 71
@aka credit default swap; CDS; protection buyer; protection seller; credit event; CDS spread; reference entity; credit protection
@see credit-risk

A **credit default swap**: the **protection buyer** pays a periodic premium (the CDS spread); the **protection seller** pays the loss if the **reference entity** has a **credit event** (bankruptcy, failure to pay, sometimes restructuring). Economically like insurance on a bond, but the buyer doesn't need to own the bond. CDS spreads are a market-based measure of credit risk.

## Forward commitments vs. contingent claims
@id forward-commitment-vs-contingent-claim
@r 71
@aka linear vs non linear payoff; symmetric vs asymmetric payoff; obligation vs right; forward vs option
@see forward-contract; options-basics

| | Forward commitments | Contingent claims |
|---|---|---|
| Instruments | Forwards, futures, swaps | Options, CDS |
| Obligation | Both parties must perform | Buyer has a right; seller an obligation |
| Payoff | Linear, symmetric | Non-linear, asymmetric |
| Upfront payment | Usually none | Premium paid by buyer |

An option can be thought of as a forward with the downside cut off, for which the buyer pays the premium.

## Benefits and risks of derivatives
@id derivative-benefits-risks
@r 72
@aka why use derivatives; hedging; risk transfer; price discovery; lower transaction costs; derivative risks; leverage risk; basis risk; counterparty risk; liquidity risk; systemic risk
@see derivative-uses

**Benefits**: transfer risk to those willing to bear it; price discovery (futures prices reveal expected spot prices); lower transaction costs and faster execution than trading the underlying; operational advantages (easy shorting, leverage); market efficiency.

**Risks**: high implicit **leverage**; complexity and model risk; **basis risk** (hedge and exposure don't move exactly together); **liquidity risk** (margin calls drain cash); **counterparty credit risk**; **systemic risk** (interconnected exposures, as in 2008).

## Uses of derivatives by issuers and investors
@id derivative-uses
@r 72
@aka hedge accounting; cash flow hedge; fair value hedge; net investment hedge; corporate hedging; investor uses of derivatives; replicating exposure; overlay
@see derivative-benefits-risks; swaps

**Issuers (companies)** mainly hedge: interest-rate swaps to convert fixed and floating debt (**fair value hedge** or **cash flow hedge**), FX forwards for foreign sales and costs, commodity futures for inputs, and **net investment hedges** for foreign subsidiaries. Hedge accounting lets gains and losses on the hedge be matched with the hedged item, reducing earnings volatility.

**Investors** hedge too, but also use derivatives to change exposure quickly and cheaply (add equity beta with futures, adjust duration), replicate an index, generate income (covered calls), or take leveraged views.

## Arbitrage and replication
@id arbitrage
@r 73
@aka arbitrage; no arbitrage pricing; replication; replicating portfolio; law of one price; risk free arbitrage; why derivative prices are what they are
@see cash-flow-additivity; cost-of-carry; forward-pricing

**Arbitrage**: a riskless profit with no net investment, possible when two equivalent cash flow streams have different prices. Traders exploiting it push prices back in line, so derivatives are priced on the assumption that no arbitrage exists.

**Replication**: build a portfolio of the underlying and borrowing/lending that produces the same payoff as the derivative. The derivative must cost the same as the replicating portfolio. Example: long asset + short forward = risk-free bond, so the forward price is set by the risk-free rate.

## Spot price, expected price and cost of carry
@id cost-of-carry
@r 73
@aka cost of carry; carry; convenience yield; storage costs; spot vs expected future price; contango; backwardation; carry benefits
@see forward-pricing; arbitrage

A forward price is **not** the market's forecast of the future spot price. It's set by the cost of buying the asset now and holding it ("carry") until delivery:

- **Costs** of carry (raise the forward price): financing at the risk-free rate, storage, insurance.
- **Benefits** (lower it): dividends, coupons, a commodity's **convenience yield** (the value of having it on hand).

The **expected** future spot price also includes a risk premium. When the forward is above spot the market is in **contango**; below spot, **backwardation**.

## Forward pricing and valuation
@id forward-pricing
@r 74
@aka forward price formula; value of a forward contract; forward value during life; mark to market forward; forward price with dividends; forward price with costs
@see cost-of-carry; forward-contract; forward-exchange-rate

Distinguish **price** (the fixed delivery price in the contract) from **value** (what the contract is worth).

$$F_0(T) = S_0(1+r)^T \qquad\text{with carry: } F_0(T) = (S_0 - PV_{benefits} + PV_{costs})(1+r)^T$$

Continuously: \(F_0 = S_0 e^{(r + c - i)T}\).

- At **initiation**, value = 0.
- During its life, value of a long position: \(V_t = S_t - PV(\text{benefits}) + PV(\text{costs}) - \frac{F_0(T)}{(1+r)^{T-t}}\)
- At **expiry**, value = \(S_T - F_0(T)\).

## Forward rate agreements (FRAs) and interest rate forwards
@id fra
@r 74
@aka FRA; forward rate agreement; interest rate forward; locking in a borrowing rate; implied forward rate uses
@see forward-rate; swaps

An **FRA** locks in an interest rate for a future period on a notional amount. At settlement, the payment is the difference between the market reference rate and the FRA rate, times notional and the period, discounted back to the settlement date. The no-arbitrage FRA rate is the implied **forward rate** from the spot curve. Borrowers buy FRAs (long = pay fixed) to protect against rate rises; FRAs are building blocks of swaps.

## Futures vs. forward pricing
@id futures-vs-forward-pricing
@r 75
@aka difference between futures and forward prices; mark to market effect; correlation between rates and underlying; futures convexity bias
@see futures; forward-pricing

Futures and forward prices are equal if interest rates are constant (or uncorrelated with the underlying). Daily settlement makes them differ:

- If the underlying's price is **positively correlated** with interest rates, futures gains are received when rates are high (reinvested at more), so **futures are worth more** than forwards (higher futures price).
- If **negatively correlated** (e.g. bond futures), forwards are preferred and futures prices are lower.

The **value** of a futures position resets to zero each day after settlement.

## Swap pricing and valuation
@id swap-pricing
@r 76
@aka swap rate; swap valuation; value of a swap after initiation; swap as series of forwards; par swap rate; mark to market swap
@see swaps; par-rate; forward-pricing

A swap is like a **portfolio of forward contracts** on the floating rate, all at the same fixed rate. The difference: each forward would have its own price, while a swap uses one fixed rate, so some embedded forwards have positive and some negative value at the start.

- **Swap rate (price)**: the fixed rate that makes the swap's value zero at initiation. Equal to the par rate on the curve.
- **Value** after initiation: for the fixed payer, rises when market swap rates rise. Approximately (new swap rate − original rate) × notional × sum of discount factors for the remaining payments.

## Option exercise value, moneyness and time value
@id moneyness
@r 77
@aka in the money; out of the money; at the money; ITM; OTM; ATM; intrinsic value; exercise value; time value of option; extrinsic value
@see option-value-factors; option-payoffs

- **Exercise (intrinsic) value**: what the option would pay if exercised now: call max(0, S − X), put max(0, X − S).
- **Moneyness**: a call is **in the money** if S > X, **at the money** if S = X, **out of the money** if S < X (reverse for puts).
- **Time value** = option premium − exercise value. It is positive before expiry (the chance of becoming more valuable) and decays to zero at expiry.

## Factors that determine option value
@id option-value-factors
@r 77
@aka option pricing factors; what makes an option expensive; volatility and option value; time to expiration; interest rates and options; dividends and options; strike price effect; greeks intuition
@see moneyness; put-call-parity; binomial-model

| Increase in | Call value | Put value |
|---|---|---|
| Underlying price | ↑ | ↓ |
| Strike price | ↓ | ↑ |
| Volatility | ↑ | ↑ |
| Time to expiry | ↑ | ↑ (usually; deep ITM European puts can be exceptions) |
| Risk-free rate | ↑ | ↓ |
| Dividends / carry benefits | ↓ | ↑ |
| Carrying costs | ↑ | ↓ |

Higher **volatility** always helps the option holder: the downside is capped at the premium while the upside grows.

## Arbitrage pricing of options vs. forwards
@id option-replication-concept
@r 77
@aka option replication; contingent claim pricing; dynamic replication; option pricing vs forward pricing; static vs dynamic hedge
@see arbitrage; binomial-model

Forward commitments can be replicated **statically**: buy the asset, borrow, and hold until expiry. Options can't, because their payoff is non-linear. Replicating an option requires a position in the underlying that changes as the price changes (**dynamic replication**, the idea behind the [[binomial-model]] and Black-Scholes-Merton). The no-arbitrage principle still sets the price: the option must cost what its replicating portfolio costs.

## Put-call parity
@id put-call-parity
@r 78
@aka put call parity; synthetic call; synthetic put; protective put; fiduciary call; covered call; replicate put with call
@see put-call-forward-parity; options-basics

For European options with the same strike and expiry:

$$S_0 + p_0 = c_0 + PV(X)$$

**Protective put** (stock + put) = **fiduciary call** (call + risk-free bond paying X). Rearranging creates synthetic positions, e.g. \(c_0 = S_0 + p_0 - PV(X)\). If the equation doesn't hold, buy the cheap side and sell the expensive side for an arbitrage profit. With dividends, use \(S_0 - PV(D)\) in place of S₀.

> **At work** A covered call (long stock + short call) has the same payoff as a short put plus a bond: \(S_0 - c_0 = PV(X) - p_0\).

## Put-call-forward parity
@id put-call-forward-parity
@r 78
@aka put call forward parity; forward and options; synthetic forward with options; long call short put equals forward
@see put-call-parity; forward-pricing

Replace the stock with a forward on it and a bond paying the forward price:

$$PV(F_0(T)) + p_0 = c_0 + PV(X)$$

So a long call plus a short put (same strike) is a synthetic forward: \(c_0 - p_0 = PV(F_0(T) - X)\).

## One-period binomial option model
@id binomial-model
@r 79
@aka binomial model; binomial tree; up factor; down factor; hedge ratio; delta; risk neutral probability; one period binomial; option pricing model
@see risk-neutral-valuation; option-replication-concept

The price moves up by factor u or down by factor d over one period. Two ways to value a call:

**Replication / hedging**: hold a hedge ratio of shares per option so the position is riskless:

$$h = \frac{c_u - c_d}{S_u - S_d}$$

**Risk-neutral probabilities**:

$$\pi = \frac{(1+r) - d}{u - d} \qquad c_0 = \frac{\pi c_u + (1-\pi)c_d}{1+r}$$

> **Example** S = 50, u = 1.2, d = 0.8, X = 50, r = 5%. Call values: up 10, down 0. π = (1.05 − 0.8) / 0.4 = 0.625. c₀ = 0.625 × 10 / 1.05 = 5.95.

## Risk neutrality in derivatives pricing
@id risk-neutral-valuation
@r 79
@aka risk neutral pricing; risk neutral probability; risk neutral valuation; why we discount at risk free rate; real world vs risk neutral probabilities
@see binomial-model; arbitrage

Because a derivative can be hedged with the underlying, its price doesn't depend on investors' risk preferences or the expected return of the underlying. So we can **pretend investors are risk-neutral**: compute the expected payoff using risk-neutral probabilities and discount at the **risk-free rate**. Risk-neutral probabilities are not forecasts of real-world probabilities; they are the weights that make prices consistent with no arbitrage.
