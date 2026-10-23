MASTER PROJECT PROMPT: COMPLETE E-COMMERCE APPLICATION
PROJECT GOAL

Complete the existing e-commerce project into a fully functional, secure, production-ready application.

This is a complete project, not an MVP, prototype, demo, or partial implementation.

The application has three main roles:

Admin
Vendor
Customer

The existing project already has Cloudinary and the database configured. PhonePe is the intended payment gateway. Inspect the existing codebase and integrations before making changes.

Your responsibilities are to inspect, plan, implement, test, debug, optimize, document, and complete the entire application.

Critical requirement: Work phase by phase. Save project documentation after every phase so another AI model or developer can continue from the exact point where work stopped without losing context, repeating completed work, or damaging existing functionality.

PART 1 — NON-NEGOTIABLE DEVELOPMENT RULES
1. Preserve the Existing Project
Inspect the entire project before modifying files.
Identify the frontend, backend, framework, dependencies, database, authentication, API routes, integrations, and deployment configuration.
Reuse the existing architecture and working code.
Do not rewrite the application from scratch unless a change is demonstrably necessary.
Do not change frameworks, database providers, or major architectural components without a clear technical reason.
Preserve existing data, environment configuration, and working functionality.
Never delete files, data, migrations, or configurations without understanding their purpose.
Do not overwrite environment files or expose credentials.
Avoid unnecessary dependencies and unrelated features.
2. No Fake Functionality
Every required screen must be functional, not merely visually complete.
Connect forms, buttons, navigation, API calls, database operations, and status changes.
Do not leave placeholder buttons, hardcoded success responses, fake payments, or mock data in production workflows.
Use mock data only in explicitly isolated tests or development fixtures.
Do not claim that a feature works unless it has been verified.
3. Security First
Enforce authorization on the server, not just in the frontend.
Protect admin, vendor, and customer data with appropriate role-based permissions.
Never expose database credentials, PhonePe secrets, Cloudinary secrets, or private API keys in client code.
Validate all inputs and sensitive operations.
Protect against unauthorized resource access, duplicate requests, and insecure payment handling.
Keep customer information private.
4. Quality and Performance
Optimize queries, pagination, image loading, API calls, and frontend rendering.
Handle network errors, loading states, retries, and unexpected failures.
Maintain data consistency during checkout, payments, stock changes, cancellations, and refunds.
Use maintainable code, consistent naming, and appropriate error handling.
Test every important workflow after making changes.
5. Phase Completion Rules

At the end of every phase:

Run the applicable build, lint, type-check, and test commands.
Fix errors introduced by the current changes.
Verify completed functionality.
Update project documentation.
Update the task tracker.
Record known bugs and unresolved issues.
Save the exact next steps for the next phase.
Confirm that the project remains in a recoverable state.

Do not begin a large number of later-phase features while foundational work is broken.

PART 2 — CROSS-AI CONTINUITY AND PROJECT MEMORY

This section is mandatory. It ensures that changing AI models does not disrupt development.

Create and maintain the following files in the project repository. If equivalent documentation already exists, inspect and update it instead of creating duplicates.

A. PROJECT_MASTER.md

This is the permanent source of truth for the project.

Include:

Project purpose and complete requirements.
Technology stack and architecture.
Directory and file structure.
Application entry points.
Admin, Vendor, and Customer roles.
Authentication and authorization design.
Database technology, schema, relationships, and migrations.
API routes and endpoint conventions.
Cloudinary integration details, excluding secrets.
PhonePe integration status and relevant documentation.
Product approval and publishing rules.
Inventory and stock management rules.
Order, shipment, delivery, cancellation, and refund workflows.
Security requirements.
Performance requirements.
Environment variable names, without their secret values.
Development, testing, build, and deployment commands.
Architectural decisions and the reasons behind them.
All completed, incomplete, and planned functionality.
B. PROGRESS.md

Update this file after every meaningful development session.

Record:

Current phase and subtask.
Last completed task.
Files created, changed, or deleted.
Features implemented.
Tests executed and their results.
Build and lint status.
Current bugs and blockers.
Database or migration changes.
Any integration configuration still required.
Exact next task to perform.
The next recommended command or verification step.

Use clear statuses: NOT STARTED, IN PROGRESS, BLOCKED, COMPLETED, and VERIFIED.

A task is not VERIFIED merely because code has been written.

