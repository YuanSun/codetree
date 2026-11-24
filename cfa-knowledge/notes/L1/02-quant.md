# Quantitative Methods
@topic quant

## Holding period return (HPR)
@id hpr
@r 1, 2
@aka total return; period return; simple return; how much did I make; price return plus income
@see geometric-mean-return; annualized-return; log-return

The return earned over one holding period: price change plus any income (dividends, coupons), divided by the starting price.

$$HPR = \frac{P_1 - P_0 + D_1}{P_0}$$

The two parts are the **price return** \((P_1-P_0)/P_0\) and the **income yield** \(D_1/P_0\). Over several periods, link the period returns by compounding: \((1+R_1)(1+R_2)\cdots - 1\), never by adding them.

> **Example** Buy at 50, receive a 1.00 dividend, sell at 54. HPR = (54 − 50 + 1) / 50 = 10%.

> **At work** "Total return" on a fact sheet is an HPR that assumes income is reinvested. "Price return" indices ignore dividends, so they understate what holders earned.

## Arithmetic mean return
@id arithmetic-mean-return
@r 2, 5
@aka average return; simple average; mean return; expected single period return
@see geometric-mean-return; harmonic-mean

The simple average of a series of period returns. It is the best estimate of the return for **one** future period, but it overstates what a buy-and-hold investor actually compounded.

$$\bar R = \frac{1}{n}\sum_{t=1}^{n} R_t$$

> **Watch out** +50% then −50% has an arithmetic mean of 0%, yet 100 becomes 150 then 75: you lost 25%. Use the [[geometric-mean-return]] for multi-period performance.

## Geometric mean return
@id geometric-mean-return
@r 2, 5
@aka compound annual growth rate; CAGR; compound return; time-weighted average; annualised growth
@see arithmetic-mean-return; annualized-return; time-weighted-return

The constant per-period return that turns the starting value into the ending value. It is what the investment actually compounded at.

$$R_G = \left[\prod_{t=1}^{n}(1+R_t)\right]^{1/n} - 1$$

The geometric mean is always ≤ the arithmetic mean, and the gap grows with volatility: roughly \(R_G \approx \bar R - \sigma^2/2\). This "volatility drag" is why a volatile fund with a high average return can still lag a steadier one.

> **Example** Returns of +20%, −10%, +5%: (1.2 × 0.9 × 1.05)^(1/3) − 1 = 4.0% a year, while the arithmetic mean is 5.0%.

## Harmonic mean
@id harmonic-mean
@r 5
@aka dollar cost averaging average price; average cost per share; harmonic average
@see arithmetic-mean-return

The reciprocal of the average of reciprocals. In finance it gives the average **cost per share** when you invest the same amount of money at different prices (cost averaging).

$$\bar X_H = \frac{n}{\sum 1/X_i}$$

For positive values: harmonic ≤ geometric ≤ arithmetic. Investing 1,000 at 10 and 1,000 at 20 buys 150 shares for 2,000, an average cost of 13.33, which is the harmonic mean of 10 and 20 (not 15).

## Annualized return
@id annualized-return
@r 2
@aka annualise; annualizing returns; per annum return; convert monthly return to annual; compounding periods
@see geometric-mean-return; ear

Converting a return earned over some period into a yearly rate by compounding, so returns over different horizons can be compared.

$$R_{annual} = (1 + R_{period})^{c} - 1$$

where \(c\) is the number of periods in a year (12 for monthly, 52 for weekly, 365/days for a day count). A return over more than a year uses a fractional power: an 80% return over 5 years is \(1.8^{1/5}-1 = 12.5\%\) a year.

> **Watch out** Annualizing a very short return (a great week) extrapolates it as if it could be repeated 52 times. Treat such numbers with care.

## Continuously compounded (log) return
@id log-return
@r 2, 6
@aka log return; ln return; continuous compounding; natural log of price relative
@see hpr; lognormal-distribution

The natural log of the price relative. Log returns **add** over time, which makes multi-period maths and statistical modelling easy.

$$r = \ln\left(\frac{P_1}{P_0}\right) = \ln(1 + HPR), \qquad HPR = e^{r} - 1$$

A T-period log return is the sum of the one-period log returns. If log returns are normally distributed, prices are [[lognormal-distribution|lognormal]] and can never go below zero.

