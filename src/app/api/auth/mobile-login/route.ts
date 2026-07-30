import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

const LEGACY_PERMISSIONS: Record<string, string[]> = {
    'SYSTEM_ADMIN': ['*'],
    'FINANCE_APPROVER': [
        'EXPENSES.VIEW_ALL', 'EXPENSES.APPROVE',
        'INVOICES.VIEW_ALL', 'INVOICES.VIEW', 'INVOICES.APPROVE',
        'PAYMENTS.AUTHORIZE',
        'ACCOUNTING.VIEW', 'LEDGER.VIEW', 'REPORTS.VIEW',
        'APPROVALS.VIEW', 'REQUISITIONS.APPROVE',
        'WALLET.VIEW', 'FINANCE.VIEW', 'BUDGETS.VIEW',
        'FORECASTING.VIEW', 'AUDIT.VIEW', 'ANALYTICS.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
        'BRANCHES.VIEW', 'REGIONS.VIEW',
    ],
    'FINANCE_TEAM': [
        'EXPENSES.VIEW_ALL',
        'INVOICES.VIEW_ALL', 'INVOICES.VIEW', 'INVOICES.CREATE',
        'PAYMENTS.CREATE_BATCH',
        'ACCOUNTING.VIEW', 'LEDGER.VIEW', 'REPORTS.VIEW',
        'APPROVALS.VIEW', 'REQUISITIONS.APPROVE',
        'WALLET.VIEW', 'FINANCE.VIEW', 'BUDGETS.VIEW',
        'FORECASTING.VIEW', 'AUDIT.VIEW', 'ANALYTICS.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
        'SALES.MANAGE',
    ],
    'MANAGER': [
        'EXPENSES.VIEW_TEAM', 'EXPENSES.APPROVE',
        'INVOICES.VIEW', 'INVOICES.VIEW_ALL',
        'REQUISITIONS.VIEW_TEAM', 'REQUISITIONS.APPROVE',
        'APPROVALS.VIEW',
        'WALLET.VIEW', 'BUDGETS.VIEW', 'AUDIT.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
    ],
    'REGIONAL_MANAGER': [
        'REQUISITIONS.VIEW_BRANCH', 'REQUISITIONS.APPROVE',
        'APPROVALS.VIEW',
        'BRANCHES.VIEW', 'REGIONS.VIEW',
        'BRANCH_WALLET.VIEW',
        'ANALYTICS.VIEW', 'REPORTS.VIEW',
        'EXPENSES.VIEW_TEAM',
    ],
    'TEAM_LEADER': [
        'REQUISITIONS.CREATE', 'REQUISITIONS.VIEW_OWN',
        'EXPENSES.VIEW_OWN', 'EXPENSES.CREATE',
        'BRANCH_WALLET.VIEW', 'BRANCH_WALLET.DISBURSE',
        'VENDORS.VIEW',
    ],
    'EMPLOYEE': [
        'EXPENSES.VIEW_OWN', 'EXPENSES.CREATE',
        'REQUISITIONS.VIEW_OWN', 'REQUISITIONS.CREATE',
    ],
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials format." }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        customRole: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    if (user.accountStatus === 'PENDING' || !user.isActive) {
      return NextResponse.json({ error: "Account is pending or inactive." }, { status: 403 });
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    let permissions: string[] = [];
    if (user.customRole) {
      permissions = user.customRole.permissions.map(rp =>
        `${rp.permission.resource}.${rp.permission.action}`
      );
    } else {
      permissions = LEGACY_PERMISSIONS[user.role] || [];
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      regionId: user.regionId,
      permissions
    };

    const token = jwt.sign(payload, process.env.AUTH_SECRET || "default_secret", {
      expiresIn: "7d"
    });

    return NextResponse.json({
      token,
      user: payload
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