C. TASK_TRACKER.md

Create a checklist covering every phase, screen, backend feature, integration, security requirement, and test.

Each item must include:

Unique task ID.
Description.
Dependencies.
Status.
Files or components involved.
Verification criteria.
Known issues, if any.

Preserve task IDs between AI sessions.

D. ARCHITECTURE.md

Document:

Frontend and backend structure.
Main modules and their responsibilities.
Data flow between screens, APIs, and database.
Authentication and authorization boundaries.
Payment and order lifecycle.
Inventory consistency strategy.
External integrations.
Error handling and logging strategy.
Important architectural decisions.
E. DATABASE_SCHEMA.md

Document:

Models or tables.
Fields and data types.
Primary and foreign keys.
Relationships.
Indexes and constraints.
Status enums and transitions.
Migration history.
Inventory, order, payment, and refund consistency rules.

Never place actual passwords, private keys, access tokens, or payment credentials in documentation.

F. API_DOCUMENTATION.md

Document all relevant API endpoints, methods, authentication requirements, request validation, response formats, error handling, and role permissions.

G. TEST_REPORT.md

Maintain test coverage and results, including:

Commands executed.
Unit and integration test results.
End-to-end workflow results.
Security checks.
Build and lint results.
Failed tests and fixes.
Remaining untested scenarios.
H. CHANGELOG.md

Record meaningful changes by phase, including schema changes, dependencies, integration changes, bug fixes, and important architectural decisions.

AI SESSION HANDOVER RULE

At the beginning of every new AI session:

Read PROJECT_MASTER.md.
Read PROGRESS.md.
Read TASK_TRACKER.md.
Read ARCHITECTURE.md.
Read the relevant database, API, and test documentation.
Inspect the actual code and Git status.
Compare the documentation against the code.
Identify the last verified task and any uncommitted or incomplete work.
Continue from the next incomplete task.

Do not assume the previous AI finished a task simply because the documentation says it did. Verify the actual implementation before making dependent changes.

Do not restart completed phases without a demonstrated need.

If a required document is missing, create it using verified information from the existing codebase. Clearly label anything that remains uncertain.

PHASE 0 — PROJECT DISCOVERY AND BASELINE AUDIT
Objective

Understand the complete existing project before changing anything.

Tasks
Inspect the complete repository and directory structure.
Identify the frontend, backend, database, frameworks, and package manager.
Identify all existing screens, routes, API endpoints, and components.
Inspect authentication, role management, and access control.
Inspect the database schema, migrations, and existing data assumptions.
Inspect Cloudinary configuration and current upload implementation.
Inspect PhonePe integration and its current API version or integration approach.
Identify existing product, inventory, cart, order, payment, shipping, and refund logic.
Check existing validation, error handling, logging, and testing.
Run the existing build, lint, type-check, and test commands where possible.
Identify broken screens, dead links, missing APIs, placeholders, security issues, and incomplete workflows.
Identify any destructive migration or deployment risks.
Deliverables
PROJECT_MASTER.md
PROGRESS.md
TASK_TRACKER.md
ARCHITECTURE.md
Initial DATABASE_SCHEMA.md
Initial API_DOCUMENTATION.md
Initial TEST_REPORT.md
Completion Criteria

The existing architecture and major risks are documented. The baseline build and test status is recorded.

Do not perform large refactors during discovery.

PHASE 1 — IMPLEMENTATION PLAN AND FOUNDATION
Objective

Prepare the project for safe, systematic implementation.

Tasks
Build a complete dependency map for the required features.
Identify existing reusable components and services.
Establish consistent validation, error handling, logging, and API conventions.
Confirm environment configuration and secret-handling practices.
Identify database constraints and migration requirements.
Plan authentication and role-based authorization.
Create or improve automated testing infrastructure as appropriate.
Establish a screen-by-screen implementation checklist.
Define valid state transitions for products, orders, payments, shipments, and refunds.
Define a safe development and rollback strategy.
Completion Criteria

Every major feature has an implementation plan, dependencies, and test criteria.

Do not introduce unnecessary architecture or infrastructure.

PHASE 2 — AUTHENTICATION, ROLES, AND SECURITY
Objective

Implement reliable authentication and permissions for all three user roles.

Required Screens
Admin Login.
Vendor Login.
Customer Login.
Customer Registration.
Forgot Password.
Reset Password.
Logout and session handling.
Access Denied.
Appropriate unauthorized and expired-session states.

