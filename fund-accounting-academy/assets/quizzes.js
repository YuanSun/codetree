/* Per-module self-check questions. a = index of the correct option. */
window.FAA_QUIZ = {
 "01": [
  {
   "q": "Which party is normally independent of the manager and strikes the official NAV?",
   "o": [
    "Prime broker",
    "Fund administrator",
    "Custodian",
    "Transfer agent"
   ],
   "a": 1,
   "w": "The administrator's value is independent books and NAV calculation."
  },
  {
   "q": "In a master–feeder structure, where are the portfolio's positions held?",
   "o": [
    "In each feeder",
    "In the master fund",
    "At the administrator",
    "At the auditor"
   ],
   "a": 1,
   "w": "Feeders invest in the master; the master holds positions and trades."
  },
  {
   "q": "Which fund type most needs a true daily NAV every day?",
   "o": [
    "Private equity",
    "Mutual fund / UCITS",
    "Closed-end real estate",
    "Venture"
   ],
   "a": 1,
   "w": "Open-ended regulated funds transact at daily NAV."
  },
  {
   "q": "Who holds title to assets and safekeeps them for long-only funds?",
   "o": [
    "Auditor",
    "Custodian",
    "GP",
    "Investor"
   ],
   "a": 1,
   "w": "The custodian safekeeps assets; the prime broker does that and financing for hedge funds."
  },
  {
   "q": "Why does dealing frequency matter to your workload?",
   "o": [
    "It sets the management fee",
    "The NAV must be exact on any day investors transact",
    "It changes the chart of accounts",
    "It decides the audit firm"
   ],
   "a": 1,
   "w": "A NAV used to deal must be right; non-dealing days can tolerate estimates."
  }
 ],
 "02": [
  {
   "q": "Which side increases an asset account?",
   "o": [
    "Credit",
    "Debit",
    "Either",
    "Neither"
   ],
   "a": 1,
   "w": "Debits increase assets and expenses; credits increase liabilities, equity and income."
  },
  {
   "q": "A fund buys a stock on Monday and cash leaves Tuesday (T+1). When is it booked?",
   "o": [
    "Tuesday",
    "Monday (trade date)",
    "Friday",
    "At month-end"
   ],
   "a": 1,
   "w": "Investment companies book on trade date; a payable covers the gap."
  },
  {
   "q": "When is a cash dividend on a held stock recognised?",
   "o": [
    "Pay date",
    "Record date",
    "Ex-dividend date",
    "Declaration date only"
   ],
   "a": 2,
   "w": "Recognise from ex-date; a receivable clears on pay date."
  },
  {
   "q": "When a position is sold at a gain, what happens to its previously recorded unrealized gain?",
   "o": [
    "It stays",
    "It is reversed and realized gain recorded",
    "It is deleted from the books entirely",
    "It becomes an expense"
   ],
   "a": 1,
   "w": "Total P&L is unchanged; classification moves from unrealized to realized."
  },
  {
   "q": "Which lot relief method sells highest-cost lots first?",
   "o": [
    "FIFO",
    "LIFO",
    "HIFO",
    "Average cost"
   ],
   "a": 2,
   "w": "HIFO relieves the highest-cost lots first, reducing realized gains."
  }
 ],
 "03": [
  {
   "q": "NAV is...",
   "o": [
    "Assets only",
    "Total assets at fair value minus total liabilities",
    "Cost of investments",
    "Cash balance"
   ],
   "a": 1,
   "w": "NAV = assets − liabilities, with assets at fair value."
  },
  {
   "q": "Your draft NAV is down 4% but the benchmark is up 0.5%. First step?",
   "o": [
    "Release it",
    "Look at P&L by position for the biggest movers and check prices, FX and corporate actions",
    "Increase the management fee",
    "Wait for month-end"
   ],
   "a": 1,
   "w": "Break the move down by position to find a bad price, missing CA, duplicate or FX error."
  },
  {
   "q": "Who sets the NAV-error materiality threshold?",
   "o": [
    "The fund accountant",
    "Fund policy / manager and board",
    "The broker",
    "The auditor only"
   ],
   "a": 1,
   "w": "It is policy; you apply and escalate."
  },
  {
   "q": "A discovered post-release error should be...",
   "o": [
    "Corrected silently if small",
    "Quantified, escalated, corrected visibly and documented",
    "Ignored if below 1%",
    "Fixed only at year end"
   ],
   "a": 1,
   "w": "Silent fixes are control failures."
  },
  {
   "q": "Which is a month-end-only activity?",
   "o": [
    "Pricing equities",
    "Running P&L allocation to investors and final fee calculation",
    "Booking trades",
    "Cash recon"
   ],
   "a": 1,
   "w": "Fees and allocations are usually run at dealing/month-end."
  }
 ],
 "04": [
  {
   "q": "A bond trades at clean price 99 with accrued interest 1.2. What do you pay?",
   "o": [
    "99",
    "100.2",
    "97.8",
    "101"
   ],
   "a": 1,
   "w": "Dirty = clean + accrued, i.e. 100.2 per 100 par."
  },
  {
   "q": "Which day count is typical for US corporate bonds?",
   "o": [
    "ACT/360",
    "30/360",
    "ACT/365",
    "ACT/ACT"
   ],
   "a": 1,
   "w": "US corporates, agencies and munis use 30/360."
  },
  {
   "q": "Futures initial margin is...",
   "o": [
    "An expense",
    "An asset held with the broker",
    "Income",
    "A liability to investors"
   ],
   "a": 1,
   "w": "It's collateral posted, not a cost."
  },
  {
   "q": "A short equity position pays what on the ex-date?",
   "o": [
    "Nothing",
    "The dividend to the lender",
    "Management fee",
    "Tax refund"
   ],
   "a": 1,
   "w": "A short seller owes the dividend (dividend on short)."
  },
  {
   "q": "A 2-for-1 stock split changes...",
   "o": [
    "Cost and quantity",
    "Quantity (doubles), price halves, total cost unchanged",
    "Realized P&L",
    "Nothing in the books"
   ],
   "a": 1,
   "w": "Cost basis is unchanged; quantity and per-share cost adjust."
  },
  {
   "q": "Written options create...",
   "o": [
    "An asset equal to premium",
    "A liability at fair value",
    "No entry",
    "Realized income immediately"
   ],
   "a": 1,
   "w": "Premium received creates a liability marked to fair value until closed or expired."
  }
 ],
 "05": [
  {
   "q": "A Level 1 input is...",
   "o": [
    "A model output",
    "A quoted price in an active market for an identical asset",
    "A broker indication",
    "An appraisal"
   ],
   "a": 1,
   "w": "Level 1 = unadjusted active-market quotes for identical assets."
  },
  {
   "q": "An evaluated bond price from a vendor using observable inputs is typically...",
   "o": [
    "Level 1",
    "Level 2",
    "Level 3",
    "Not classified"
   ],
   "a": 1,
   "w": "Observable but not directly quoted for the identical asset: Level 2."
  },
  {
   "q": "A UK stock quote in pence vs pounds is an example of...",
   "o": [
    "A corporate action",
    "A quote-unit trap",
    "A hedge",
    "Accrual"
   ],
   "a": 1,
   "w": "Always check quote units (GBp vs GBP)."
  },
  {
   "q": "What should you bring to a price challenge?",
   "o": [
    "An opinion",
    "Independent source evidence",
    "A guess",
    "Nothing"
   ],
   "a": 1,
   "w": "Challenge with independent source comparisons."
  },
  {
   "q": "The level in the hierarchy is set by...",
   "o": [
    "The highest input",
    "The lowest-level input that is significant",
    "The average level",
    "The manager's choice"
   ],
   "a": 1,
   "w": "Lowest significant input determines the level."
  }
 ],
 "06": [
  {
   "q": "Closing capital of all investors must equal...",
   "o": [
    "Fund NAV",
    "Fund cost",
    "Subscriptions",
    "Total fees"
   ],
   "a": 0,
   "w": "Capital accounts tie to NAV every dealing date."
  },
  {
   "q": "Redemptions payable are...",
   "o": [
    "Equity",
    "A liability that reduces NAV once the dealing-day redemption is struck",
    "Income",
    "An asset"
   ],
   "a": 1,
   "w": "The redeemed amount is a liability from the dealing date."
  },
  {
   "q": "Equalization exists to...",
   "o": [
    "Reduce fees",
    "Make each investor's performance fee reflect their own gain in a single NAV per share",
    "Change HWM",
    "Avoid audits"
   ],
   "a": 1,
   "w": "One NAV per share plus a mechanism for fee fairness."
  },
  {
   "q": "A gate limits...",
   "o": [
    "Subscriptions",
    "Total redemptions in a period",
    "Management fee",
    "Trading"
   ],
   "a": 1,
   "w": "Gates cap redemptions, carrying the excess forward."
  },
  {
   "q": "Hedged share class FX forward P&L is allocated to...",
   "o": [
    "All classes",
    "Only the hedged class",
    "The GP",
    "Expenses"
   ],
   "a": 1,
   "w": "Class-specific allocation."
  }
 ],
 "07": [
  {
   "q": "A soft hurdle means...",
   "o": [
    "Fee only on excess over hurdle",
    "Fee on all profit above HWM once hurdle is cleared",
    "No fee ever",
    "Fee on cost"
   ],
   "a": 1,
   "w": "Hard hurdle charges only the excess; soft charges all profit once cleared."
  },
  {
   "q": "HWM stops a fee until...",
   "o": [
    "Month end",
    "The NAV exceeds its previous highest level (after fees)",
    "The audit",
    "Redemption"
   ],
   "a": 1,
   "w": "Prior losses must be recovered first."
  },
  {
   "q": "In a European waterfall, which tier comes first?",
   "o": [
    "Carry split",
    "Return of capital to LPs",
    "GP catch-up",
    "Pref"
   ],
   "a": 1,
   "w": "Return of capital, then pref, catch-up, split."
  },
  {
   "q": "DPI measures...",
   "o": [
    "Unrealised value",
    "Distributions ÷ paid-in",
    "Net IRR",
    "Fee ratio"
   ],
   "a": 1,
   "w": "DPI = cash returned relative to paid-in."
  },
  {
   "q": "TVPI =",
   "o": [
    "DPI + RVPI",
    "DPI − RVPI",
    "NAV ÷ distributions",
    "IRR × years"
   ],
   "a": 0,
   "w": "TVPI = (distributions + NAV) ÷ paid-in."
  }
 ],
 "08": [
  {
   "q": "A cash break appears. What's best practice?",
   "o": [
    "Plug to a suspense account",
    "Classify cause, resolve with evidence, age and escalate",
    "Wait a month",
    "Ignore if small"
   ],
   "a": 1,
   "w": "Fix the cause and keep evidence."
  },
  {
   "q": "Four-eyes review means...",
   "o": [
    "Two people see it",
    "Preparer and approver are different people",
    "Four attachments",
    "Auditor review"
   ],
   "a": 1,
   "w": "Segregation: preparer ≠ approver."
  },
  {
   "q": "SOC 1 Type II reports on...",
   "o": [
    "Design only",
    "Design and operating effectiveness over a period",
    "Tax",
    "Only IT"
   ],
   "a": 1,
   "w": "Type II tests operation over time."
  },
  {
   "q": "Position recon to a custodian should use...",
   "o": [
    "Any date",
    "The same date and settle/trade basis as the statement",
    "Today",
    "Month-end only"
   ],
   "a": 1,
   "w": "Comparing different bases creates false breaks."
  },
  {
   "q": "A missed sign-off, with correct work, is...",
   "o": [
    "No issue",
    "A control deviation",
    "A bonus",
    "Immaterial"
   ],
   "a": 1,
   "w": "Evidence is part of the control."
  }
 ],
 "09": [
  {
   "q": "Which framework governs US investment company statements?",
   "o": [
    "ASC 946",
    "ASC 606",
    "IAS 2",
    "ASC 842"
   ],
   "a": 0,
   "w": "ASC 946 (Financial Services – Investment Companies)."
  },
  {
   "q": "The Schedule of Investments shows...",
   "o": [
    "Investor list",
    "Holdings at fair value with % of NAV",
    "Cash flows",
    "Fees only"
   ],
   "a": 1,
   "w": "It's the holdings schedule."
  },
  {
   "q": "A PBC list is...",
   "o": [
    "Provided By Client items for the auditor",
    "A bond type",
    "A fee",
    "A broker file"
   ],
   "a": 0,
   "w": "Documents the client provides to the auditor."
  },
  {
   "q": "Financial highlights include...",
   "o": [
    "Total return and expense ratios",
    "Cash receipts",
    "Trial balance",
    "Trade list"
   ],
   "a": 0,
   "w": "Highlights present return and ratio data."
  },
  {
   "q": "Subsequent events are...",
   "o": [
    "Events before year end",
    "Events after year end that may require disclosure",
    "Trades next day",
    "Fees"
   ],
   "a": 1,
   "w": "After the balance sheet date but before issuance."
  }
 ],
 "10": [
  {
   "q": "In Geneva, positions, lots and P&L are derived from...",
   "o": [
    "Manual position edits",
    "Transactions plus prices and FX",
    "The security master alone",
    "Reports"
   ],
   "a": 1,
   "w": "Transactions are the source of truth."
  },
  {
   "q": "Effective date is...",
   "o": [
    "When the system learned of it",
    "When the event economically happened",
    "When it was deleted",
    "Settlement lag"
   ],
   "a": 1,
   "w": "Effective date places the transaction in an accounting period."
  },
  {
   "q": "Knowledge date lets you...",
   "o": [
    "Change FX rates",
    "See what the system knew as of a point in time",
    "Delete audit trails",
    "Skip reconciliation"
   ],
   "a": 1,
   "w": "Bitemporal reporting reproduces past released reports."
  },
  {
   "q": "Why are Geneva report and menu names not covered precisely here?",
   "o": [
    "They don't exist",
    "They vary by firm configuration and version",
    "They are secret",
    "They never change"
   ],
   "a": 1,
   "w": "Verify locally with your admin."
  },
  {
   "q": "Before correcting a transaction you should...",
   "o": [
    "Check the audit trail and period status",
    "Overwrite quietly",
    "Delete the portfolio",
    "Skip approvals"
   ],
   "a": 0,
   "w": "Understand how the data got there, and whether the period is closed."
  }
 ],
 "11": [
  {
   "q": "Which comes first when fixing a back-dated error?",
   "o": [
    "Re-run allocations",
    "Fix upstream data (trades, prices, CAs), then recalc",
    "Close the period",
    "Send the NAV"
   ],
   "a": 1,
   "w": "Fix upstream, then recalc accruals, fees, allocation."
  },
  {
   "q": "Locking a closed period prevents...",
   "o": [
    "Reports",
    "Unauthorized late changes",
    "Pricing",
    "Reconciliation"
   ],
   "a": 1,
   "w": "Locks protect approved results."
  },
  {
   "q": "A good daily check on accruals is...",
   "o": [
    "Balance × rate × days basis",
    "Random",
    "Price × quantity",
    "Cash only"
   ],
   "a": 0,
   "w": "Recompute independently."
  },
  {
   "q": "Reports saved for release should record...",
   "o": [
    "The parameters including knowledge date",
    "Nothing",
    "Only totals",
    "The user's name only"
   ],
   "a": 0,
   "w": "Reproducibility requires parameters."
  },
  {
   "q": "A missed split most likely shows as...",
   "o": [
    "Cash difference",
    "Large P&L swing / position break",
    "Fee difference",
    "Nothing"
   ],
   "a": 1,
   "w": "Quantity and price mismatch cause a big move."
  }
 ],
 "12": [
  {
   "q": "A report differs from what was sent. First check?",
   "o": [
    "Knowledge date, period, basis",
    "Rewrite the report",
    "Delete data",
    "Email broker"
   ],
   "a": 0,
   "w": "Parameters explain most differences."
  },
  {
   "q": "Realized P&L looks wrong on a sale. Check...",
   "o": [
    "Lot relief method and lots relieved",
    "Phone number",
    "Client",
    "Report colour"
   ],
   "a": 0,
   "w": "Lot relief method drives realized."
  },
  {
   "q": "Capital accounts don't sum to NAV. Likely cause?",
   "o": [
    "Allocation run on stale data or late transaction",
    "Price source",
    "Day count",
    "Printer"
   ],
   "a": 0,
   "w": "Re-run allocation after upstream fixes."
  },
  {
   "q": "The best practice for editing a production report is...",
   "o": [
    "Overwrite it",
    "Copy, test on a known period, promote under change control",
    "Edit live",
    "Never change"
   ],
   "a": 1,
   "w": "Change control prevents silent breakage."
  },
  {
   "q": "Position breaks with identical share counts but different securities usually mean...",
   "o": [
    "Identifier mismatch",
    "Fee issue",
    "FX",
    "Accrual"
   ],
   "a": 0,
   "w": "Mapping CUSIP/ISIN/SEDOL/FIGI correctly resolves false breaks."
  }
 ],
 "13": [
  {
   "q": "A reviewer should begin by...",
   "o": [
    "Re-keying data",
    "Forming an expectation of the answer",
    "Signing off",
    "Closing the period"
   ],
   "a": 1,
   "w": "Expectation first makes anomalies visible."
  },
  {
   "q": "A good escalation includes...",
   "o": [
    "What, size, cause, proposed fix, deadline",
    "Blame",
    "Speculation",
    "Only the amount"
   ],
   "a": 0,
   "w": "Facts and a proposal."
  },
  {
   "q": "Materiality is...",
   "o": [
    "Only a number",
    "Quantitative and qualitative",
    "Set by the preparer",
    "Irrelevant"
   ],
   "a": 1,
   "w": "Qualitative factors matter too."
  },
  {
   "q": "You find the same break repeatedly. Do...",
   "o": [
    "Clear it each time",
    "Fix the root cause in the process",
    "Ignore",
    "Suppress it"
   ],
   "a": 1,
   "w": "Fix the cause, not the symptom."
  },
  {
   "q": "Tribal knowledge risk is reduced by...",
   "o": [
    "Documenting procedures",
    "Hiding them",
    "Verbal only",
    "Single owners"
   ],
   "a": 0,
   "w": "Document the things only one person knows."
  }
 ]
};
