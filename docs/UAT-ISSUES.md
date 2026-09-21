# Oven Xpress — Client UAT Issue Register

This register documents all issues, usability observations, requirement clarifications, training gaps, and enhancement requests identified during the Client User Acceptance Testing (Step 23) cycle.

---

## 1. Issue Classification Taxonomy

Every feedback item is formally classified into one of the following categories:
- **BUG**: System behaves differently from the defined business requirement or technical specification.
- **MISSING REQUIREMENT**: Required operational functionality does not exist in the current implementation.
- **USABILITY**: Functionality works as specified but is difficult, confusing, or prone to operator error.
- **ENHANCEMENT**: New capability requested by client stakeholders after evaluating working features.
- **TRAINING**: Existing functionality operates correctly, but end users require operational guidance.
- **BUSINESS RULE CLARIFICATION**: Ambiguity in business logic or approval hierarchies requiring stakeholder resolution.

### Severity Scale
- **P0**: System-, security-, or data-critical failure (data corruption, security bypass, crash).
- **P1**: Major workflow blocker preventing completion of core restaurant operations.
- **P2**: Important defect with operational impact but accessible workaround.
- **P3**: Minor cosmetic or non-blocking usability issue.
- **Enhancement**: Non-defect feature request.
- **Training**: Educational/documentation clarification.
- **Clarification**: Business rule confirmation.

---

## 2. Client UAT Issue Register

| ID | Area | Type | Description | Severity | Status | Owner |
|---|---|---|---|---|---|---|
| **ISS-01** | Inventory & Kitchen | BUG | Bill of Materials (BOM) stock consumption could execute multiple times under rapid double-click on order status transition to PREPARING. | P0 | **FIXED** | Core Engineering |
| **ISS-02** | Procurement | BUG | Purchase order line-item receiving allowed receiving more units than originally ordered if repeated over multiple receiving batches. | P1 | **FIXED** | Inventory Team |
| **ISS-03** | System Settings | BUG | `resetSetting` API parameter format mismatch (`string` vs `{ key, scope, branchId }`) prevented branch overrides from safely reverting to global defaults. | P2 | **FIXED** | Backend Team |
| **ISS-04** | POS / Payments | BUG | Multi-tender split payment modal accepted submission without validating whether the sum of tenders exactly equaled the net payable amount. | P1 | **FIXED** | POS Team |
| **ISS-05** | Inventory & Stock | USABILITY | Stock transfer selection modal did not clearly indicate current available stock of the source branch before initiating the transfer request. | P2 | **FIXED** | Frontend Team |
| **ISS-06** | Kitchen Display (KDS) | USABILITY | Ticket cards lacked high-contrast visual indicators for orders with special dietary notes or order prep time exceeding 20 minutes. | P3 | **FIXED** | Frontend Team |
| **ISS-07** | POS / Order Entry | USABILITY | Split payments did not auto-populate remaining balance into second tender input after first tender was entered. | P3 | **FIXED** | Frontend Team |
| **ISS-08** | Expenses | BUSINESS RULE CLARIFICATION | Ambiguity regarding whether Branch Managers have authority to approve petty cash expenses under ₹5,000 without Owner sign-off. | Clarification | **RESOLVED** | Product / Owner |
| **ISS-09** | Attendance | TRAINING | Managers attempted to manually record attendance for employees who already clocked in, causing unique constraint alerts. | Training | **RESOLVED** | Training Lead |
| **ISS-10** | Inventory Reconciliation | TRAINING | Store managers were unclear whether physical stock count variances directly overwrite inventory or log compensating adjustment transactions. | Training | **RESOLVED** | Operations Lead |
| **ISS-11** | Delivery Channel | MISSING REQUIREMENT | Client requested live 3rd-party courier tracking API integration (Dunzo/Swiggy/Zomato dispatch). | Enhancement | **DEFERRED (CR-01)** | Product Management |
| **ISS-12** | Customer Loyalty | ENHANCEMENT | Client requested automated SMS notification with coupon code on customer's 5th completed order. | Enhancement | **DEFERRED (CR-02)** | Product Management |
| **ISS-13** | Reporting & BI | ENHANCEMENT | Client requested scheduled daily PDF sales summary sent directly to Owner's WhatsApp number at 11:30 PM. | Enhancement | **DEFERRED (CR-03)** | Product Management |

---

## 3. Defect Resolution Summary

- **Total P0 Critical Issues Identified:** 1 (ISS-01) — **100% Fixed and Verified**
- **Total P1 Blocker Issues Identified:** 2 (ISS-02, ISS-04) — **100% Fixed and Verified**
- **Total P2 Important Issues Identified:** 2 (ISS-03, ISS-05) — **100% Fixed and Verified**
- **Total P3 Minor Issues Identified:** 2 (ISS-06, ISS-07) — **100% Fixed and Verified**
- **Total Unresolved P0 / P1 Defects:** 0
- **Total Enhancements Transferred to Change Request Register:** 3 (CR-01, CR-02, CR-03)
- **Total Training / Documentation Items Resolved:** 2 (ISS-09, ISS-10 — documented in `docs/USER-GUIDE.md`)
- **Total Business Rule Clarifications Resolved:** 1 (ISS-08 — confirmed branch petty cash threshold)

---

## 4. Verification & Regression Notes

Each fixed bug was verified using automated test suites:
1. `ISS-01` verified in `scripts/verify-client-uat.ts` (CUAT-11) and `scripts/verify-uat.ts` (Scenario 10).
2. `ISS-02` verified in `scripts/verify-client-uat.ts` (CUAT-07, CUAT-08) and `scripts/verify-uat.ts` (Scenario 8).
3. `ISS-03` verified in `scripts/verify-client-uat.ts` (CUAT-18, CUAT-19) and `scripts/verify-uat.ts` (Scenario 15).
4. `ISS-04` verified in `scripts/verify-client-uat.ts` (CUAT-14, CUAT-15) and `scripts/verify-uat.ts` (Scenario 11).
5. Multi-branch isolation and RBAC regression suites ran with 100% pass rate.
