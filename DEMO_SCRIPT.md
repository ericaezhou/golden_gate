# Golden Gate Demo Script - Predicted Gaps & Answers

## PREDICTED GAPS THE LLM WILL IDENTIFY

### 1. **Missing Segment Thresholds**
**Files:** `loss_model.py` line 28-29, `segments.csv` rows 3-4
**Gap:** Subprime and deep_subprime thresholds are undefined (None, ???)

**Alice's Answer:**
"The actual thresholds are 18% for subprime and 28% for deep_subprime as of Q4 2024. But these aren't hardcoded because they change quarterly based on portfolio mix. After marketing campaigns or when we enter/exit markets, I recalculate them. The process is: look at the last 6 months of cohort performance, adjust for seasonal patterns, and set the threshold at the 75th percentile of recent defaults. I do this at quarter-end."

---

### 2. **Overlay Decision Criteria**
**Files:** `loss_model.py` line 12, `workflow.txt` lines 15-18
**Gap:** When and how to apply manual overlays - all marked as "see Alice"

**Alice's Answer:**
"I apply overlays based on three triggers:
1. If 30-day delinquency rate increases more than 15% month-over-month for any segment
2. If cohort variance exceeds 25% for 2+ consecutive months
3. If model staleness exceeds 30 days without recalibration

For sizing the overlay: every 10% increase in early delinquencies adds 1% to the loss forecast, capped at 5% total. For new products under 6 months old, I always add a 20% buffer on top of whatever the model says."

---

### 3. **Board Notification Threshold**
**Files:** `loss_model.py` line 23, `workflow.txt` line 9
**Gap:** Amount for board notification is unknown (???)

**Alice's Answer:**
"It's $10 million. The CFO told me this verbally back in June 2024, but it was never formalized in writing. Anything over $10M impact requires board notification, but the actual approval process is:
- Under $2M: I just document it
- $2M-$5M: Present at weekly Risk Committee meeting with cohort data
- Over $5M: Send email to CFO with model output and rationale - takes 3-5 business days for approval
- Over $10M: All of the above PLUS notify the board before implementation"

---

### 4. **4-Quarter vs 12-Quarter Lookback**
**Files:** `loss_model.py` line 6, `workflow.txt` lines 22-24
**Gap:** When to use 4q (current) vs 12q (policy) lookback period

**Alice's Answer:**
"Policy says always use 12 quarters, but I use the 4-quarter shortcut when conditions are stable. Specifically:
- If GDP growth is above 1.5% for 2+ consecutive quarters
- AND no Fed rate changes greater than 0.5% in the last 6 months
- AND unemployment delta is under 0.3%

When any of those conditions fail, I switch to the full 12-quarter lookback because it's more conservative during volatility. The difference is usually under 0.3%, but during a regime change it can be 1-2%, which matters a lot."

---

### 5. **New Product Buffer**
**Files:** `workflow.txt` line 17
**Gap:** Percentage buffer to add for new products (??? percent)

**Alice's Answer:**
"It's 20% for products under 6 months old. This is a flat buffer I add regardless of what the model says, because new products don't have enough performance history. The 20% comes from looking at historical performance - new cohorts typically underperform the model by 15-25% in their first 6 months, so 20% is the conservative middle ground."

---

### 6. **Cohort Variance Threshold**
**Files:** `workflow.txt` line 16
**Gap:** What variance percentage triggers action (???)

**Alice's Answer:**
"It's 25% variance from model forecast for 2 or more consecutive months. So if the model predicts 5% loss and we're seeing 6.25% or higher (25% above 5%), and that continues for 2 months, I apply an overlay. One month could be a fluke, but two months means something structural has changed."

---

### 7. **Delinquency Increase Threshold**
**Files:** `workflow.txt` line 15
**Gap:** What delinquency increase triggers overlay (??? percent)

**Alice's Answer:**
"15% month-over-month increase in 30-day delinquency rates. For example, if delinquencies go from 4% to 4.6% in one month, that's a 15% increase and I start considering an overlay. I track this by segment - if ANY segment hits this threshold, I investigate. Usually it's a leading indicator that losses will follow 2-3 months later."

---

### 8. **Quarterly Threshold Recalculation Process**
**Files:** `segments.csv` notes, workflow context
**Gap:** HOW thresholds change quarterly - process not documented

**Alice's Answer:**
"At the end of each quarter, I:
1. Pull the last 6 months of cohort performance data from the database
2. Segment by prime/near-prime/subprime/deep-subprime
3. Calculate the 75th percentile of actual default rates for each segment
4. Adjust for known seasonal patterns (e.g., Q4 is always higher due to holidays)
5. Set that as the new threshold for next quarter
6. Document the change in the Excel file (though I've been inconsistent about this)

Triggers for recalculation outside the quarterly schedule:
- Major marketing campaign that changes portfolio mix
- Entering or exiting a market segment
- Significant macro event (e.g., Fed rate change >1%)
- Risk Committee requests it"

---

### 9. **Escalation Timeline Details**
**Files:** Implied from workflow but not documented
**Gap:** How long each approval level takes

**Alice's Answer:**
"The full timeline for large adjustments ($5M+):
- Day 1-2: I prepare the memo with data, model output, and rationale
- Day 3: Present at weekly Risk Committee sync (Wednesdays at 10am)
- Day 3-5: Risk Committee reviews and provides feedback, I revise if needed
- Day 5-7: Email final memo to CFO for approval
- Day 7-10: CFO responds (usually takes 2-3 days, sometimes up to 5 if he's traveling)

Total: 3-5 business days if everything goes smoothly, up to 10 days if there are delays. For urgent situations, there's an expedited path: email the Risk Committee for async approval within 24 hours, then go straight to CFO."

---

## SUMMARY OF KEY NUMBERS

| Question | Answer |
|----------|--------|
| Subprime threshold? | 18% (as of Q4 2024, recalculated quarterly) |
| Deep subprime threshold? | 28% (as of Q4 2024, recalculated quarterly) |
| Overlay trigger - DQ increase? | 15% month-over-month |
| Overlay trigger - cohort variance? | 25% for 2+ months |
| Overlay sizing formula? | 1% per 10% DQ increase, capped at 5% |
| New product buffer? | 20% for products <6 months old |
| Board notification threshold? | $10 million impact |
| When to use 4q vs 12q? | 4q when GDP>1.5%, no major Fed moves, unemployment delta<0.3% |
| Escalation timeline? | 3-5 days standard, 1-2 days expedited |

---

## DEMO FLOW

1. **Upload Files** → System parses Python, CSV, TXT files
2. **Deep Dive Analysis** → LLM identifies 9 major knowledge gaps
3. **Question Generation** → System creates targeted questions about each gap
4. **Interview** → Alice answers questions, revealing the numbers and processes
5. **Package Creation** → System documents all the tacit knowledge
6. **Onboarding Agent** → New analyst can ask "What's the subprime threshold?" and get "18%, but it changes quarterly based on..."

---

## EXPECTED "WOW" MOMENTS

1. **Gap Discovery:** "Found 9 critical gaps where thresholds or processes are undefined"
2. **Smart Questions:** "I noticed in loss_model.py that subprime is None - what's the actual threshold you use?"
3. **Knowledge Extraction:** Alice mentions "25% cohort variance" → System captures it as a rule
4. **Context Awareness:** System asks follow-up: "You said 25% - is that for one month or multiple?"
5. **Final Output:** Complete documentation + AI agent that knows all Alice's rules