Create additional screens if required by the existing authentication architecture.

Backend Requirements
Secure password hashing.
Server-side role authorization.
Secure session or token handling.
Login validation and rate limiting.
Password reset token expiry and single-use validation.
Account status and authorization checks.
Protection against privilege escalation.
Ownership checks for vendor resources.
Customer-specific data access controls.
Secure cookie, CORS, and CSRF configuration where applicable.

Admin accounts must not be created through unrestricted public registration.

Tests

Verify valid and invalid logins, unauthorized access, expired sessions, password resets, role escalation attempts, and cross-vendor resource access.

Completion Criteria

All protected APIs enforce authorization on the server. Authentication and access-control tests pass.

PHASE 3 — DATABASE, BACKEND, AND API COMPLETION
Objective

Complete the backend required by the full application.

Required Functional Areas
Users, roles, vendors, and customer accounts.
Product and category management.
Product approval and rejection history.
Inventory and stock reservations where appropriate.
Cart and checkout.
Orders and order items.
Payments and transactions.
Refunds.
Shipments and delivery events.
Reviews and ratings.
Notifications.
Support requests and complaints.
Administrative audit logs.

Adapt the actual models and schema to the existing database. Do not create duplicate models unnecessarily.

Requirements
Input validation.
Correct database relationships.
Transactions or atomic operations for critical workflows.
Idempotency for payment and order operations.
Appropriate indexes and pagination.
Consistent API responses and error formats.
Safe migrations.
Historical records and traceability.
Ownership and permission checks.
Reliable logging without sensitive data.
Completion Criteria

The required backend operations persist and retrieve real data correctly. API tests cover critical paths and authorization rules.

PHASE 4 — ADMIN APPLICATION
Objective

Complete the administrative interface and workflows.

Required Screens
Admin Dashboard.
Product Approval Queue.
Product Review and Details.
Approved Products.
Rejected Products.
Category and Subcategory Management.
Vendor Management.
Customer Management.
Order Management.
Order Details.
Payment Management.
Refund Management.
Reviews and Complaints.
Reports and Analytics.
Notifications.
Administrative Settings, where applicable.

These are minimum functional areas. Add separate screens when required by the existing design or workflows.

Functionality
Approve or reject submitted products.
Record rejection reasons.
Publish approved products in their assigned categories.
Manage product visibility and availability.
Manage vendors and customers according to permissions.
Review orders, payment records, and refunds.
Investigate failed payments and fulfillment issues.
Search, filter, sort, and paginate records.
Record important administrative actions in audit logs.
Completion Criteria

All admin screens are connected to real APIs and database records. Unauthorized users cannot access admin functions.

PHASE 5 — VENDOR APPLICATION
Objective

Complete vendor product management, order processing, and delivery workflows.

Required Screens
Vendor Dashboard.
Product Listing.
Add Product.
Edit Product.
Product Details.
Pending Products.
Approved Products.
Rejected Products.
Inventory Management.
Order Listing.
Order Details.
Shipment Management.
Delivery Management and Tracking Updates.
Customer Reviews and Ratings.
Vendor Notifications.
Vendor Profile and Settings.
Earnings or Settlement Views, where supported by the business model.
Product Workflow
Vendors submit products for approval.
Products remain unpublished until approval.
Approved products become eligible for publication when otherwise valid and available.
Rejected products remain unpublished.
Vendors can see rejection reasons and resubmit corrected products.
All approval and stock changes are validated by the server.
Privacy Requirements

Vendors must not receive unnecessary customer details.

Use the minimum delivery information necessary for fulfillment. Mask contact information or use a privacy-preserving delivery process where supported. Enforce access controls on every API response.

Completion Criteria

Vendors can manage only their own authorized products and orders. Product and delivery status changes persist correctly.

PHASE 6 — CUSTOMER STOREFRONT
Objective

Complete the entire customer shopping experience.

Required Screens
Home Page.
Category and Subcategory Browsing.
Product Listings.
Search Results.
Product Filters and Sorting.
Product Details.
Shopping Cart.
Checkout.
Address Management.
Order Confirmation.
My Orders.
Order Details.
Shipment Tracking.
Delivery Tracking.
Reviews and Ratings.
Cancellation Requests.
Refund Requests.
Customer Profile and Settings.
Notifications.
Support and Issue Reporting.

