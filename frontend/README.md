# Counterparty Insight

Build the FRONT-END FRAMEWORK and UX structure for an enterprise banking application called:

"Counterparty Risk Intelligence"

This is a bank counterparty-risk intelligence platform.

IMPORTANT:

At this stage, focus on creating a polished, highly professional WEBSITE FRAMEWORK and USER EXPERIENCE.

Do NOT attempt to build the complete risk calculation engine yet.

Do NOT over-engineer the backend.

Use realistic DEMO DATA and clearly structure the application so that real data, APIs, risk models and the relationship taxonomy can be connected later.

The application should look and feel like an institutional banking risk platform.

====================================================

1. CORE PURPOSE

====================================================

The application allows a bank analyst to search for a company/counterparty and understand:

- Who the company is

- Overall risk level

- Sources of risk

- Bank exposure

- Default risk

- Recovery risk

- Assets

- Counterparties

- Ownership structure

- Relationship network

- Contagion risk

- Potential scenarios

- Impact

- Required actions

- Evidence and data sources

The central concept is:

"How could risk from this counterparty affect the bank and other connected entities?"

====================================================

2. DESIGN STYLE

====================================================

Create a premium institutional banking interface.

Design inspiration:

- Modern bank risk dashboard

- Bloomberg-style information density

- Enterprise intelligence platform

- Credit risk workstation

- Relationship intelligence platform

Do NOT make it look like a generic SaaS dashboard.

Visual style:

- Professional

- Clean

- Sophisticated

- Data-rich

- Minimalistic

- Highly readable

- Desktop-first

- Responsive

Use a dark navy/charcoal sidebar and a light main workspace.

Risk colours should be used consistently:

LOW = green

MODERATE = yellow

HIGH = orange

CRITICAL = red

UNKNOWN = grey

Use colour primarily for risk communication, not decoration.

Use subtle shadows, borders, cards and whitespace.

====================================================

3. APPLICATION SHELL

====================================================

Create a permanent left-hand navigation sidebar.

Logo:

COUNTERPARTY

RISK INTELLIGENCE

Navigation:

1. Dashboard

2. Counterparties

3. Risk Overview

4. Relationship Graph

5. Exposure

6. Assets & Recovery

7. Contagion Risk

8. Scenarios

9. Early Warning Indicators

10. Evidence & Sources

11. Actions

12. Reports

13. Settings

Each navigation item should have a suitable icon.

The currently selected page must be visually highlighted.

====================================================

4. TOP HEADER

====================================================

Create a top header across the main content area.

Include:

LEFT:

Global search:

"Search company, LEI, customer ID, registration number..."

CENTER/RIGHT:

- As-of date

- Data freshness

- Alerts

- Notifications

- User profile

Example:

As of:

31 Aug 2026

Data status:

● Updated 2 hours ago

Add a global company search interaction.

When the user selects a company, all relevant pages should display that company.

====================================================

5. COUNTERPARTY SELECTOR

====================================================

Create a persistent company context bar beneath the header.

Example:

ABC INFRASTRUCTURE LTD

LEI: DEMO123456

India

Infrastructure

Corporate Banking Client

Risk:

HIGH

Relationship:

Borrower

Last Updated:

31 Aug 2026

Include a "Change Counterparty" button.

====================================================

6. MAIN DASHBOARD

====================================================

Create the primary Dashboard page.

This should be the most important page in the application.

Layout:

--------------------------------------------------

COUNTERPARTY RISK OVERVIEW

--------------------------------------------------

ABC INFRASTRUCTURE LTD

OVERALL RISK

72 / 100

HIGH RISK

[Risk Gauge]

Then create risk cards:

Credit Risk

HIGH

Default Risk

HIGH

Exposure Risk

HIGH

Contagion Risk

CRITICAL

Recovery Risk

MEDIUM

Country Risk

LOW

Sector Risk

HIGH

Operational Risk

MEDIUM

====================================================

7. RISK SOURCE VISUAL

====================================================

Create a large central visual called:

"Risk Source Map"

Place the company in the centre.

Around it show risk sources:

Credit

Default

Liquidity

Country

Sector

Ownership

Supplier

Customer

Funding

Operational

Legal

Collateral

Contagion

Use glowing circular nodes.

Node size should represent materiality.

Node colour should represent risk.

Connections should visually indicate the relationship.

This can initially use demo/static graph data.

The visual must be designed so that it can later be replaced by a real interactive graph.

