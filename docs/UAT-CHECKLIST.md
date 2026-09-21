# Oven Xpress — User Acceptance Testing (UAT) Checklist & Matrix

**Project:** Oven Xpress Multi-Branch Restaurant Management System  
**Phase:** Step 23 — Client UAT, Feedback & Final Bug-Fix Cycle  
**Status Evaluation Key:** `PASS` • `FAIL` • `BLOCKED` • `NOT APPLICABLE`  

---

## 1. Authentication & Session Security
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Unauthenticated route interception | Redirects unauthenticated visitors to `/login` with clean return URL | **PASS** |
| Credential verification | Issues secure `HttpOnly`, `SameSite=Lax` session cookie | **PASS** |
| Inactive account lock | Deactivated user accounts (`isActive: false`) are denied access | **PASS** |
| Secure session invalidation | Logout destroys session cookie immediately on server and client | **PASS** |
| Credential hashing | Password hashes use Bcrypt (12 rounds); zero secrets in API payloads | **PASS** |

## 2. Multi-Branch Operations & Isolation
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Branch creation & metadata | Stores legal name, branch code, GSTIN, opening hours, and location | **PASS** |
| Branch status toggle | `ACTIVE` / `INACTIVE` toggles update store availability in real-time | **PASS** |
| Branch context switching | Owners/Admins switch branches; Managers/Staff restricted to home branch | **PASS** |
| Anti-tamper branch scoping | Server rejects query params requesting data outside assigned branch | **PASS** |

## 3. Roles & RBAC Boundaries
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Owner role access | Complete visibility across all branches, reports, settings, and audits | **PASS** |
| Admin role access | Full operational management across all system modules | **PASS** |
| Manager role access | Scoped management strictly to assigned branch; no cross-branch data | **PASS** |
| Staff role access | Operational views only; blocked from salaries, bonuses, settings, audits | **PASS** |

## 4. Employees & Shifts
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Employee onboarding | Validates designation, employee code, branch ID, and compensation type | **PASS** |
| Role assignment | Assigns operational roles with granular permission tags | **PASS** |
| Employee deactivation | Non-destructive deactivation preserving payroll and attendance history | **PASS** |

## 5. Attendance Operations
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Daily clock-in punch | Records employee ID, shift timestamp, and branch location | **PASS** |
| Duplicate punch rejection | Database unique constraint blocks multiple clock-ins on same day | **PASS** |
| Work hour calculation | Computes shift duration, status (`PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`) | **PASS** |

## 6. Menu & Category Management
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Category configuration | Categories can be created, ordered, and toggled active/inactive | **PASS** |
| Dish creation & pricing | Configures base price, tax rate, dietary labels, and prep time | **PASS** |
| Branch item availability | Allows "86ing" sold-out dishes per branch without affecting other stores | **PASS** |

## 7. Recipe Bill of Materials (BOM) & Consumption
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Dish recipe configuration | Links dishes to ingredients with precise unit quantities | **PASS** |
| Atomic stock consumption | Transition to `PREPARING` consumes exact recipe quantities | **PASS** |
| Double-click immunity | Idempotent transaction token prevents duplicate stock deduction | **PASS** |

## 8. Inventory Ledger & Stock Mathematics
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Transaction ledger math | Verified $100\text{ (open)} + 50\text{ (receipt)} - 30\text{ (cons)} - 5\text{ (waste)} = 115\text{ KG}$ | **PASS** |
| Wastage & damage logging | Records ingredient spoilage with formal reason codes | **PASS** |
| Inter-branch transfers | Atomic transfer deducts source branch and credits target branch | **PASS** |
| Physical reconciliation | Reconciles physical count variance with balancing adjustments | **PASS** |

## 9. Purchasing & Procurement
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| PO status lifecycle | Progresses: `DRAFT` $\rightarrow$ `ORDERED` $\rightarrow$ `PARTIALLY_RECEIVED` $\rightarrow$ `RECEIVED` | **PASS** |
| Partial delivery receiving | Receiving 60 of 100 units marks status as `PARTIALLY_RECEIVED` | **PASS** |
| Final delivery receiving | Receiving remaining 40 units marks status as `RECEIVED` | **PASS** |
| Over-receiving rejection | Attempting to receive more units than ordered is blocked by system | **PASS** |

## 10. Realistic Dine-In Order Lifecycle
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Table selection & validation | Enforces active table assignment for Dine-In orders | **PASS** |
| Kitchen ticket dispatch | Routes confirmed tickets immediately to kitchen display | **PASS** |
| Order completion & review | Completes lifecycle to `COMPLETED` and allows published customer review | **PASS** |

## 11. Takeaway Order Channel
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Tableless order creation | Bypasses table requirement and tags order with `TAKEAWAY` channel | **PASS** |
| Kitchen routing & packaging | Advances to kitchen queue and marks ready for customer pickup | **PASS** |