Create separate screens where needed instead of hiding essential workflows in inaccessible or overloaded pages.

Functionality
Display only approved products that are eligible for sale.
Show accurate prices and availability.
Support search, categories, filters, and pagination.
Validate cart quantities and checkout data on the server.
Recheck prices and stock before order confirmation.
Prevent purchases of unavailable products.
Support order history and appropriate cancellation/refund actions.
Allow reviews only according to the defined review policy.
Show meaningful loading, empty, success, and failure states.
Completion Criteria

A customer can browse, purchase, review eligible products, and track orders through real backend operations.

PHASE 7 — CLOUDINARY AND PRODUCT MEDIA
Objective

Complete and verify the existing Cloudinary integration.

Tasks
Secure product image uploads.
Validate file type, size, and format.
Store the required image identifiers and URLs.
Support image previews, replacement, and removal.
Handle failed uploads and retries.
Optimize image sizes and loading.
Prevent unauthorized image modifications.
Clean up obsolete images when safe.
Preserve images referenced by historical or active records.
Avoid exposing privileged Cloudinary credentials.
Tests

Verify successful uploads, invalid files, oversized files, failed uploads, replacement, deletion, and unauthorized access.

Completion Criteria

Product media works throughout the vendor, admin, and customer workflows without broken references.

PHASE 8 — PHONEPE PAYMENT INTEGRATION
Objective

Complete and verify real PhonePe payment processing using the project's existing integration.

Tasks
Inspect the configured PhonePe API version and current implementation.
Verify the integration against the applicable official PhonePe documentation.
Complete server-side payment initiation.
Validate order amounts and currency on the server.
Verify payment results using the supported server-side status-checking mechanism.
Validate callbacks or webhooks according to the applicable API.
Persist transaction references and payment states.
Prevent duplicate orders and duplicate payment processing.
Handle successful, failed, pending, cancelled, timed-out, and delayed payments.
Implement safe retries and payment reconciliation.
Handle payment success followed by an interrupted browser session.
Synchronize verified payment results with order and inventory records.
Implement supported refund operations and status reconciliation.
Keep sandbox and production credentials separate.
Critical Requirements
Never trust frontend payment success alone.
Do not mark an order paid without verified payment evidence.
Do not release or fulfill an order based on an unverified payment status.
Do not assume a timeout means payment failure.
Do not create a second order when a customer retries the same payment flow.
Never store secrets in frontend code.
Use idempotency, transaction references, and reconciliation to handle repeated requests.
Tests

Test success, failure, pending status, delayed confirmation, duplicate callbacks, interrupted checkout, retry, and refund scenarios using the supported test environment.

Do not make real payments or issue real refunds without explicit authorization.

Completion Criteria

The complete payment lifecycle is verified in the supported test environment, with unresolved external configuration documented.

PHASE 9 — INVENTORY, ORDERS, AND MULTI-VENDOR FULFILLMENT
Objective

Ensure reliable order processing and stock consistency across the entire platform.

Tasks
Revalidate product status, price, and stock before order confirmation.
Use safe atomic inventory updates or reservation mechanisms.
Prevent overselling under concurrent purchases.
Record order items and vendor ownership correctly.
Support orders containing items from multiple vendors.
Track fulfillment independently for each vendor where necessary.
Maintain a consistent customer-facing order summary.
Prevent unauthorized changes to order status.
Handle stock changes after an item enters the cart.
Restore inventory only when business rules permit it.
Prevent duplicate stock restoration.
Maintain a traceable order status history.
Completion Criteria

Concurrent purchase tests and order consistency tests pass. Order and stock data remain correct when requests are retried or interrupted.

PHASE 10 — SHIPPING AND DELIVERY TRACKING
Objective

Complete vendor-managed fulfillment and customer tracking.

Tasks
Order acceptance and processing.
Packing and dispatch.
Shipment references and tracking details.
In-transit status.
Out-for-delivery status.
Delivered status.
Delivery failure and return handling.
Customer-facing tracking history.
Vendor-side delivery updates.
Appropriate notifications.
Timestamps and status history.
Protection against invalid status transitions.

If an actual courier API is configured, use its supported tracking integration. Otherwise, implement legitimate vendor-managed tracking updates without claiming live carrier tracking.

Completion Criteria

