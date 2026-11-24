# Quantitative Methods
@topic quant2

## Multiple regression: model and interpretation
@id multiple-regression
@r 1
@aka multiple linear regression; several independent variables; partial slope coefficient; holding other variables constant; regression with many factors
@see linear-regression; multiple-regression-anova; regression-misspecification

Extends [[linear-regression|simple regression]] to several explanatory variables:

$$Y_i = b_0 + b_1X_{1i} + b_2X_{2i} + \cdots + b_kX_{ki} + \varepsilon_i$$

Each slope is a **partial** effect: the expected change in Y for a one-unit change in that X, **holding the other Xs constant**. Test each coefficient with \(t = (\hat b_j - b_j^0)/s_{\hat b_j}\), df = n − k − 1.

Typical uses: explaining returns with several factors, testing whether a variable adds explanatory power, and forecasting (e.g. a company's sales from GDP, prices and marketing spend).

> **Watch out** A coefficient that's "insignificant" in a multiple regression may be significant alone: correlated Xs share the explanatory power (see [[multicollinearity]]).

## ANOVA, adjusted R² and joint F-tests
@id multiple-regression-anova
@r 1
@aka adjusted R squared; F test; joint hypothesis test; restricted vs unrestricted model; AIC; BIC; Akaike; Schwarz; goodness of fit multiple regression; nested models
@see multiple-regression; r-squared

- **R²** always rises when you add a variable, even a useless one.
- **Adjusted R²** penalizes extra variables: \(\bar R^2 = 1 - \frac{n-1}{n-k-1}(1-R^2)\). It can fall, and can be negative.
- **F-test of the whole model** (H₀: all slopes = 0): \(F = \frac{RSS/k}{SSE/(n-k-1)}\).
- **Joint F-test** of a subset of q coefficients, comparing a restricted model (without them) with the unrestricted one:

$$F = \frac{(SSE_R - SSE_U)/q}{SSE_U/(n-k-1)}$$

- **AIC** (prefer for forecasting) and **BIC** (prefer for goodness of fit; penalizes extra variables more): lower is better.

## Regression assumptions and residual plots (multiple)
@id multiple-regression-assumptions
@r 1
@aka regression assumptions; linearity; homoskedasticity; independence of errors; normality; residual plot; QQ plot; no exact multicollinearity
@see regression-assumptions; heteroskedasticity; serial-correlation; multicollinearity

Same as simple regression plus one more: (1) linear relationship, (2) **homoskedastic** errors, (3) **independent** errors (no serial correlation), (4) **normally** distributed errors, (5) the independent variables are not random... in practice, **no exact linear relationship among the Xs**. Check with plots of residuals against fitted values and each X (patterns = trouble), and a normal Q-Q plot of residuals (fat tails show up as departures at the ends).

## Model misspecification
@id regression-misspecification
@r 1
@aka misspecification; omitted variable bias; wrong functional form; inappropriate scaling; pooling data; endogeneity; lagged dependent variable; measurement error
@see multiple-regression; heteroskedasticity; serial-correlation

Forms of misspecification:

- **Omitting a relevant variable**: biased and inconsistent coefficients if the omitted variable is correlated with included ones; also can cause serial correlation or heteroskedasticity.
- **Wrong functional form**: e.g. a relationship that is really logarithmic or quadratic.
- **Inappropriate scaling** (e.g. levels when ratios fit better).
- **Inappropriate pooling** of data from different regimes or periods.
- **Independent variables correlated with the error**: a lagged dependent variable with serially correlated errors, a forecast of X used as X, or X measured with error. These make estimates **inconsistent**.

## Heteroskedasticity
@id heteroskedasticity
@r 1
@aka heteroskedasticity; non constant variance; conditional heteroskedasticity; Breusch Pagan test; robust standard errors; White standard errors; unconditional heteroskedasticity
@see serial-correlation; multicollinearity; arch

The variance of the errors changes across observations.

- **Unconditional**: unrelated to the Xs. Not a serious problem.
- **Conditional**: variance depends on the Xs. Coefficients stay unbiased but **standard errors are too small** (usually), so t-statistics are inflated and you find "significant" results that aren't (Type I errors). The F-test is unreliable.

**Detect**: residual plots; the **Breusch-Pagan** test: regress squared residuals on the Xs; \(BP = n \times R^2_{resid}\) ~ χ² with k df. **Correct**: use **robust (White-corrected) standard errors**.

## Serial correlation (autocorrelation)
@id serial-correlation
@r 1, 2
@aka serial correlation; autocorrelation; Durbin Watson; Breusch Godfrey test; Newey West standard errors; positive serial correlation; correlated residuals
@see heteroskedasticity; ar-model

Regression errors are correlated with each other over time (common in time series).

- With no lagged dependent variable as an X, coefficients remain consistent but **standard errors are wrong**: positive serial correlation understates them → too many false "significant" findings.
- If a lagged Y is an X, coefficients become **inconsistent**.

**Detect**: residual plots over time; **Durbin-Watson** (≈ 2 means none; well below 2 means positive correlation); **Breusch-Godfrey** test for several lags. **Correct**: **Newey-West** standard errors (fix both serial correlation and heteroskedasticity), or change the model.

## Multicollinearity
@id multicollinearity
@r 1
@aka multicollinearity; correlated independent variables; variance inflation factor; VIF; high R squared but insignificant t stats
@see multiple-regression; heteroskedasticity

Two or more independent variables are highly correlated. Coefficients stay unbiased but are imprecise: **standard errors inflate**, t-statistics shrink, and coefficients may flip sign. Classic symptom: a high R² and significant F-test but few significant individual t-tests.

**Detect**: the **variance inflation factor** \(VIF_j = 1/(1 - R_j^2)\), where \(R_j^2\) comes from regressing \(X_j\) on the other Xs. VIF > 5 is a concern; > 10 is serious. **Correct**: drop one of the correlated variables, use a different proxy, or gather more data.

## Influential observations: leverage, outliers, Cook's D
@id influential-observations
@r 1
@aka influence analysis; outliers; high leverage points; leverage; studentized residuals; Cook's distance; Cook's D; influential data points
@see multiple-regression

A few data points can drive a regression's results.

- **High-leverage point**: an extreme **X** value. Leverage \(h_{ii}\) > 3(k+1)/n flags it.
- **Outlier**: an extreme **Y** value given its X (large residual). Externally **studentized residuals** above the critical t (often |t| > 3) flag it.
- **Influential**: removing it changes the estimates materially. **Cook's distance** combines leverage and residual size; D > 0.5 is worth investigating, > 1 likely influential, or above \(\sqrt{k/n}\).

Investigate rather than automatically delete: an influential point may be a data error, or the most important observation you have.

## Dummy variables
@id dummy-variables
@r 1
@aka dummy variable; indicator variable; qualitative variable; intercept dummy; slope dummy; dummy variable trap; categorical variable regression
@see multiple-regression; seasonality

Binary (0/1) variables capture qualitative effects (a quarter, an industry, a policy regime).

- **Intercept dummy**: shifts the line up or down for the group.
- **Slope dummy** (dummy × X): changes the slope for the group.

To represent n categories use **n − 1 dummies**; the omitted category is the base. Using n dummies plus an intercept creates perfect multicollinearity (the "dummy variable trap").

## Logistic regression (logit)
@id logistic-regression
@r 1
@aka logit model; logistic regression; binary dependent variable; probability of default model; odds ratio; log odds; maximum likelihood; qualitative dependent variable; probit
@see multiple-regression; ml-supervised

When the dependent variable is binary (default/no default, takeover/no takeover), ordinary regression can predict probabilities outside 0–1. A **logit model** models the **log odds**:

$$\ln\left(\frac{P}{1-P}\right) = b_0 + b_1X_1 + \cdots + b_kX_k \qquad P = \frac{1}{1 + e^{-(b_0 + b_1X_1 + \cdots)}}$$

Coefficients are estimated by **maximum likelihood**. A coefficient is the change in log odds per unit of X; \(e^{b}\) is the **odds ratio**. Fit is judged with the likelihood ratio test and pseudo-R².

## Linear and log-linear trend models
@id trend-models
@r 2
@aka linear trend; log linear trend; exponential growth trend; time trend regression; trend model forecasting
@see ar-model; covariance-stationarity

- **Linear trend**: \(y_t = b_0 + b_1 t + \varepsilon_t\). Grows by a constant **amount** each period.
- **Log-linear trend**: \(\ln y_t = b_0 + b_1 t + \varepsilon_t\). Grows at a constant **rate**; suits sales, prices and other series that compound.

Choose by plotting the data (curving upward → log-linear). Trend models usually leave **serially correlated residuals** (Durbin-Watson test), which means they're inadequate and an autoregressive model is needed.

## Covariance stationarity
@id covariance-stationarity
@r 2
@aka stationary; covariance stationary; constant mean and variance; nonstationary time series; spurious regression
@see unit-root; ar-model; cointegration

A time series is **covariance stationary** if its mean, variance and covariance with its own lags are constant over time. Most time-series models (AR models) are only valid for stationary series. Nonstationary series (trending prices, random walks) give meaningless, **spurious** results, e.g. a high R² between two unrelated trending series.

## Autoregressive (AR) models
@id ar-model
@r 2
@aka autoregressive model; AR(1); AR(p); lagged dependent variable; time series forecasting; chain rule of forecasting; residual autocorrelation test
@see covariance-stationarity; mean-reversion-ts; serial-correlation

An AR(p) model predicts a series from its own past values:

$$x_t = b_0 + b_1x_{t-1} + b_2x_{t-2} + \cdots + b_px_{t-p} + \varepsilon_t$$

Multi-period forecasts use the **chain rule**: forecast \(x_{t+1}\), then plug it in to forecast \(x_{t+2}\) (uncertainty grows with each step).

**Check the fit**: residual autocorrelations should be insignificant. Test each with \(t = \rho_k / (1/\sqrt{T})\). If any is significant, add lags (or seasonal lags). The Durbin-Watson test is **not** valid for AR models.

## Mean reversion in time series
@id mean-reversion-ts
@r 2
@aka mean reverting level; long run mean of AR(1); mean reversion; b0 over 1 minus b1
@see ar-model; unit-root

A covariance-stationary AR(1) series tends to move back toward its **mean-reverting level**:

$$\hat x = \frac{b_0}{1 - b_1}$$

If the current value is above it, the model forecasts a decline, and vice versa. If \(b_1 = 1\), the level is undefined: the series has a unit root and does not mean revert.

## In-sample vs. out-of-sample forecasts, RMSE
@id rmse-forecasting
@r 2, 3
@aka root mean squared error; RMSE; out of sample forecast accuracy; in sample fit; forecast evaluation; coefficient instability; regime change
@see ar-model; overfitting

**In-sample** forecasts are fitted to the data used to estimate the model; **out-of-sample** forecasts test the model on data it hasn't seen, which is what matters. Compare models by **root mean squared error** of out-of-sample forecasts: \(RMSE = \sqrt{\frac{1}{n}\sum(\text{actual} - \text{forecast})^2}\); lower is better.

**Coefficient instability**: relationships change with regimes (policy, technology, regulation). Longer samples give more data but risk mixing regimes; check stability across subperiods.

## Random walks and unit roots
@id unit-root
@r 2
@aka random walk; random walk with drift; unit root; Dickey Fuller test; first differencing; nonstationary; b1 equals one
@see covariance-stationarity; cointegration; ar-model

A **random walk** is \(x_t = x_{t-1} + \varepsilon_t\) (with drift: \(x_t = b_0 + x_{t-1} + \varepsilon_t\)): an AR(1) with \(b_1 = 1\), a **unit root**. It has no mean-reverting level and its variance grows without bound, so it's not covariance stationary. Exchange rates and stock prices are often close to random walks.

**Test**: the **Dickey-Fuller** test regresses \(x_t - x_{t-1}\) on \(x_{t-1}\) and tests whether the coefficient \(g_1 = b_1 - 1\) is zero, using special (not t-table) critical values. **Fix**: model the **first differences** \(y_t = x_t - x_{t-1}\), which are usually stationary.

## Seasonality in time series
@id seasonality
@r 2
@aka seasonality; seasonal lag; quarterly seasonality; monthly seasonality; seasonal autocorrelation; AR with seasonal lag
@see ar-model; dummy-variables

A pattern that repeats every year. Detect it by a significant residual autocorrelation at the seasonal lag (lag 4 for quarterly data, 12 for monthly). Correct by adding that lag to the AR model, e.g. \(x_t = b_0 + b_1x_{t-1} + b_2x_{t-4} + \varepsilon_t\), or by using seasonal dummies.

## ARCH (autoregressive conditional heteroskedasticity)
@id arch
@r 2
@aka ARCH; ARCH(1); GARCH; volatility clustering; conditional variance; predicting variance
@see heteroskedasticity; ar-model

In ARCH the variance of today's error depends on the size of yesterday's error: **volatility clusters**. Test by regressing squared residuals on lagged squared residuals:

$$\hat\varepsilon_t^2 = a_0 + a_1\hat\varepsilon_{t-1}^2 + u_t$$

A significant \(a_1\) means ARCH is present. The standard errors of the original model are then unreliable (use generalized least squares or GARCH-type models), but the ARCH equation itself can **forecast next period's variance**, which is useful for risk management and option pricing.

## Cointegration and regressions with two time series
@id cointegration
@r 2
@aka cointegration; Engle Granger test; two time series regression; spurious regression; long term equilibrium relationship
@see unit-root; covariance-stationarity

Before regressing one time series on another, test both for unit roots:

| Y | X | Result |
|---|---|---|
| Stationary | Stationary | Regression valid |
| Unit root | Stationary (or vice versa) | Invalid |
| Unit root | Unit root, **not** cointegrated | Invalid (spurious) |
| Unit root | Unit root, **cointegrated** | Valid: estimates the long-run relationship |

Two series are **cointegrated** if they share a common trend, so a linear combination of them is stationary (e.g. a stock index and its futures, or two currencies tied by trade). Test with the **Engle-Granger** (Dickey-Fuller on the regression residuals) test.

## Supervised, unsupervised and deep learning
@id ml-types
@r 3
@aka machine learning types; supervised learning; unsupervised learning; deep learning; reinforcement learning; labelled data; regression vs classification; neural networks
@see data-science; ml-supervised; ml-unsupervised; overfitting

- **Supervised learning**: learns from **labelled** data (inputs with known outputs). **Regression** for continuous targets; **classification** for categories.
- **Unsupervised learning**: no labels; finds structure (clusters, factors) in the inputs.
- **Deep learning**: multi-layer **neural networks** for complex, non-linear patterns (images, text, speech).
- **Reinforcement learning**: an agent learns by trial and error to maximize a reward.

## Overfitting and how to address it
@id overfitting
@r 3, 4
@aka overfitting; underfitting; bias variance tradeoff; cross validation; k fold cross validation; training set; validation set; test set; generalization error; regularization
@see ml-types; ml-supervised; rmse-forecasting

**Overfitting**: the model learns noise in the training data, fits it very well, and predicts new data poorly. **Underfitting**: the model is too simple to capture the pattern.

Total out-of-sample error = **bias error** (underfitting) + **variance error** (overfitting) + base (irreducible) error. More complexity lowers bias but raises variance.

Remedies: **simpler models** and **regularization** (penalizing complexity), and **cross-validation**: split data into training, validation and test sets; **k-fold cross-validation** rotates which slice is held out. Judge models on performance on data they haven't seen.

## Supervised ML algorithms
@id ml-supervised
@r 3
@aka penalized regression; LASSO; ridge regression; support vector machine; SVM; k nearest neighbor; KNN; CART; classification and regression tree; decision tree; random forest; ensemble learning; bagging; boosting
@see ml-types; overfitting; logistic-regression

| Algorithm | Idea | Typical use |
|---|---|---|
| Penalized regression (e.g. **LASSO**) | Adds a penalty for the number or size of coefficients, shrinking weak ones to zero | Picking a few useful predictors from many |
| **Support vector machine** | Finds the boundary with the widest margin between classes | Classification (e.g. default vs no default) |
| **k-nearest neighbour** | Classifies by the majority of the k most similar observations | Classification; needs a sensible distance measure and k |
| **CART** (decision tree) | Splits data by the feature that best separates outcomes, repeatedly | Interpretable rules; prone to overfitting without pruning |
| **Ensemble / random forest** | Combines many models (e.g. many trees on random subsets) and votes | Better accuracy, less overfitting; less interpretable |

## Unsupervised ML algorithms
@id ml-unsupervised
@r 3
@aka principal components analysis; PCA; dimension reduction; k means clustering; hierarchical clustering; dendrogram; clustering stocks; eigenvectors
@see ml-types

- **Principal components analysis (PCA)**: turns many correlated variables into a few uncorrelated **components** that explain most of the variance. Used to reduce dimensions, e.g. summarizing yield curve moves as level, slope and curvature. Components are hard to interpret.
- **k-means clustering**: assigns observations to k clusters around centroids, iterating until stable. You must choose k.
- **Hierarchical clustering**: builds a tree of clusters bottom-up (agglomerative) or top-down (divisive), shown as a **dendrogram**; no k needed up front.

> **At work** Clustering stocks by return behaviour rather than industry labels can reveal hidden concentrations in a "diversified" portfolio.

## Neural networks and deep learning
@id neural-networks
@r 3
@aka neural network; hidden layers; activation function; deep neural network; backpropagation; reinforcement learning
@see ml-types

A **neural network** has an input layer, one or more **hidden layers** of nodes, and an output layer. Each node computes a weighted sum of its inputs and applies a non-linear **activation function**; weights are learned by **backpropagation** to minimize error. Networks with many hidden layers are **deep learning** networks, powerful for images, speech and text but data-hungry and hard to interpret.

## Big data project steps
@id big-data-project
@r 4
@aka data analysis project steps; conceptualization; data collection; data preparation; data wrangling; data exploration; model training; structured vs unstructured data; ML workflow
@see data-cleansing; text-processing; model-evaluation

Steps for a project using **structured** data (tables) and **unstructured** data (text):

1. **Conceptualize** the task: the question, inputs, outputs, how the result will be used.
2. **Collect** data (internal, vendors, web scraping, APIs).
3. **Prepare and wrangle**: clean errors, handle missing values and outliers, transform and scale.
4. **Explore**: summary statistics and visuals, then **feature selection** and **feature engineering**.
5. **Train** the model: choose the method, train, evaluate, tune.

For text, steps 3–4 become text preparation (cleansing, tokenization) and text exploration.

## Data cleansing and wrangling
@id data-cleansing
@r 4
@aka data cleansing; data wrangling; incomplete data; invalid data; inaccurate data; inconsistent data; non uniform data; duplicate data; normalization; standardization; scaling; trimming; winsorization
@see big-data-project; text-processing

**Cleansing** fixes errors: incompleteness (missing values), invalidity (outside allowed range), inaccuracy, inconsistency, non-uniformity (formats), and duplication.

**Wrangling (preprocessing)** transforms data for the model: extraction (new variables from existing ones, e.g. age from date of birth), aggregation, filtration, selection, conversion, and handling outliers (**trimming** removes them, **winsorization** replaces them with cut-off values). **Scaling**: **normalization** to [0, 1] with \((X - X_{min})/(X_{max} - X_{min})\) (sensitive to outliers), or **standardization** \((X - \mu)/\sigma\) (assumes roughly normal data).

## Text processing for financial data
@id text-processing
@r 4
@aka text mining; NLP preprocessing; tokenization; stop words; stemming; lemmatization; bag of words; BOW; n grams; document term matrix; term frequency; TF-IDF; sentiment analysis; word cloud
@see big-data-project; data-cleansing

Preparing text:

- **Cleansing**: remove HTML tags, punctuation, numbers (or replace with tokens), extra white space.
- **Normalizing**: lowercase, remove **stop words** ("the", "is"), **stemming** or **lemmatization** (reduce words to a root).
- **Tokenization**: split into words (tokens); **n-grams** keep multi-word phrases ("interest rate").
- **Bag of words** and a **document term matrix** (rows = documents, columns = tokens, cells = counts).

Exploring and selecting features: term frequency, document frequency, **TF-IDF** (frequency weighted by rarity across documents), chi-square tests and mutual information to choose informative words, and word clouds for visual checks.

## Model evaluation: confusion matrix, precision, recall, F1, ROC
@id model-evaluation
@r 4
@aka confusion matrix; precision; recall; accuracy; F1 score; ROC curve; AUC; area under the curve; true positive rate; false positive rate; RMSE model fit; model tuning; grid search
@see overfitting; ml-supervised

For classification, compare predictions with actual outcomes in a **confusion matrix** (true/false positives and negatives):

| Metric | Formula | Meaning |
|---|---|---|
| Precision | TP / (TP + FP) | Of predicted positives, how many were right |
| Recall (sensitivity) | TP / (TP + FN) | Of actual positives, how many were caught |
| Accuracy | (TP + TN) / total | Overall share right |
| F1 score | 2·P·R / (P + R) | Balance of precision and recall; useful for unequal classes |

The **ROC curve** plots the true positive rate against the false positive rate as the classification threshold changes; a larger **area under the curve (AUC)** is better (0.5 = random guessing). For continuous targets use RMSE. **Tuning** adjusts hyperparameters (e.g. by grid search) to balance bias and variance.