## Gross, net, pre-tax and real returns
@id return-types
@r 2
@aka net return; gross return; after tax return; nominal vs real; inflation adjusted return; leveraged return
@see real-vs-nominal-rates; hpr

Ways of stating the same investment result from different angles:

- **Gross return**: before management fees and other costs (trading costs are usually already deducted). Used to judge a manager's skill.
- **Net return**: after fees. What the client receives.
- **After-tax return**: after taxes on dividends, interest and realized gains. Matters for taxable investors.
- **Real return**: adjusted for inflation: \((1+R_{nominal})/(1+\pi) - 1\), roughly nominal minus inflation.
- **Leveraged return**: return on your own equity when part of the position is borrowed: \(R_L = R + \frac{V_B}{V_E}(R - r_D)\). Leverage magnifies gains and losses.

## Real vs. nominal interest rates
@id real-vs-nominal-rates
@r 1
@aka Fisher effect; inflation adjusted rate; real rate; nominal rate; required return components; risk premium
@see risk-free-rate; return-types

A nominal rate compensates for three things: the real time value of money, expected inflation, and risk.

$$(1+r_{nominal}) = (1+r_{real})(1+\pi^e)(1+RP) \;\approx\; r_{real} + \pi^e + RP$$

The **nominal risk-free rate** is the real risk-free rate plus expected inflation (the Fisher relation). The **required return** on a risky asset adds risk premiums for default risk, liquidity risk and maturity risk.

> **At work** Breakeven inflation = nominal government yield − inflation-linked (real) yield of the same maturity. It is the market's inflation expectation plus an inflation risk premium.

## Risk-free rate and risk premium
@id risk-free-rate
@r 1, 50
@aka rf; treasury bill rate; required rate of return; equity risk premium; default premium; liquidity premium; maturity premium
@see real-vs-nominal-rates; capm

The risk-free rate is the return on an asset with no default risk over the horizon, usually proxied by short-term government bills. A **risk premium** is the extra expected return investors demand for bearing a risk.

- **Default (credit) premium**: chance the borrower fails to pay.
- **Liquidity premium**: cost of selling quickly at a fair price.
- **Maturity premium**: long-dated bonds are more sensitive to rate changes.
- **Equity risk premium**: expected return of stocks over the risk-free rate.

## Money-weighted vs. time-weighted return
@id mwr-twr
@r 3
@aka money weighted return; MWR; dollar weighted return; IRR of portfolio; time weighted return; TWR; manager performance measure; cash flow timing
@see irr; geometric-mean-return; time-weighted-return

Two ways to measure the return of a portfolio that has contributions and withdrawals.

| | Money-weighted (MWR) | Time-weighted (TWR) |
|---|---|---|
| What it is | The [[irr]] of all cash flows in and out | Geometric link of sub-period returns between cash flows |
| Affected by cash-flow timing? | Yes | No |
| Best for | The investor's own experience | Judging a manager who does not control flows |

> **Example** A fund returns +20% in year 1 and −10% in year 2. TWR = (1.2 × 0.9)^½ − 1 = 3.9%. If the client added a lot of money just before the bad year, the MWR is lower than 3.9%: the client had more money exposed to the loss.

> **At work** GIPS-compliant composites report time-weighted returns. Private equity reports IRR (money-weighted) because the GP controls the timing of capital calls.

## Time-weighted return
@id time-weighted-return
@r 3
@aka TWR; chain linked return; sub-period returns
@see mwr-twr

Break the period at each external cash flow, compute the HPR for each sub-period, then link them: \(TWR = \prod(1+HPR_i) - 1\), annualized if longer than a year. Because each piece is measured before the next flow arrives, the size of client contributions does not affect it. See [[mwr-twr]].

## Index weighting methods
@id index-weighting
@r 3, 41
@aka price weighted index; market cap weighted; value weighted; equal weighted; float adjusted; fundamental weighting; Dow vs S&P; benchmark construction; rebalancing; reconstitution
@see benchmark

How the constituents of an index are weighted, and what that implies:

| Method | Weight ∝ | Notes |
|---|---|---|
| Price-weighted | Share price | Sum of prices / divisor. High-priced stocks dominate; splits change weights. (Dow Jones Industrial Average, Nikkei 225.) |
| Equal-weighted | 1/N | Small caps overweighted vs the market; needs frequent rebalancing. |
| Market-cap (value) weighted | Price × shares | Self-rebalancing; tilts to large, possibly overvalued stocks. |
| Float-adjusted cap | Price × shares available to trade | The standard for major indices. |
| Fundamental | Sales, earnings, book value, dividends | Value tilt; avoids overweighting expensive stocks. |