====================================================

8. KEY RISK DRIVERS

====================================================

Create a section:

"Key Risk Drivers"

Example cards:

🔴 High connected exposure

"₹250 Cr exposure across connected entities."

🔴 Parent company deterioration

"Parent entity risk has increased over the last quarter."

🟠 Supplier concentration

"42% dependency on a critical supplier."

🟠 Collateral valuation decline

"Eligible collateral value has declined."

Each card should contain:

Risk

Severity

Short explanation

Impact

"View details"

====================================================

9. TOP ACTIONS

====================================================

Create:

"Priority Actions"

Example:

1. Review connected counterparty exposure

2. Assess parent company deterioration

3. Review supplier concentration

4. Revalue collateral

5. Run default contagion scenario

Each action should show:

Priority

Owner

Due date

Status

====================================================

10. COMPANY OVERVIEW PAGE

====================================================

Create a dedicated Company Overview page.

Use sections:

COMPANY IDENTITY

- Legal name

- LEI

- Registration number

- Country

- Incorporation date

- Industry

- Sector

- Parent

- UBO

- Public/private

BUSINESS PROFILE

- Revenue

- EBITDA

- Total assets

- Total liabilities

- Debt

- Cash

- Employees

RISK CRITICALITY

- Bank relationship criticality

- Sector criticality

- Operational criticality

- Systemic importance

- Substitutability

Use clean cards and tables.

====================================================

11. EXPOSURE PAGE

====================================================

Create an Exposure page.

Top cards:

Total Exposure

Funded Exposure

Unfunded Exposure

Potential Future Exposure

Collateral

Net Exposure

Below this create:

Exposure by Product

Exposure by Sector

Exposure by Country

Exposure by Maturity

Exposure by Connected Entity

Use charts with demo data.

Include filters:

Date

Product

Country

Sector

Entity

Currency

====================================================

12. ASSETS & RECOVERY PAGE

====================================================

Create:

"Assets & Recovery"

Top cards:

Total Assets

Eligible Collateral

Collateral Value

Haircut

Estimated Recovery

Recovery %

Create a recovery waterfall placeholder:

Gross Assets

↓

Haircuts

↓

Eligible Collateral

↓

Recovery Value

Create an asset table:

Asset

Type

Value

Currency

Ownership

Encumbrance

Collateral Value

Valuation Date

Recovery Priority

====================================================

13. RELATIONSHIP GRAPH PAGE

====================================================

Create a dedicated full-screen:

"Relationship Intelligence Graph"

This is a major component of the application.

Central entity:

ABC INFRASTRUCTURE LTD

Connected entities:

Parent

Subsidiary

UBO

Shareholder

Director

Bank

Supplier

Customer

Guarantor

Investor

Joint Venture

Service Provider

Country

Sector

Project

Collateral

Use different node types/icons.

Relationship examples:

OWNS

GUARANTEES

SUPPLIES

FUNDS

CUSTOMER OF

DIRECTOR OF

INVESTS IN

LOCATED IN

DEPENDS ON

Create controls above the graph:

[Relationship View]

[Exposure View]

[Risk View]

[Contagion View]

[Ownership View]

Filters:

All

Level 1

Level 2

Ancillary

Risk:

Low

Medium

High

Critical

Graph controls:

Zoom +

Zoom -

Fit to screen

Reset

Expand all

Collapse all

Clicking a node should open a right-side detail panel.

Clicking an edge should display:

Relationship

Relationship ID

Strength

Exposure

Risk relevance

Evidence

Source

Last updated

====================================================

14. CONTAGION RISK PAGE

====================================================

Create a dedicated:

"Contagion Risk"

page.

Header:

"If ABC Infrastructure Ltd. experiences financial distress, where could the risk travel?"

Create a visual network.

Central company → connected entities.

Show:

Transmission Path

Relationship

Exposure

Dependency

Potential Impact

Risk Level

Example:

ABC COMPANY

↓

Parent

↓

Bank

↓

Supplier

↓

Subsidiary

Use risk colours on nodes and connections.

====================================================

15. SCENARIO PAGE

====================================================

Create:

"Contagion & Stress Scenarios"

Scenario cards:

1. Counterparty Default

2. Severe Liquidity Stress

3. Parent Default

4. Subsidiary Default

5. Critical Supplier Failure

6. Major Customer Failure

7. Guarantor Failure

8. Collateral Value Shock