Customers see accurate shipment and delivery information. Vendor updates are validated and reflected consistently.

PHASE 11 — CANCELLATIONS, REFUNDS, AND EXCEPTION HANDLING
Objective

Handle all important failures and post-payment scenarios.

Scenarios
Product becomes unavailable after checkout begins.
Stock changes before order confirmation.
Payment succeeds but order processing is interrupted.
Payment remains pending.
Payment fails or times out.
Duplicate callbacks arrive.
Vendor cannot fulfill an order.
Customer cancels an eligible order.
Delivery fails or an order is returned.
A refund request fails or remains pending.
A refund succeeds but the client does not receive the response.
A vendor updates or removes a product after an order is placed.
Requirements
Apply consistent cancellation and refund eligibility rules.
Support partial and full refunds where appropriate.
Record refund reasons, amounts, references, and status history.
Prevent duplicate refunds.
Verify refund outcomes using the supported payment-provider process.
Reconcile order, payment, inventory, and refund records.
Notify customers of relevant changes.
Provide admin investigation tools for unresolved discrepancies.

Never mark a refund completed merely because a request was submitted. Never silently discard a successful payment because a later step failed.

Completion Criteria

All supported exception paths have defined recovery behavior and appropriate tests.

PHASE 12 — NOTIFICATIONS, REVIEWS, SUPPORT, AND REPORTING
Objective

Complete the remaining operational features.

Tasks
Product approval and rejection notifications.
Order and payment status notifications.
Shipment and delivery notifications.
Cancellation and refund notifications.
Customer reviews and ratings.
Review eligibility and abuse prevention.
Customer support and issue reporting.
Admin complaint handling.
Relevant dashboard summaries and reports.
Appropriate notification read/unread states.
Appropriate logging and audit history.

Implement email, SMS, push notifications, or other delivery channels only when supported by the existing configuration or explicitly approved integrations. Otherwise, implement the available in-app functionality and document remaining configuration.

Completion Criteria

Notifications and support workflows are connected to actual events and persisted data.

PHASE 13 — COMPLETE SCREEN AND ROUTE AUDIT
Objective

Ensure that no required screen, route, or critical interaction has been overlooked.

Tasks
Compare every existing route against TASK_TRACKER.md.
Compare every role against its required screens and permissions.
Inspect every form, button, link, menu, and important action.
Verify loading, empty, success, and error states.
Verify responsive layouts.
Check for broken navigation and inaccessible screens.
Confirm all critical screens are connected to real APIs.
Confirm no unauthorized role can access restricted screens or data.
Add missing screens and tests.
Update the final screen inventory with verified status.
Required Deliverable

Create SCREEN_INVENTORY.md with:

Screen ID.
Screen name.
User role.
Route.
Purpose.
Backend dependencies.
Permission requirements.
Implementation status.
Verification status.
Known issues.

The number of screens is determined by the actual application. Do not stop at an arbitrary screen count. Add every screen required by the business workflows.

Completion Criteria

Every required screen and route is accounted for, and all critical navigation and interactions are verified.

PHASE 14 — SECURITY, PERFORMANCE, AND ACCESSIBILITY AUDIT
Objective

Perform a final cross-application quality review.

Security
Authentication and authorization.
Vendor data isolation.
Customer privacy.
Input validation.
Secure file uploads.
Payment callback verification.
Secret management.
Rate limiting.
Protection against relevant web vulnerabilities.
Safe logging and error handling.
Dependency vulnerability review.
Performance
Database query optimization.
Appropriate indexes and pagination.
Image optimization.
Avoidance of duplicate API calls.
Frontend asset optimization.
Appropriate caching without leaking private data.
Handling of slow or unavailable services.
Reliable asynchronous operations.
Performance checks on important user journeys.
Accessibility and UI
Responsive design.
Keyboard navigation where appropriate.
Form labels and validation messages.
Adequate contrast and readable text.
Consistent navigation and component behavior.
Useful empty and error states.
Completion Criteria

Critical and high-priority findings are fixed or explicitly documented with a mitigation plan. Build and regression tests pass.

PHASE 15 — END-TO-END TESTING AND BUG FIXING
Objective

Verify the complete application as an integrated system.

Required User Journeys
Journey A: Product Approval

Vendor logs in → creates product → uploads images → submits product → admin reviews → approves or rejects → vendor sees the result → approved product becomes eligible for customer listings.