**Rebalancing** resets weights to target (needed for equal weights); **reconstitution** changes which securities are in the index. A **total return** index reinvests income; a **price return** index does not.

## Benchmark
@id benchmark
@r 3, 89
@aka index as benchmark; performance comparison; tracking error; active return; relative return
@see index-weighting; tracking-error

The yardstick a portfolio is measured against. A good benchmark is **specified in advance, investable, measurable, appropriate to the manager's style, and reflects the manager's current views** (often summarized as SAMURAI-style criteria). Active return = portfolio return − benchmark return.

## Tracking error
@id tracking-error
@r 3, 88
@aka active risk; TE; standard deviation of active returns; information ratio denominator
@see benchmark; information-ratio

The standard deviation of the difference between portfolio and benchmark returns. Index funds aim for a tracking error near zero; active managers take on tracking error to try to earn a positive active return.

$$TE = \sigma(R_p - R_b)$$

## Time value of money (TVM)
@id tvm
@r 4
@aka present value; future value; PV; FV; discounting; compounding; annuity; perpetuity; discount rate
@see annuity; perpetuity; ear; npv

Money today is worth more than the same amount later, because it can earn a return. Moving cash flows through time:

$$FV = PV(1+r)^N \qquad PV = \frac{FV}{(1+r)^N}$$

The value of any asset is the present value of its expected cash flows, discounted at a rate that reflects their risk. Bonds, stocks, projects and leases are all priced with this one idea.

> **At work** On a financial calculator: N, I/Y, PV, PMT, FV. Cash paid out is negative, cash received is positive; mixing signs up is the usual cause of an error.

## Annuity
@id annuity
@r 4
@aka ordinary annuity; annuity due; level payments; mortgage payment; loan amortization; PMT
@see tvm; perpetuity