9. Country Stress

10. Sector Stress

11. Funding Market Disruption

12. Operational Provider Failure

Each scenario card contains:

Probability

Severity

Potential Impact

Affected Entities

Bank Exposure

Button:

"Run Scenario"

For now, clicking the scenario should populate a demo scenario analysis panel.

====================================================

16. SCENARIO RESULT VIEW

====================================================

Create a scenario result layout:

SCENARIO:

Counterparty Default

OVERALL IMPACT:

CRITICAL

Potential Bank Exposure:

₹XXX Cr

Potential Loss:

₹XX Cr

Estimated Recovery:

₹XX Cr

Affected Entities:

12

Create a visual:

DEFAULT

   ↓

COUNTERPARTY

   ↓

CONNECTED ENTITIES

   ↓

BANK IMPACT

Show:

Impact

Severity

Transmission path

Affected entity

Potential exposure

====================================================

17. EARLY WARNING PAGE

====================================================

Create:

"Early Warning Indicators"

Use a table.

Columns:

Indicator

Current

Previous

Trend

Threshold

Risk

Date

Status

Example indicators:

Rating downgrade

Leverage increase

Liquidity decline

Overdue receivables

Covenant breach

Exposure increase

Supplier concentration

Customer concentration

Parent deterioration

Collateral decline

Country deterioration

Sector stress

Use arrows for trends.

====================================================

18. EVIDENCE & SOURCES PAGE

====================================================

Create:

"Evidence & Sources"

This page establishes trust in the risk assessment.

Create source cards/table:

Source

Source Type

Date

Data Owner

Last Refreshed

Evidence

Confidence

Verification

Separate:

INTERNAL SOURCES

KYC

Customer Master

CRM

Loan Servicing

Credit Risk

Collateral Management

Payments

Trade Finance

Treasury

Procurement

EXTERNAL SOURCES

Company Registry

Regulatory Filing

Annual Report

Credit Rating

Market Data

Public Disclosure

Every major relationship/risk item should have:

"View Evidence"

====================================================

19. ACTIONS PAGE

====================================================

Create:

"Risk Actions"

Table:

Risk

Recommended Action

Priority

Owner

Due Date

Status

Statuses:

Open

In Progress

Pending Review

Completed

Escalated

Create buttons:

Assign

Edit

Complete

Escalate

====================================================

20. REPORTS PAGE

====================================================

Create a Reports page.

Report cards:

Counterparty Risk Report

Exposure Report

Relationship Report

Contagion Report

Stress Scenario Report

Risk Committee Pack

Each should have:

View

Generate

Export

At this framework stage, buttons can trigger a demo notification/modal.

====================================================

21. RISK DETAIL SIDE PANEL

====================================================

Create a reusable right-side drawer component.

Whenever a user clicks a risk, relationship, company or scenario, open the drawer.

Example:

CONTAGION RISK

Risk Level:

CRITICAL

Score:

82

Why?

• High connected exposure

• Common guarantor

• Material supplier dependency

Exposure:

₹250 Cr

Potential Impact:

High

Evidence:

3 sources

Last Updated:

31 Aug 2026

Actions:

View Evidence

View Graph

Run Scenario

====================================================

22. DATA MODEL FRAMEWORK

====================================================

Create frontend TypeScript interfaces/types for:

Company

Person

Entity

Relationship

Risk

RiskScore

Exposure

Asset

Collateral

Guarantee

Scenario

ScenarioImpact

Evidence

Source

RiskAction

EarlyWarningIndicator

RiskEvent

The relationship model must support:

relationship_id

taxonomy_id

level

category

type

entity_a

entity_b

definition

strength

exposure

dependency

risk_relevance

confidence

source

effective_date

last_refreshed

====================================================

23. EXCEL RELATIONSHIP TAXONOMY

====================================================

The framework must support:

LEVEL 1 relationships

LEVEL 2 relationships

ANCILLARY relationships

Do not hard-code the UI around only one relationship type.

The application must allow additional relationship types to be added later.

Important fields include:

Relationship ID

Relationship Category

Relationship Type

Relationship Definition

Entity A

Entity B

Internal Data Sources

External Data Sources

Evidence / Key Attributes

Regulatory / Risk Relevance

Data Refresh

Implementation Notes

====================================================

24. DEMO COMPANY

====================================================

Use a fictional company:

ABC Infrastructure Ltd.

Clearly label:

"DEMO DATA"