Journey B: Customer Purchase

Customer logs in → searches products → opens details → adds products to cart → checks out → verifies availability → pays through PhonePe → receives the correct order status.

Journey C: Vendor Fulfillment

Vendor sees an eligible order → processes it → ships the items → updates delivery progress → customer tracks the shipment → delivery is confirmed.

Journey D: Failed or Interrupted Payment

Customer starts checkout → payment becomes pending, fails, or succeeds while a request is interrupted → the application reconciles payment status without duplicate orders or incorrect fulfillment.

Journey E: Unavailable Product

Stock changes during checkout or a vendor cannot fulfill an item → the application prevents incorrect fulfillment → handles cancellation or refund according to the business rules.

Journey F: Refund

Eligible cancellation or refund request → admin or authorized process reviews it → refund is initiated → actual status is verified → records and notifications are updated correctly.

Journey G: Security

Attempt unauthorized access to admin routes, another vendor's products, another customer's orders, and restricted payment information. Verify that access is denied.

Additional Tests
Registration and password reset.
Concurrent purchases.
Duplicate submissions.
Repeated payment callbacks.
Cloudinary upload failures.
Delivery failure and return handling.
Invalid inputs.
Database interruption and recovery.
Responsive UI.
Search, filtering, pagination, and reviews.
Completion Criteria

Run available automated tests and end-to-end tests. Fix reproducible bugs and rerun affected tests. Clearly identify anything that could not be tested in the available environment.

PHASE 16 — DEPLOYMENT READINESS AND FINAL HANDOVER
Objective

Prepare the complete application for safe deployment and future maintenance.

Tasks
Run production build and relevant validation commands.
Verify environment configuration without exposing secrets.
Review database migrations and backup/rollback requirements.
Confirm production and test payment settings are separated.
Verify HTTPS, cookies, CORS, and security configuration where applicable.
Review logs and error reporting.
Verify deployment instructions.
Document external service configuration requirements.
Verify the project can be built and run using the documented steps.
Record known limitations and remaining work.
Update all continuity documents.
Final Deliverables
Completed application code.
PROJECT_MASTER.md
PROGRESS.md
TASK_TRACKER.md
ARCHITECTURE.md
DATABASE_SCHEMA.md
API_DOCUMENTATION.md
SCREEN_INVENTORY.md
TEST_REPORT.md
CHANGELOG.md
Environment variable template containing names and safe example placeholders, not actual secrets.
Build, testing, and deployment instructions.
Final Report

Provide a factual summary of:

Screens and routes implemented.
Backend APIs and integrations completed.
Database changes and migrations.
Authentication and security measures implemented.
PhonePe and Cloudinary verification results.
Build, lint, and test results.
Bugs fixed.
Known issues and unresolved risks.
External configuration still required.
Exact final project status and recommended next action.

Do not claim production readiness if critical security, payment, data consistency, or deployment checks remain unverified.

EXECUTION RULES FOR EVERY PHASE

Follow these instructions continuously:

Read the continuity documentation before starting work.
Inspect the relevant existing code before editing it.
Work on a manageable set of related tasks.
Avoid unnecessary rewrites.
Implement actual functionality, not just UI.
Run the relevant tests after changes.
Fix errors introduced by the changes.
Update PROGRESS.md, TASK_TRACKER.md, CHANGELOG.md, and other relevant documents.
Record changed files, test results, and unresolved issues.
Preserve existing user data and working functionality.
Do not mark untested work as verified.
Do not silently skip a requirement.
If a blocker occurs, document the exact cause and continue with independent tasks when safe.
If the context window is running out, finish a safe stopping point, update the handover documents, and state exactly where work should resume.
If the AI model changes, the new model must follow the AI SESSION HANDOVER RULE before editing code.
FINAL DIRECTIVE

Start with PHASE 0. Do not attempt to implement the entire application in one unstructured operation.

Complete each phase systematically, verify it, update the project documentation, and then proceed to the next phase. Continue through all phases until the full application has been implemented and verified to the extent supported by the environment.

The final goal is a complete, secure, maintainable, optimized e-commerce platform with fully functional Admin, Vendor, and Customer workflows; verified PhonePe payments; Cloudinary media management; accurate inventory; vendor-managed shipping; delivery tracking; refunds; comprehensive error handling; and documented continuity across AI sessions.