A series of equal payments at equal intervals. An **ordinary annuity** pays at the end of each period; an **annuity due** pays at the start (worth one period's growth more).

$$PV_{ordinary} = PMT\cdot\frac{1-(1+r)^{-N}}{r} \qquad PV_{due} = PV_{ordinary}\,(1+r)$$

> **Example** A 300,000 mortgage, 30 years, 6% a year paid monthly: r = 0.5%, N = 360, PMT ≈ 1,798.65 a month.

## Perpetuity and growing perpetuity
@id perpetuity
@r 4, 44
@aka perpetuity formula; consol; preferred stock value; growing perpetuity; Gordon; constant growth
@see gordon-growth-model; preferred-stock-valuation

A level payment forever is worth \(PV = PMT/r\). If the payment grows at a constant rate \(g < r\):

$$PV_0 = \frac{CF_1}{r-g}$$

This is the engine behind the [[gordon-growth-model]], terminal values in DCF models, and the value of a non-callable preferred share.

## Implied return and implied growth
@id implied-return
@r 4
@aka implied yield; what return does the price imply; implied growth rate; reverse DCF; market implied expectations
@see ytm; gordon-growth-model

Run a valuation model backwards: given a market price, solve for the return (or growth rate) that makes the model equal the price.

- Bond: the [[ytm]] is the implied return from price and promised cash flows.
- Stock: from the Gordon model, \(r = D_1/P_0 + g\) (dividend yield + growth), or \(g = r - D_1/P_0\).

> **At work** A "reverse DCF" asks what growth the current share price assumes. If it requires 25% a year for a decade, the price is pricing in a lot.

## Cash flow additivity and no-arbitrage
@id cash-flow-additivity
@r 4, 73
@aka additivity principle; law of one price; replicating cash flows; implied forward rate; no arbitrage pricing
@see arbitrage; forward-rate

The present value of a set of cash flows equals the sum of the present values of each one, so any instrument can be valued as a bundle of simpler pieces. If two portfolios produce identical cash flows they must have the same price, otherwise an arbitrage exists. This is how implied [[forward-rate|forward rates]], forward FX rates and derivative prices are derived.

$$(1+S_2)^2 = (1+S_1)(1+F_{1,1})$$

## Effective annual rate (EAR)
@id ear
@r 4, 57
@aka effective annual yield; EAY; APR vs APY; stated annual rate; compounding frequency; periodic rate
@see annualized-return; tvm

The annual rate after accounting for compounding within the year.

$$EAR = \left(1 + \frac{r_{stated}}{m}\right)^m - 1 \qquad EAR_{continuous} = e^{r} - 1$$

A 12% rate compounded monthly is an EAR of 12.68%. More frequent compounding → higher EAR for the same stated rate.

## Measures of central tendency
@id central-tendency
@r 5
@aka mean; median; mode; average; trimmed mean; winsorized mean; outliers
@see arithmetic-mean-return; dispersion

Ways to describe the "middle" of a data set.

- **Mean**: sensitive to outliers.
- **Median**: middle value; robust to outliers, good for skewed data (incomes, deal sizes).
- **Mode**: most frequent value.
- **Trimmed mean**: drop a percentage of the highest and lowest values first.
- **Winsorized mean**: replace extremes with the cut-off values instead of dropping them.

**Quantiles** (quartiles, quintiles, deciles, percentiles) locate observations; the interquartile range is Q3 − Q1.

## Dispersion: variance and standard deviation
@id dispersion
@r 5
@aka volatility; standard deviation; variance; sigma; range; mean absolute deviation; MAD; risk measure; stdev
@see semi-deviation; coefficient-of-variation

How spread out returns are around the mean. Standard deviation is the most common measure of investment risk ("volatility").

$$s^2 = \frac{\sum (X_i - \bar X)^2}{n-1} \qquad s = \sqrt{s^2}$$

Divide by \(n-1\) for a sample (to correct bias) and by \(N\) for a whole population. Other measures: **range** (max − min) and **mean absolute deviation** (average of |X − mean|).

> **At work** Annualize volatility by the square root of time: monthly σ × √12. A 5% monthly σ ≈ 17.3% a year.

## Semi-deviation (downside risk)
@id semi-deviation
@r 5
@aka downside deviation; semivariance; target downside deviation; Sortino; downside risk
@see dispersion; sortino-ratio

Standard deviation that only counts observations below the mean (or below a target return). Investors mind losses more than upside surprises, so this measures the risk they care about.

$$s_{target} = \sqrt{\frac{\sum_{X_i < B}(X_i - B)^2}{n-1}}$$

## Coefficient of variation (CV)
@id coefficient-of-variation
@r 5
@aka CV; risk per unit of return; relative dispersion
@see dispersion; sharpe-ratio

Standard deviation divided by the mean: risk per unit of return. Lower is better. Useful for comparing investments with different average returns.

$$CV = \frac{s}{\bar X}$$

## Skewness
@id skewness
@r 5
@aka skew; asymmetry; positive skew; negative skew; left tail; right tail; lottery payoff
@see kurtosis; central-tendency

A measure of asymmetry.

- **Positive (right) skew**: many small losses, a few big gains. Mean > median > mode. (Lottery tickets, call options, venture capital.)
- **Negative (left) skew**: many small gains, occasional big losses. Mean < median < mode. (Selling insurance or options, many hedge fund strategies.)

Investors generally prefer positive skew. A strategy with a smooth track record and negative skew can hide large tail risk.

## Kurtosis
@id kurtosis
@r 5
@aka fat tails; leptokurtic; platykurtic; excess kurtosis; tail risk; peakedness
@see skewness; normal-distribution

How much probability sits in the tails compared with a normal distribution (kurtosis = 3). **Excess kurtosis** = kurtosis − 3.

- **Leptokurtic** (excess > 0): fat tails; extreme events happen more often than a normal model says. Typical of asset returns.
- **Platykurtic** (excess < 0): thin tails.

> **Watch out** Risk models that assume normality, such as a simple [[var]], understate the chance of crashes when returns are leptokurtic.

## Covariance and correlation
@id correlation
@r 5, 8, 87
@aka covariance; correlation coefficient; rho; co-movement; diversification; how assets move together; spurious correlation
@see portfolio-variance; diversification

**Covariance** measures how two variables move together; its size depends on their units. **Correlation** scales it to between −1 and +1.

$$Cov(X,Y) = \frac{\sum (X_i-\bar X)(Y_i - \bar Y)}{n-1} \qquad \rho = \frac{Cov(X,Y)}{\sigma_X\sigma_Y}$$

Correlation measures **linear** association only. A correlation of 0 does not mean independence, and correlation does not imply causation. Watch for **spurious correlation** (chance or a third variable) and outliers driving the result.

> **At work** Correlations between risky assets tend to rise in a crisis, just when diversification is needed.

## Expected value, variance and covariance from probabilities
@id expected-value
@r 6
@aka expected return; probability weighted average; scenario analysis; conditional expectation; unconditional expectation
@see correlation; bayes

With scenarios and probabilities rather than historical data:

$$E(R) = \sum p_i R_i \qquad \sigma^2 = \sum p_i\,(R_i - E(R))^2$$

$$Cov(R_A,R_B) = \sum p_i\,(R_{A,i}-E(R_A))(R_{B,i}-E(R_B))$$

An **unconditional** expectation uses all scenarios; a **conditional** one uses only those consistent with some information (e.g. "given a recession"). The total probability rule links them: \(E(X) = \sum E(X|S_i)P(S_i)\).

## Normal distribution
@id normal-distribution
@r 6
@aka bell curve; gaussian; z score; standard normal; confidence interval 95 percent; 1.96; 68 95 99
@see lognormal-distribution; confidence-interval; kurtosis

Symmetric, bell-shaped, fully described by its mean and standard deviation. Skewness 0, kurtosis 3.

- ~68% of outcomes within ±1σ, ~90% within ±1.65σ, ~95% within ±1.96σ, ~99% within ±2.58σ.
- **z-score**: \(z = (X-\mu)/\sigma\), the number of standard deviations from the mean.

A linear combination of normal variables is also normal, which is why portfolio returns are often modelled as normal.

## Lognormal distribution
@id lognormal-distribution
@r 6
@aka lognormal; asset prices distribution; price cannot be negative; right skewed prices
@see log-return; normal-distribution

If \(\ln X\) is normal, X is lognormal. It is bounded below by zero and skewed to the right, which fits asset **prices** well. Normal continuously compounded returns ⇔ lognormal prices. The Black-Scholes-Merton option model assumes this.

## Student's t, chi-square and F distributions
@id t-distribution
@r 6, 7
@aka t distribution; degrees of freedom; chi square; F test; small sample; fat tails distribution
@see hypothesis-testing; confidence-interval

Distributions used for tests when parameters are estimated from samples.

- **t-distribution**: symmetric, fatter tails than normal; defined by degrees of freedom (df = n − 1). Approaches the normal as df grows. Used for tests of means when σ is unknown.
- **Chi-square**: right-skewed, non-negative; tests of a single variance and of independence in contingency tables.
- **F**: ratio of two chi-squares; tests equality of two variances and regression significance.

## Bayes' formula
@id bayes
@r 6
@aka Bayesian updating; posterior probability; prior; conditional probability; update beliefs with new information
@see expected-value

How to update a probability when new information arrives.

$$P(A\mid B) = \frac{P(B\mid A)\,P(A)}{P(B)}$$

> **Example** 10% of firms in a sector are distressed (prior). A warning signal appears for 80% of distressed firms and 20% of healthy ones. P(signal) = 0.8×0.1 + 0.2×0.9 = 0.26. P(distressed | signal) = 0.08/0.26 = 31%. The signal triples the probability, but most flagged firms are still healthy.

## Central limit theorem and standard error
@id central-limit-theorem
@r 7
@aka CLT; sampling distribution; standard error of the mean; sample size; law of large numbers
@see confidence-interval; sampling-methods

For a large sample (n ≥ 30 as a rule of thumb), the sample mean is approximately normally distributed around the population mean, **whatever the shape of the population**. Its standard deviation, the **standard error**, shrinks with the square root of n:

$$SE(\bar X) = \frac{\sigma}{\sqrt n} \approx \frac{s}{\sqrt n}$$

## Confidence interval
@id confidence-interval
@r 7
@aka interval estimate; margin of error; 95% confidence; reliability factor; point estimate
@see central-limit-theorem; t-distribution

A range likely to contain the true parameter:

$$\bar X \pm (\text{reliability factor}) \times SE$$

Use z (1.645 / 1.96 / 2.576 for 90/95/99%) when σ is known or the sample is large; use t with n − 1 df when σ is unknown and the sample is small. Wider intervals = more confidence, less precision.

## Sampling methods and biases
@id sampling-methods
@r 7
@aka simple random sampling; stratified sampling; cluster sampling; convenience sampling; judgmental sampling; data snooping; survivorship bias; look ahead bias; time period bias; sample selection bias
@see central-limit-theorem; historical-simulation

**Probability sampling**: simple random, systematic, **stratified** (random within subgroups, used to build bond index funds), cluster. **Non-probability**: convenience, judgmental.

Common biases in investment research:

- **Data snooping**: testing many ideas on the same data until something "works".
- **Survivorship bias**: only surviving funds or firms in the database, so returns look too good.
- **Look-ahead bias**: using information not available at the time (e.g. year-end book values on January 1).
- **Time-period bias**: results that only hold in the chosen window.
- **Sample selection bias**: data excluded for non-random reasons.

## Hypothesis testing
@id hypothesis-testing
@r 7
@aka null hypothesis; alternative hypothesis; test statistic; p value; significance level; reject the null; statistically significant; one tailed; two tailed
@see type-i-ii-errors; t-distribution; parametric-tests

A structured way to decide whether data are consistent with a claim.

1. State H₀ (the claim you test, contains "=") and Hₐ (what you hope to show).
2. Choose the test statistic and significance level α (often 5%).
3. Compute the statistic, e.g. \(t = (\bar X - \mu_0)/(s/\sqrt n)\).
4. Reject H₀ if the statistic is beyond the critical value, equivalently if the **p-value < α**.

The **p-value** is the smallest significance level at which H₀ could be rejected. Statistical significance is not economic significance: a tiny but "significant" excess return may vanish after trading costs.

## Type I and Type II errors, power
@id type-i-ii-errors
@r 7
@aka false positive; false negative; alpha; beta; power of a test; significance level
@see hypothesis-testing

| | H₀ true | H₀ false |
|---|---|---|
| Reject H₀ | **Type I error** (prob = α) | Correct (power = 1 − β) |
| Fail to reject | Correct | **Type II error** (prob = β) |

Lowering α reduces Type I errors but raises Type II errors for a given sample. A larger sample improves both. **Power** is the probability of correctly rejecting a false null.

## Parametric vs. non-parametric tests
@id parametric-tests
@r 7
@aka test of mean; test of difference in means; paired comparison; test of variance; chi square test of independence; Spearman rank correlation; non parametric; test of correlation
@see hypothesis-testing; t-distribution

**Parametric** tests make assumptions about the distribution (often normality) and test parameters:

| Test | Statistic |
|---|---|
| Single mean | t with n − 1 df |
| Difference in means (independent samples) | t (pooled variance) |
| Mean of differences (paired, e.g. same stocks before/after) | t on the differences |
| Single variance | χ² = (n−1)s²/σ₀² |
| Two variances | F = s₁²/s₂² |
| Correlation | \(t = r\sqrt{n-2}/\sqrt{1-r^2}\) |

**Non-parametric** tests make few assumptions; use them for ranks or ordinal data, outliers, or when the parametric assumptions fail. Examples: **Spearman rank correlation**, sign test, Wilcoxon, and the **chi-square test of independence** for categorical data in a contingency table.

## Portfolio expected return and variance
@id portfolio-variance
@r 8, 87
@aka two asset portfolio; portfolio standard deviation; portfolio risk formula; weights; diversification benefit
@see correlation; diversification; efficient-frontier

Portfolio expected return is the weighted average of asset returns. Portfolio risk is **not**: it depends on correlations.

$$E(R_p) = \sum w_i E(R_i)$$

$$\sigma_p^2 = w_1^2\sigma_1^2 + w_2^2\sigma_2^2 + 2w_1w_2\rho_{12}\sigma_1\sigma_2$$

When ρ = +1, σₚ is the weighted average of σs (no diversification). When ρ < 1, σₚ is lower. When ρ = −1 a zero-risk combination exists.

> **Example** 60/40 in assets with σ = 20% and 10%, ρ = 0.2: σₚ² = 0.36×0.04 + 0.16×0.01 + 2×0.6×0.4×0.2×0.2×0.1 = 0.01792, σₚ = 13.4%, below the 16% weighted average.

## Diversification
@id diversification
@r 8, 87, 88
@aka diversification benefit; correlation less than one; number of stocks; idiosyncratic risk diversified away; don't put all eggs in one basket
@see portfolio-variance; systematic-risk

Combining assets that are not perfectly correlated lowers risk without lowering expected return proportionally. As the number of assets grows, the portfolio variance tends toward the average covariance: firm-specific (unsystematic) risk disappears, market (systematic) risk remains. Most of the benefit comes from the first 20–30 stocks.

## Minimum-variance and efficient frontier
@id efficient-frontier
@r 8, 87
@aka Markowitz efficient frontier; global minimum variance portfolio; GMV; mean variance optimization; efficient portfolios
@see portfolio-variance; capital-allocation-line; optimal-portfolio

The **minimum-variance frontier** plots, for each expected return, the lowest-risk portfolio of risky assets. Its leftmost point is the **global minimum-variance portfolio**. The upper half, above that point, is the **efficient frontier**: no other portfolio offers more return for the same risk. Rational, risk-averse investors only choose portfolios on the efficient frontier.

## Capital allocation line (CAL) and capital market line (CML)
@id capital-allocation-line
@r 8, 88
@aka CAL; CML; risk free asset plus risky portfolio; tangency portfolio; market portfolio; two fund separation; lending and borrowing portfolio
@see efficient-frontier; optimal-portfolio; sharpe-ratio; capm

Combine a risk-free asset with a risky portfolio P and the possible results lie on a straight line:

$$E(R_C) = R_f + \frac{E(R_P) - R_f}{\sigma_P}\,\sigma_C$$

The slope is P's [[sharpe-ratio]]. The best CAL is tangent to the efficient frontier; under the CAPM's assumptions, everyone holds the same tangency portfolio, the **market portfolio**, and that CAL is the **capital market line**. Investors differ only in how much they lend (left of M) or borrow (right of M): **two-fund separation**.

## Optimal portfolio and risk aversion
@id optimal-portfolio
@r 8, 87
@aka utility function; indifference curve; risk aversion coefficient; risk averse; risk neutral; risk seeking; investor's optimal portfolio
@see capital-allocation-line; efficient-frontier

Investor utility in mean-variance terms:

$$U = E(R) - \tfrac{1}{2}A\sigma^2$$

A is the risk-aversion coefficient (A > 0 risk averse, A = 0 risk neutral, A < 0 risk seeking). **Indifference curves** join portfolios of equal utility; more risk-averse investors have steeper curves. The optimal portfolio is where the highest indifference curve touches the CAL. The optimal weight in the risky portfolio is \(w^* = \frac{E(R_P)-R_f}{A\sigma_P^2}\).

## Historical simulation
@id historical-simulation
@r 9
@aka historical scenarios; replay history; backtest scenarios; historical VaR
@see monte-carlo; bootstrap; var

Use actual past returns (or changes in risk factors) as the set of possible future outcomes and revalue the portfolio under each. Simple and captures real fat tails and correlations, but assumes the future looks like the sampled past and can't show events that never happened.

## Bootstrap resampling
@id bootstrap
@r 9
@aka bootstrapping; resampling with replacement; sampling distribution estimate
@see historical-simulation; monte-carlo

Draw many samples **with replacement** from the observed data, compute the statistic each time, and use the spread of results as its sampling distribution. Gives standard errors and confidence intervals without assuming a distribution. (In fixed income, "bootstrapping" also means deriving spot rates from par rates, a different idea: see [[spot-rate]].)

## Monte Carlo simulation
@id monte-carlo
@r 9
@aka monte carlo; random scenarios; simulation of returns; retirement planning simulation; probability of shortfall; pricing path dependent options
@see historical-simulation; bootstrap; var

Specify distributions for the risk factors, generate thousands of random scenarios, value the portfolio or project in each, and study the distribution of outcomes. Used for retirement planning (probability of running out of money), [[var]], valuing complex derivatives and testing strategies.

Strengths: handles non-linear payoffs and many factors. Limits: results are only as good as the assumed distributions and correlations, and it gives statistical answers, not analytic insight.

## Simple linear regression
@id linear-regression
@r 10
@aka OLS; ordinary least squares; regression line; slope; intercept; dependent variable; independent variable; explanatory variable; fitted value; residual
@see regression-assumptions; r-squared; beta

Fits a straight line \(Y = b_0 + b_1X + \varepsilon\) through data by minimizing the sum of squared residuals.

$$\hat b_1 = \frac{Cov(X,Y)}{Var(X)} \qquad \hat b_0 = \bar Y - \hat b_1 \bar X$$

The slope is the expected change in Y for a one-unit change in X. Test whether it is meaningfully different from zero with \(t = \hat b_1 / s_{\hat b_1}\), df = n − 2.

## Regression assumptions and residual analysis
@id regression-assumptions
@r 10
@aka linearity; homoskedasticity; heteroskedasticity; independence of errors; serial correlation; autocorrelation; normality of residuals; residual plot; outliers
@see linear-regression

Simple linear regression assumes: (1) a **linear** relationship, (2) residuals with constant variance (**homoskedasticity**), (3) residuals **independent** of each other, (4) residuals **normally distributed**. Plot residuals against X or time to spot problems: a funnel shape means heteroskedasticity; patterns over time mean serial correlation; curvature means the relationship isn't linear. Violations make standard errors and tests unreliable.

## R², ANOVA and standard error of estimate
@id r-squared
@r 10
@aka coefficient of determination; R squared; goodness of fit; ANOVA; SST SSR SSE; F statistic; standard error of estimate; SEE
@see linear-regression; prediction-interval

Total variation in Y splits into explained and unexplained parts: SST = RSS (regression) + SSE (error).

$$R^2 = \frac{RSS}{SST} \qquad SEE = \sqrt{\frac{SSE}{n-2}} \qquad F = \frac{RSS/1}{SSE/(n-2)}$$

R² is the share of Y's variation explained by X (in simple regression it equals the correlation squared). SEE is the typical size of a residual: smaller means a tighter fit. With one X, the F-test and the slope t-test give the same answer (F = t²).

## Prediction interval
@id prediction-interval
@r 10
@aka forecast interval; predicted value; confidence in a forecast; standard error of forecast
@see r-squared; linear-regression

A forecast \(\hat Y = \hat b_0 + \hat b_1 X\) comes with an interval \(\hat Y \pm t_c \times s_f\). The forecast standard error \(s_f\) is larger than the SEE and grows the further X is from its sample mean: extrapolating far outside the data is less reliable.

## Estimating beta with regression (market model)
@id beta-regression
@r 10, 50, 88
@aka regression beta; characteristic line; market model; alpha intercept; estimating CAPM beta; beta estimation
@see beta; capm; market-model

Regress a stock's excess returns on the market's excess returns:

$$R_i - R_f = \alpha_i + \beta_i (R_m - R_f) + \varepsilon_i$$

The slope is the stock's [[beta]]; the intercept is its historical alpha (abnormal return). R² shows how much of the stock's risk is systematic. Choices that change the estimate: the index used, the return interval (daily, weekly, monthly), and the length of history. Analysts often adjust raw beta toward 1.

## Financial data science, big data and machine learning
@id data-science
@r 11
@aka big data; machine learning; ML; artificial intelligence; AI; alternative data; NLP; natural language processing; supervised learning; unsupervised learning; deep learning; fintech; overfitting
@see sampling-methods

**Big data** is described by volume, velocity, variety (and veracity). Alternative data includes satellite images, credit-card transactions, web traffic and social media text.

**Machine learning** finds patterns without being told the model's form:

- **Supervised**: learn from labelled data to predict an outcome (default / no default, next-month return).
- **Unsupervised**: find structure in unlabelled data (clustering similar stocks).
- **Deep learning**: multi-layer neural networks, for images, speech and text.
- **NLP**: reads filings, news and call transcripts for sentiment and topics.

The main risk is **overfitting**: a model that memorizes noise in the training data and fails on new data. Split data into training, validation and test sets. Many ML models are also hard to explain ("black box").

## Value at Risk (VaR)
@id var
@r 92, 9
@aka VaR; value at risk; worst loss at confidence level; conditional VaR; CVaR; expected shortfall; tail loss
@see monte-carlo; historical-simulation; kurtosis

The minimum loss expected over a period with a given probability, e.g. "5% one-day VaR of 2 million" means a 5% chance of losing at least 2 million in a day. Computed parametrically (\(VaR = (\mu - z\sigma)\times V\)), by [[historical-simulation]], or by [[monte-carlo]].

VaR says nothing about **how bad** losses can get beyond the threshold. **Conditional VaR (expected shortfall)** is the average loss in that tail.