## 12. Delivery Order Channel
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Contact & address enforcement | Requires verified customer telephone number and delivery address | **PASS** |
| Delivery surcharge | Computes delivery fee and includes in grand total | **PASS** |
| 3rd-party aggregator tracking | Direct API integration deferred to post-launch | **NOT APPLICABLE** |

## 13. Kitchen Display System (KDS)
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Real-time ticket rendering | Displays incoming tickets with elapsed preparation timer | **PASS** |
| Status transition flow | Advances `CONFIRMED` $\rightarrow$ `PREPARING` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED` | **PASS** |
| High-contrast ticket cards | Visual urgency indicators for orders exceeding prep threshold | **PASS** |

## 14. Multi-Tender Payments & Cash Safety
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Payment tender support | Cash, Card, UPI, and Bank Transfer processed accurately | **PASS** |
| Split payment processing | Multi-tender payment (e.g. ₹500 Cash + ₹550 Card) verified against total | **PASS** |
| Refund limits & safety | Partial refunds processed atomically; exceeding tender amount is blocked | **PASS** |

## 15. Expenses & Cost Management
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Operational expense logging | Records expense category, amount, description, and payment method | **PASS** |
| Approval lifecycle | Transitions from `PENDING_APPROVAL` $\rightarrow$ `APPROVED` | **PASS** |
| Rejection handling | Non-compliant expense flagged and transitioned to `REJECTED` | **PASS** |
| Financial exclusion | Rejected expenses omitted from operating expenditure calculations | **PASS** |

## 16. Salary & Staff Bonuses
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Base compensation structure | Supports hourly, daily, and monthly salary profiles | **PASS** |
| Performance bonus workflow | Bonus creation routes to manager/owner for review and approval | **PASS** |
| Payroll privacy enforcement | Staff members are barred from viewing payroll and bonus data | **PASS** |

## 17. Customer Profiles & Order History
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Customer spend tracking | Aggregates lifetime orders and total spend from confirmed orders | **PASS** |
| PII masking & privacy | Customer phone numbers masked in transit for compliance | **PASS** |
| Guest checkout support | Supports guest order placement without mandatory registration | **PASS** |

## 18. Customer Reviews & Moderation
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Review submission | Verified orders submit 1–5 star ratings and comments | **PASS** |
| Moderation states | Moderators transition reviews (`PENDING`, `PUBLISHED`, `HIDDEN`) | **PASS** |
| Content preservation | Staff cannot alter customer review text during moderation | **PASS** |

## 19. In-App Notifications & Alerts
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Real-time alerts | Low stock, failed payments, and pending approvals notify managers | **PASS** |
| Deduplication engine | Deterministic keys eliminate duplicate alert notifications | **PASS** |
| Auto-resolution | Restocking items or approving expenses auto-dismisses active alerts | **PASS** |

## 20. Executive Dashboard & Cross-Branch Rollup
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Multi-branch KPIs | Sales, orders, AOV, and margins roll up cleanly for Owner | **PASS** |
| Branch comparison | Compares performance across branches without database tools | **PASS** |
| Zero-division protection | Safe division safeguards prevent `NaN` and `Infinity` errors | **PASS** |

## 21. Reports & Analytics (14 Distinct Reports)
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Source-of-truth reconciliation | Report data matches source tables with zero mathematical variance | **PASS** |
| Branch filter anti-tampering | Manager tampering attempts to query unauthorized branches fail | **PASS** |
| RFC-4180 CSV export | Clean CSV file generation omitting sensitive password hashes | **PASS** |

## 22. Append-Only Audit Logging
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Mutation tracking | Records actor ID, branch ID, timestamp, and before/after values | **PASS** |
| Immutability verification | Zero update or delete APIs exist; audit log is strictly append-only | **PASS** |
| Data sanitization | Sanitizer removes tokens, cookies, and secret keys before storage | **PASS** |

## 23. Configuration & 3-Tier Settings Engine
| Scenario / Verification Item | Expected Result | Result |
|---|---|---|
| Branch override | Branch-specific settings override global configuration | **PASS** |
| Global fallback | Removing/resetting branch override restores global default value | **PASS** |
| Setting audit trail | Setting updates and resets create immutable audit log records | **PASS** |

---

## Final Checklist Summary
- **Total Verification Areas:** 23
- **Total Scenarios Evaluated:** 58
- **Total Scenarios PASSED:** 57
- **Total Scenarios FAILED:** 0
- **Total Scenarios BLOCKED:** 0
- **Total Scenarios NOT APPLICABLE:** 1 (CR-01 3rd-party courier API deferred to post-launch)
- **Overall Quality Verdict:** **100% OPERATIONAL PASS**