Create a realistic network around it:

ABC Infrastructure Ltd.

├── Parent Company

├── Subsidiary A

├── Subsidiary B

├── UBO

├── Shareholders

├── Bank

├── Supplier

├── Customer

├── Guarantor

├── Investor

├── Joint Venture

├── Logistics Provider

├── Insurance Provider

├── Country

└── Sector

Use enough demo relationships to make the graph visually meaningful.

====================================================

25. COMPONENT ARCHITECTURE

====================================================

Create reusable components:

RiskScoreCard

RiskGauge

RiskBadge

RiskSourceMap

RelationshipGraph

RelationshipNode

RelationshipEdge

EntityCard

ExposureCard

ExposureChart

RiskHeatmap

ScenarioCard

ScenarioResult

EvidencePanel

EvidenceTable

ActionCard

ActionTable

Timeline

DataFreshnessIndicator

CompanyHeader

CompanySelector

FilterBar

DetailDrawer

MetricCard

StatusBadge

Do not duplicate components unnecessarily.

====================================================

26. RESPONSIVENESS

====================================================

Primary target:

Desktop/laptop banking workstation.

Also support:

Tablet

Smaller screens

The graph should remain usable on smaller screens.

Tables should support horizontal scrolling.

Side panels should become full-screen modals on small screens.

====================================================

27. NAVIGATION

====================================================

All navigation items must work.

Create proper routes/pages.

Example:

/dashboard

/counterparties

/counterparty/:id

/risk

/relationships

/exposure

/assets

/contagion

/scenarios

/early-warning

/evidence

/actions

/reports

/settings

The user should be able to move between pages without losing the selected counterparty.

====================================================

28. DEMO INTERACTIONS

====================================================

Even though this is only the framework, make the UI feel functional.

Examples:

Click risk card → open risk detail drawer.

Click relationship node → open entity detail drawer.

Click relationship edge → show relationship details.

Click "Run Scenario" → show scenario result.

Click "View Evidence" → open evidence drawer.

Click "Change Counterparty" → show company selector.

Click filters → update demo visualisations.

Click graph mode → change the graph visualization.

====================================================

29. IMPORTANT UX PRINCIPLE

====================================================

The user should NEVER have to search through large amounts of information to understand the risk.

The application should answer visually:

"WHAT IS THE RISK?"

"WHY IS IT RISKY?"

"WHERE DOES THE RISK COME FROM?"

"WHO IS CONNECTED?"

"HOW MUCH ARE WE EXPOSED?"

"HOW CAN THE RISK SPREAD?"

"WHAT HAPPENS IF THERE IS A DEFAULT?"

"WHAT SHOULD WE DO?"

====================================================

30. FUTURE-READY ARCHITECTURE

====================================================

Design the framework so that the following can be connected later:

- Real bank data

- Customer Master

- KYC

- Credit systems

- Loan systems

- Collateral systems

- Payments

- Treasury

- Procurement

- External company data

- Regulatory data

- Credit ratings

- Market data

- Risk scoring models

- Graph database

- AI-assisted risk analysis

For now use demo data.

Clearly separate:

DEMO DATA

OBSERVED DATA

CALCULATED DATA

MODEL OUTPUT

ANALYST JUDGMENT

====================================================

31. FINAL ACCEPTANCE CRITERIA

====================================================

The first version is successful if:

1. The application looks like a professional banking risk platform.

2. The navigation is complete.

3. The Counterparty Dashboard is visually compelling.

4. The Risk Source Map is prominent.

5. The Relationship Graph is functional with demo data.

6. The Exposure page exists.

7. The Assets & Recovery page exists.

8. The Contagion page exists.

9. Scenario analysis has a working demo interaction.

10. Evidence is clearly linked to risks and relationships.

11. Risk Actions are visible.

12. All major pages have realistic demo data.

13. All major buttons/interactions work.

14. The application is structured so real data can be connected later.

15. The Excel relationship taxonomy can be incorporated without redesigning the application.

DO NOT build a simple static landing page.

Build the actual application shell and interactive prototype.

Prioritize:

UX architecture → navigation → information hierarchy → reusable components → visual risk framework → relationship graph → demo interactions.

## Development

This frontend is a React + Vite single-page app using React Router. Run `npm install` and `npm run dev` from `frontend/`. Run `npm run build` to create the deployable `dist/` folder. Configure your web server to fall back to `dist/index.html` for client-side routes.

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
