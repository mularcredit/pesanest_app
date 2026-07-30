# 🏢 Prudence Expense Management System - How It Works

## 📋 Table of Contents
1. [Overview](#overview)
2. [Business Model](#business-model)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Core Workflows](#core-workflows)
5. [Technical Architecture](#technical-architecture)
6. [Database Schema](#database-schema)
7. [Key Features](#key-features)

---

## Overview

**Prudence** is an enterprise-grade expense management system designed for companies that use a **Direct Payment Model**. Instead of reimbursing employees for expenses, the company pays vendors directly for employee-raised expenses.

### What Makes It Different?
- **Not a Reimbursement System**: Employees don't get paid back; vendors get paid directly
- **Purchase-to-Pay (P2P) Workflow**: Requisition → Approval → Invoice → Payment
- **Corporate Wallet System**: Pre-allocated funds for departments/branches
- **Multi-Level Approvals**: Manager → Finance → Executive approval chains

---

## Business Model

### The Direct Payment Flow

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│  Employee   │─────▶│   Manager    │─────▶│   Finance   │─────▶│    Vendor    │
│  Requests   │      │   Approves   │      │   Pays      │      │   Receives   │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
```

**Example Scenario:**
1. John (Sales Rep) needs to attend a conference
2. He creates a **Requisition** for $2,500 (hotel + airfare)
3. His manager **approves** the requisition
4. John books the hotel and flight
5. Vendor sends **invoice** to company
6. Finance team **records the invoice** in Prudence
7. Finance **pays the vendor directly** (not John)

---

## User Roles & Permissions

### 1. **EMPLOYEE** (Base Role)
- Submit expense requisitions
- Upload receipts
- Track personal expense history
- View wallet balance (if allocated)

### 2. **MANAGER**
- All employee permissions +
- Approve/reject subordinate requisitions
- View team expense reports
- Manage department budgets

### 3. **FINANCE_TEAM**
- Record vendor invoices
- Process payments
- Allocate wallet funds
- Generate financial reports

### 4. **FINANCE_APPROVER**
- All finance team permissions +
- Approve high-value expenses
- Final approval authority

### 5. **SYSTEM_ADMIN**
- Full system access
- User management
- Policy configuration
- System settings

### 6. **AUDITOR** (Read-Only)
- View all transactions
- Access audit trail
- Generate compliance reports

---

## Core Workflows

### Workflow 1: Requisition (Pre-Approval)

**Purpose**: Get approval BEFORE spending money

```typescript
// Employee creates requisition
POST /api/requisitions
{
  title: "Q3 Marketing Campaign",
  amount: 12000,
  category: "Marketing",
  businessJustification: "Increase brand awareness"
}

// Manager approves
POST /api/approvals
{
  requisitionId: "req_123",
  status: "APPROVED"
}
```

**States**: `DRAFT` → `PENDING` → `APPROVED` / `REJECTED`

---

### Workflow 2: Expense Submission

**Purpose**: Record actual spending (with receipt)

```typescript
// Employee submits expense
POST /api/expenses
{
  title: "Hilton Garden Inn",
  amount: 350,
  category: "Lodging",
  merchant: "Hilton",
  receiptUrl: "s3://receipts/abc123.pdf",
  requisitionId: "req_123" // Links to pre-approval
}
```

**States**: `DRAFT` → `SUBMITTED` → `APPROVED` → `PAID`

---

### Workflow 3: Invoice Management (NEW!)

**Purpose**: Record vendor bills for payment

```typescript
// Finance records vendor invoice
POST /api/invoices
{
  vendorId: "vendor_hilton",
  invoiceNumber: "INV-2024-001",
  amount: 350,
  dueDate: "2024-02-15",
  items: [
    { description: "Hotel Stay", quantity: 1, unitPrice: 350 }
  ]
}
```

**States**: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `PAID`

---

### Workflow 4: Payment Processing

**Purpose**: Pay vendors for approved expenses/invoices

```typescript
// Finance processes payment
POST /api/finance/pay
{
  expenseId: "exp_123",
  paymentMethod: "BANK_TRANSFER",
  vendorBankAccount: "****1234"
}
```

**Payment Methods**:
- `BANK_TRANSFER`: Direct bank payment
- `CHECK`: Physical check
- `WIRE`: Wire transfer
- `WALLET`: From corporate wallet

---

## Technical Architecture

### Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  Next.js 16 + TypeScript + Tailwind CSS + Framer Motion │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                  API Layer (Next.js)                     │
│         /api/expenses, /api/invoices, /api/auth         │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                   ORM (Prisma Client)                    │
│              Type-safe database queries                  │
└─────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────┐
│                      Database                            │
│  Dev: SQLite (dev.db) | Prod: PostgreSQL (Fly.io)       │
└─────────────────────────────────────────────────────────┘
```

### Key Directories

```
expense-system/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── dashboard/          # Main app pages
│   │   │   ├── expenses/       # Expense management
│   │   │   ├── requisitions/   # Pre-approvals
│   │   │   ├── invoices/       # Vendor invoices (NEW!)
│   │   │   ├── payments/       # Payment processing
│   │   │   ├── approvals/      # Approval queue
│   │   │   └── wallet/         # Corporate wallet
│   │   └── api/                # Backend API routes
│   ├── components/             # React components
│   │   ├── dashboard/          # Dashboard widgets
│   │   └── layout/             # Sidebar, Header
│   └── lib/                    # Utilities
│       ├── prisma.ts           # Database client
│       └── policy-engine.ts    # Business rules
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Test data
│   └── migrations/             # Database versions
└── public/                     # Static assets
```

---

## Database Schema

### Core Models

#### 1. **User**
```prisma
model User {
  id          String
  email       String   @unique
  name        String
  role        String   // EMPLOYEE, MANAGER, FINANCE_TEAM, etc.
  department  String?
  managerId   String?  // Hierarchical structure
  bankAccount String?  // For legacy reimbursements
}
```

#### 2. **Requisition** (Pre-Approval)
```prisma
model Requisition {
  id                     String
  userId                 String
  title                  String
  amount                 Float
  category               String
  businessJustification  String
  status                 String  // PENDING, APPROVED, REJECTED
  
  approvals              Approval[]
  expenses               Expense[]  // Linked actual expenses
}
```

#### 3. **Expense** (Actual Spending)
```prisma
model Expense {
  id             String
  userId         String
  requisitionId  String?   // Links to pre-approval
  title          String
  amount         Float
  merchant       String?   // Vendor name
  receiptUrl     String?
  status         String    // DRAFT, APPROVED, PAID
  paymentMethod  String    // PERSONAL_CARD, CORPORATE_CARD, WALLET
  isReimbursable Boolean   // Legacy field
}
```

#### 4. **Invoice** (Vendor Bills) 🆕
```prisma
model Invoice {
  id            String
  vendorId      String
  invoiceNumber String   @unique
  invoiceDate   DateTime
  dueDate       DateTime
  amount        Float
  status        String   // PENDING_APPROVAL, APPROVED, PAID
  paymentStatus String   // UNPAID, PARTIAL, PAID
  
  vendor        Vendor
  items         InvoiceLineItem[]
  approvals     Approval[]
}
```

#### 5. **Vendor**
```prisma
model Vendor {
  id           String
  name         String
  email        String?
  bankAccount  String?  // For payments
  paymentTerms String?  // Net 30, Net 60
  
  invoices     Invoice[]
}
```

#### 6. **Wallet** (Corporate Funds)
```prisma
model Wallet {
  id       String
  userId   String   @unique
  balance  Float
  currency String
  
  transactions WalletTransaction[]
}
```

#### 7. **Approval** (Workflow Engine)
```prisma
model Approval {
  id              String
  expenseId       String?
  requisitionId   String?
  invoiceId       String?  // NEW!
  approverId      String
  level           Int      // 1st level, 2nd level, etc.
  status          String   // PENDING, APPROVED, REJECTED
  comments        String?
}
```

---

## Key Features

### 1. 🎯 **Dashboard Analytics**
- Real-time expense tracking
- Monthly spending trends
- Approval queue status
- Budget vs. actual comparison

**Location**: `/dashboard`

---

### 2. 📝 **Requisition System**
- Pre-approval before spending
- Business justification required
- Multi-level approval routing
- Budget allocation tracking

**Location**: `/dashboard/requisitions`

**API**: `POST /api/requisitions`

---

### 3. 💰 **Corporate Wallet**
- Pre-allocated funds per employee/department
- Real-time balance tracking
- Transaction history
- Allocation by category (Travel, Meals, etc.)

**Location**: `/dashboard/wallet`

**API**: `POST /api/wallet/allocate`

---

### 4. 📄 **Invoice Management** 🆕
- Record vendor invoices
- Line-item tracking
- Due date monitoring
- Aging reports (overdue tracking)

**Location**: `/dashboard/invoices`

**API**: `POST /api/invoices`

**Features**:
- Upload invoice PDFs
- Link to requisitions (PO matching)
- Multi-line items with categories
- Automatic total calculation

---

### 5. 💳 **Payment Processing**
- Vendor payment queue
- Bulk payment support
- Payment method selection
- Payment history tracking

**Location**: `/dashboard/payments`

**API**: `POST /api/finance/pay`

---

### 6. ✅ **Approval Workflow**
- Role-based approval routing
- Multi-level approvals
- Delegation support
- Approval history

**Location**: `/dashboard/approvals`

**API**: `POST /api/approvals`

---

### 7. 📊 **Reporting & Analytics**
- Expense reports by category
- Department spending analysis
- Vendor spending analysis
- Budget forecasting

**Location**: `/dashboard/reports`

---

### 8. 👥 **Vendor Management**
- Vendor database
- Payment terms tracking
- Preferred vendor flagging
- Vendor performance metrics

**Location**: `/dashboard/vendors`

---

### 9. 🔒 **Policy Engine**
- Spending limits by role
- Category restrictions
- Receipt requirements
- Approval routing rules

**Location**: `src/lib/policy-engine.ts`

---

## Authentication & Security

### NextAuth.js Setup

```typescript
// src/auth.ts
export const authConfig = {
  providers: [CredentialsProvider],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    }
  }
}
```

**Protected Routes**: All `/dashboard/*` routes require authentication

**Role Checks**: Middleware validates user permissions for sensitive actions

---

## Environment Variables

```bash
# Database
DATABASE_URL="file:./prisma/dev.db"  # SQLite for dev
DATABASE_URL="postgresql://..."      # PostgreSQL for prod

# Authentication
AUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

# Payments (Optional)
STRIPE_SECRET_KEY="sk_test_..."
PESALINK_API_KEY="pl_test_..."
```

---

## Deployment

### Local Development
```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

### Production (Fly.io)
```bash
fly postgres create --name prudence-db
fly secrets set DATABASE_URL="postgresql://..."
fly deploy
```

**Note**: The `Dockerfile` automatically switches from SQLite to PostgreSQL during build!

---

## Test Accounts

```
Admin:    admin@expense.sys / admin123
Finance:  finance@expense.sys / finance123
Manager:  manager@expense.sys / manager123
Employee: john.doe@expense.sys / employee123
```

---

## Future Enhancements

### Planned Features
- [ ] OCR for receipt scanning
- [ ] Mobile app (React Native)
- [ ] Slack/Teams notifications
- [ ] Multi-currency support
- [ ] Vendor portal (self-service invoicing)
- [ ] AI-powered expense categorization
- [ ] Integration with accounting software (QuickBooks, Xero)

---

## Support & Documentation

- **Deployment Guide**: `DEPLOYMENT.md`
- **Design System**: `DESIGN_REVAMP.md`
- **API Documentation**: Coming soon
- **Troubleshooting**: Check `.next` cache if dev server hangs

---

**Built with ❤️ using Next.js, Prisma, and TypeScript**
