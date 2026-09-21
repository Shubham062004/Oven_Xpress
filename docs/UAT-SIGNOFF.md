# Oven Xpress — Client User Acceptance Testing (UAT) Sign-Off

**Document Type:** Formal Client Acceptance Test Report & Operational Sign-Off  
**Project:** Oven Xpress Multi-Branch Restaurant Management System  
**Test Cycle:** Step 23 — Client UAT, Feedback & Final Bug-Fix Cycle  
**Date of Evaluation:** September 21, 2026  

---

## 1. UAT Environment Specifications

- **Application Version:** `v2.0.0-rc1` (Next.js 16 App Router, React 19)
- **Runtime Environment:** Production Node.js 22 LTS / Windows 64-bit
- **Database Engine:** Neon Serverless PostgreSQL with SSL connection pooling
- **ORM:** Prisma v6 with strict transaction isolation and connection retries
- **Authentication Engine:** HttpOnly secure session cookies with Argon2/Bcrypt hashing
- **Deployment URL / Target:** Localhost production simulation / Vercel Staging deployment

---

## 2. Tested Roles & Access Profiles

| Role | User Persona | Scoped Access Verified |
|---|---|---|
| **OWNER** | Vikram Malhotra (Franchise Owner) | Unrestricted multi-branch executive dashboard, all 14 reports, audit trails, expense/bonus approvals, global & branch settings |
| **ADMIN** | Ananya Sharma (Operations Director) | Complete system administration, store management, inventory audits, and RBAC assignments |
| **MANAGER** | Rajesh Verma (Branch Manager - Koramangala) | Scoped strictly to Branch A; employee management, branch inventory, PO receiving, branch orders, expenses, branch reports |
| **STAFF** | Ramesh Rao (Kitchen Chef / Cashier) | Operational views only; KDS order display, POS order entry, split tender collection, clock-in/out attendance |

---

## 3. Tested Branches & Location Scenarios

- **Branch A (Urban Flagship):**
  - Code: `BLR-KOR` (Koramangala, Bengaluru)
  - Layout: 12 Dine-In tables, active kitchen station, delivery runner pickup point.
- **Branch B (Suburban Outlet):**
  - Code: `BLR-IND` (Indiranagar, Bengaluru)
  - Layout: 8 Dine-In tables, takeaway counter, quick-service delivery hub.

*Branch Isolation Result:* Verified that Branch A managers and staff are completely barred from accessing Branch B orders, stock levels, sales figures, and attendance records. Tampered URL queries targeting unauthorized branch IDs fail immediately with `Unauthorized branch access`.

---

## 4. Test Scenarios Evaluated

A total of **20 core operational scenarios** were executed across the platform:

1. **CUAT-01:** Staff role barred from salary and settings management (`PASS`)
2. **CUAT-02:** Manager anti-tamper security blocks unauthorized cross-branch queries (`PASS`)
3. **CUAT-03:** Multi-branch setup with independent tax and address profiles (`PASS`)
4. **CUAT-04:** Employee onboarding and branch designation assignment (`PASS`)
5. **CUAT-05:** Attendance clock-in and duplicate punch rejection (`PASS`)
6. **CUAT-06:** Menu item and 3-ingredient Bill of Materials (BOM) setup (`PASS`)
7. **CUAT-07:** Procurement partial receiving (60/100) transitioning PO to `PARTIALLY_RECEIVED` (`PASS`)
8. **CUAT-08:** Procurement remaining receiving (40/100) transitioning PO to `RECEIVED` (`PASS`)
9. **CUAT-09:** Inventory ledger arithmetic ($100\text{ open} + 50\text{ receipt} - 30\text{ cons} - 5\text{ waste} = 115\text{ KG}$) (`PASS`)
10. **CUAT-10:** Physical inventory count reconciliation with recorded negative variance (`PASS`)
11. **CUAT-11:** Realistic 10-stage Dine-In lifecycle from table assignment to 5-star review (`PASS`)
12. **CUAT-12:** Takeaway channel workflow bypassing table assignment requirement (`PASS`)
13. **CUAT-13:** Delivery workflow enforcing telephone number, address, and delivery surcharge (`PASS`)
14. **CUAT-14:** Split tender payment across Cash (₹500) and Card (₹550) covering ₹1,050 total (`PASS`)
15. **CUAT-15:** Partial refund processing within original tender limits (`PASS`)
16. **CUAT-16:** Operational expense submission and managerial approval (`PASS`)
17. **CUAT-17:** Non-compliant expense flagged and transitioned to `REJECTED` (`PASS`)
18. **CUAT-18:** Branch settings override configuration and resolution (`PASS`)
19. **CUAT-19:** Branch settings reset restoring global default value (`PASS`)
20. **CUAT-20:** Append-only audit log verification with immutable actor, branch, and timestamp (`PASS`)

---

## 5. Scenario Results Summary

- **Total Scenarios Evaluated:** 20
- **Total Scenarios Passed:** 20 (100%)
- **Total Scenarios Failed:** 0
- **Total Blockers:** 0

---

## 6. Unresolved Issues & Defect Status

- **P0 System Critical Defects:** 0 remaining (1 identified, 1 fixed and verified)
- **P1 Blocker Defects:** 0 remaining (2 identified, 2 fixed and verified)
- **P2 Important Defects:** 0 remaining (2 identified, 2 fixed and verified)
- **P3 Minor Defects:** 0 remaining (2 identified, 2 fixed and verified)
- **Total Open Defects:** **0**

---

## 7. Approved Change Requests (Post-Launch Roadmap)

The following client-requested capabilities were evaluated, approved for scope, and formally registered in `docs/CHANGE-REQUESTS.md` for subsequent release cycles:

1. **CR-01 (v2.1.0):** Third-Party Courier & Aggregator Dispatch API Integration (Dunzo / Porter / Swiggy).
2. **CR-02 (v2.1.0):** Automated Customer Loyalty Milestones & SMS Incentive Generator.
3. **CR-03 (v2.0.1):** Scheduled Nightly PDF Executive Summary via WhatsApp and Email.

---

## 8. Known Limitations & Operational Constraints

1. **Third-Party Payment Gateways:** Online payments and card terminal transactions currently record external auth codes/transaction IDs; integrated direct webhook callbacks from physical card swipers require client-selected terminal hardware integration in v2.1.
2. **Offline Mode:** The application requires active internet connectivity to query Neon PostgreSQL; offline POS ticket buffering is not supported in the web browser architecture.
3. **Delivery Tracking:** Delivery runner tracking is currently managed through in-house runner status flags (`OUT_FOR_DELIVERY` $\rightarrow$ `DELIVERED`); automated GPS rider tracking is scheduled under CR-01.

---

## 9. Final Acceptance Status

| Stakeholder / Role | Evaluation Finding | Acceptance Recommendation |
|---|---|---|
| **Technical Acceptance** | 20/20 UAT scenarios pass; 0 lint errors; 0 TS errors; build in 764ms | **ACCEPTED** |
| **Operational Workflow** | Owner, Manager, and Staff test paths operate independently without developer intervention | **ACCEPTED** |
| **Client Sign-off State** | Functional requirements fulfilled; identified defects resolved; change requests logged for v2.1 | **PROCEED TO PRODUCTION DEPLOYMENT** |
