"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkEnforceClosure } from "@/lib/closure-check";
import { checkExpensePolicies } from "@/lib/policy-engine";
import { approvalWorkflow } from "@/lib/approval-workflow";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

const RequisitionItemSchema = z.object({
    title: z.string().min(3, "Item title must be at least 3 characters"),
    description: z.string().optional(),
    quantity: z.coerce.number().int().positive("Quantity must be positive"),
    unitPrice: z.coerce.number().positive("Unit price must be positive"),
    category: z.string().min(1, "Category is required"),
    isRecurring: z.boolean().optional(),
    frequency: z.string().optional(),
    startDate: z.string().optional(),
});

const RequisitionSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    description: z.string().min(15, "Justification must be at least 15 characters"),
    currency: z.string().default('KES'),
    items: z.array(RequisitionItemSchema).min(1, "At least one item is required"),
});

export async function createRequisitionWithItems(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    // Parse items from formData
    const itemsJson = formData.get("items") as string;
    const items = JSON.parse(itemsJson);

    const validatedFields = RequisitionSchema.safeParse({
        title: formData.get("title"),
        description: formData.get("description"),
        currency: formData.get("currency"),
        items,
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const closureCheck = await checkEnforceClosure(session.user.id);
    if (closureCheck.blocked) {
        return { message: closureCheck.message };
    }

    const { title, description, currency, items: validatedItems } = validatedFields.data;

    // Calculate total amount
    const totalAmount = validatedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Get the primary category (from first item or most expensive item)
    const primaryCategory = validatedItems.sort((a, b) =>
        (b.quantity * b.unitPrice) - (a.quantity * a.unitPrice)
    )[0].category;

    // Run Policy Checks
    const policyResult = await checkExpensePolicies({
        title,
        amount: totalAmount,
        category: primaryCategory,
        expenseDate: new Date(),
        userId: session.user.id
    });

    if (!policyResult.isValid) {
        const blockers = policyResult.violations.filter(v => v.isBlocking).map(v => v.message);
        if (blockers.length > 0) {
            return {
                message: `Policy Violation: ${blockers.join(", ")}`
            };
        }
    }

    let type = formData.get("type") as string || "STANDARD";
    const isSSCA = formData.get("isSSCA") === "true";
    const isStrictApproval = formData.get("isStrictApproval") === "true";

    if (isSSCA) {
        if ((session.user as any).role !== "SYSTEM_ADMIN") {
            return {
                message: "Unauthorized: Only System Administrators can create South Sudan Civil Aviation requests."
            };
        }
        type = isStrictApproval ? "SOUTH_SUDAN_STRICT" : "SOUTH_SUDAN";
    }

    // Fetch user for branch/region info
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, branchId: true, regionId: true, leadBranch: true }
    });

    // Note: the "branch" field on the form is a read-only display name (never a real
    // Branch id), so it must never be used to resolve branchId — only "branchId" (an
    // explicit id override, if one is ever wired up) or the user's own branch relations.
    const branchId = (formData.get("branchId") as string) || user?.branchId || user?.leadBranch?.id;
    const department = formData.get("department") as string;
    const vendor = formData.get("vendor") as string;
    const expectedDateStr = formData.get("expectedDate") as string;
    const paymentMethod = formData.get("paymentMethod") as string;
    let paymentReference = formData.get("paymentReference") as string;
    const paybillNumber = (formData.get("paybillNumber") as string) || "";
    const paybillAccountNumber = (formData.get("paybillAccountNumber") as string) || "";

    if (paymentMethod === "MPESA_PAYBILL" && paybillNumber) {
        paymentReference = `${paybillNumber}${paybillAccountNumber ? `|${paybillAccountNumber}` : ''}`;
    }
    const accountId = formData.get("accountId") as string;
    const receiptUrl = (formData.get("receiptUrl") as string) || null;

    let finalDescription = description;
    if (vendor && vendor.trim()) {
        finalDescription += `\n\n**Preferred Vendor:** ${vendor.trim()}`;
    }

    const expectedDate = expectedDateStr ? new Date(expectedDateStr) : undefined;

    // Calculate Next Run Date helper
    const calculateNextRun = (startDate: Date, frequency: string): Date => {
        const nextRun = new Date(startDate);
        switch (frequency) {
            case "DAILY": nextRun.setDate(nextRun.getDate() + 1); break;
            case "WEEKLY": nextRun.setDate(nextRun.getDate() + 7); break;
            case "MONTHLY": nextRun.setMonth(nextRun.getMonth() + 1); break;
            case "QUARTERLY": nextRun.setMonth(nextRun.getMonth() + 3); break;
            case "YEARLY": nextRun.setFullYear(nextRun.getFullYear() + 1); break;
        }
        return nextRun;
    };

    // Create requisition with items
    const requisition = await (prisma.requisition.create as any)({
        data: {
            userId: session.user.id,
            title,
            amount: totalAmount,
            currency,
            category: primaryCategory,
            description: finalDescription,
            businessJustification: finalDescription,
            status: "PENDING",
            type,
            branchId,
            department,
            expectedDate,
            ...(accountId ? { accountId } : {}),
            ...(paymentMethod ? { paymentMethod } : {}),
            ...(paymentReference ? { paymentReference } : {}),
            ...(receiptUrl ? { receiptUrl } : {}),
            items: {
                create: validatedItems.map(item => {
                    const isRecurring = item.isRecurring === true;
                    const startDate = item.startDate ? new Date(item.startDate) : new Date();
                    
                    return {
                        title: item.title,
                        description: item.description || "",
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.quantity * item.unitPrice,
                        category: item.category,
                        isRecurring: isRecurring,
                        ...(isRecurring && item.frequency ? {
                            schedule: {
                                create: {
                                    name: `Auto: ${item.title}`,
                                    frequency: item.frequency,
                                    startDate: startDate,
                                    nextRun: calculateNextRun(startDate, item.frequency),
                                    isActive: true,
                                    createdById: session!.user!.id!
                                }
                            }
                        } : {})
                    };
                })
            }
        },
    });

    // Resolve regionId for approval routing
    const userWithBranch = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { leadBranch: true }
    });
    const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;


    // Initiate Approval Workflow
    console.log(`[Requisition] Creating workflow for amount: ${totalAmount}, category: ${primaryCategory}`);
    const route = await approvalWorkflow.determineRoute(
        session.user.id,
        totalAmount,
        primaryCategory,
        false,
        type,
        userRegionId || undefined
    );

    console.log(`[Requisition] Route determined: ${route.autoApprove ? 'Auto-approve' : 'Levels: ' + route.levels.length}`);
    const approvals = await approvalWorkflow.createRequisitionApprovals(requisition.id, route);
    console.log(`[Requisition] Created ${approvals.length} approval records`);

    redirect("/dashboard/requisitions");
}

export async function addItemToRequisition(requisitionId: string, itemData: any) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    const validatedItem = RequisitionItemSchema.safeParse(itemData);

    if (!validatedItem.success) {
        return {
            errors: validatedItem.error.flatten().fieldErrors,
        };
    }

    const closureCheck = await checkEnforceClosure(session.user.id);

    const { title, description, quantity, unitPrice, category } = validatedItem.data;
    const totalPrice = quantity * unitPrice;

    try {
        if (!session?.user?.id) throw new Error("Unauthorized");

        // Fetch parent requisition to get type and currency
        const parentRequisition = await prisma.requisition.findUnique({
            where: { id: requisitionId },
            select: {
                type: true,
                currency: true,
                status: true
            }
        });

        if (!parentRequisition) {
            return { error: "Requisition not found" };
        }

        // Fetch user region
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { regionId: true, leadBranch: { select: { regionId: true } } }
        });
        const userRegionId = user?.regionId || user?.leadBranch?.regionId;

        // Determine Approval Route for this item
        // We reuse the main workflow engine but apply it to this specific item
        const route = await approvalWorkflow.determineRoute(
            session.user.id,
            totalPrice,
            category,
            false,
            parentRequisition.type, // Pass the parent's type (e.g. SOUTH_SUDAN)
            userRegionId || undefined
        );

        // Determine item status based on route
        // If the parent is already approved/paid, and this valid route says auto-approve (like SSCA), 
        // then we can approve immediately.
        // Otherwise, it starts as PENDING.
        const initialStatus = route.autoApprove ? 'APPROVED' : 'PENDING';

        // Create the new item with its specific status
        const newItem = await (prisma as any).requisitionItem.create({
            data: {
                requisitionId,
                title,
                description: description || "",
                quantity,
                unitPrice,
                totalPrice,
                category,
                isInitial: false,
                status: initialStatus,
                type: parentRequisition.type
            },
        });

        // Create Approval Records if not auto-approved
        if (!route.autoApprove) {
            for (const level of route.levels) {
                for (const approver of level.approvers) {
                    await (prisma as any).itemApproval.create({
                        data: {
                            requisitionItemId: newItem.id,
                            approverId: approver.id,
                            level: level.level,
                            status: 'PENDING'
                        }
                    });
                }
            }
        }

        // Recalculate total amount for the requisition details
        // Note: The main requisition status does NOT change back to PENDING.
        // The new item has its own independent lifecycle.
        const allItems = await (prisma as any).requisitionItem.findMany({
            where: { requisitionId },
        });

        const newTotalAmount = allItems.reduce((sum: number, item: any) => sum + item.totalPrice, 0);

        // Update requisition amount
        await (prisma as any).requisition.update({
            where: { id: requisitionId },
            data: { amount: newTotalAmount },
        });

        return { success: true, item: newItem };
    } catch (error) {
        console.error("Error adding item to requisition:", error);
        return { error: "Failed to add item" };
    }
}

export async function getEligibleRequisitions() {
    const session = await auth();
    if (!session?.user?.id) return [];

    try {
        const userId = session.user.id;

        // Check for System Admin role
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;

        // Fetch PENDING or APPROVED requisitions
        // Admins can see all, users see their own
        const whereClause: any = {
            status: { in: ['PENDING', 'APPROVED', 'PAID', 'CLOSED'] }
        };

        if (!isAdmin) {
            whereClause.userId = userId;
        }

        const requisitions = await prisma.requisition.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                amount: true,
                currency: true
            }
        });

        return requisitions;
    } catch (error) {
        console.error("Error fetching eligible requisitions:", error);
        return [];
    }
}

export async function getCategoriesAction() {
    try {
        const prismaClient = prisma as any;
        const customCategories = await prismaClient.customCategory.findMany({
            where: { isActive: true },
            select: { name: true },
            orderBy: { name: "asc" },
        });

        const customCategoryNames = customCategories.map((c: any) => c.name);
        const { EXPENSE_CATEGORIES } = await import("@/lib/constants");

        return Array.from(new Set([...EXPENSE_CATEGORIES, ...customCategoryNames]));
    } catch (error) {
        console.error("Error fetching categories:", error);
        const { EXPENSE_CATEGORIES } = await import("@/lib/constants");
        return EXPENSE_CATEGORIES;
    }
}

export async function getVendorsAction() {
    try {
        const session = await auth();
        if (!session?.user?.id) return [];

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { leadBranch: true }
        });

        const isBranchManager = (session.user as any).role === 'TEAM_LEADER';
        const activeBranchId = user?.leadBranch?.id || user?.branchId;

        const whereClause: any = { isActive: true };
        
        if (isBranchManager && activeBranchId) {
            whereClause.branchId = activeBranchId;
        }

        const vendors = await prisma.vendor.findMany({
            where: whereClause,
            select: { id: true, name: true, bankName: true, bankAccount: true, email: true, phone: true },
            orderBy: { name: "asc" },
        });
        return vendors;
    } catch (error) {
        console.error("Error fetching vendors:", error);
        return [];
    }
}

export async function getUserBranchAndDepartmentAction() {
    const session = await auth();
    if (!session?.user?.id) return { branch: "", department: "" };

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { leadBranch: true }
        });

        if (!user) return { branch: "", department: "" };

        // For Branch Managers (TEAM_LEADER), their branch is stored in `leadBranch`;
        // everyone else's branch lives in `branchId` and must be resolved to a name —
        // it must never be returned as the raw id, since this value is display-only.
        let branchName = user.leadBranch?.name || "";
        if (!branchName && user.branchId) {
            const branch = await prisma.branch.findUnique({ where: { id: user.branchId }, select: { name: true } });
            branchName = branch?.name || "";
        }
        const department = user.department || "";

        return { branch: branchName, department };
    } catch (error) {
        console.error("Error fetching user branch & department:", error);
        return { branch: "", department: "" };
    }
}

export async function getExpenseAccountsAction() {
    try {
        const accounts = await prisma.account.findMany({
            where: { type: 'EXPENSE' },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' }
        });

        // Self-healing: Check for missing standard categories and seed them silently
        const existingNames = new Set(accounts.map(a => a.name));
        const missingCategories = EXPENSE_CATEGORIES.filter(cat => !existingNames.has(cat));

        if (missingCategories.length > 0) {
            console.log(`Self-healing: Seeding ${missingCategories.length} missing expense accounts...`);
            
            const seedData = missingCategories.map((cat, index) => ({
                name: cat,
                code: (6001 + accounts.length + index).toString(),
                type: 'EXPENSE',
                subtype: 'OPERATING_EXPENSE',
                isActive: true
            }));

            await prisma.account.createMany({
                data: seedData,
                skipDuplicates: true
            });

            // Return the full updated list
            return await prisma.account.findMany({
                where: { type: 'EXPENSE' },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' }
            });
        }

        return accounts;
    } catch (error) {
        console.error("Error fetching expense accounts:", error);
        return [];
    }
}

export async function reseedExpenseAccountsAction() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    try {
        console.log("Forcing reseed of expense accounts...");
        
        const seedData = EXPENSE_CATEGORIES.map((cat, index) => ({
            name: cat,
            code: (6001 + index).toString(),
            type: 'EXPENSE',
            subtype: 'OPERATING_EXPENSE',
            isActive: true
        }));

        await prisma.account.createMany({
            data: seedData,
            skipDuplicates: true
        });

        return { success: true };
    } catch (e: any) {
        console.error("Manual reseed failed:", e);
        return { error: e.message || "Failed to seed accounts" };
    }
}

const CreateAccountSchema = z.object({
    name: z.string().min(2, "Name is too short"),
    code: z.string().min(2, "Code is required")
});

export async function createExpenseAccountAction(data: any) {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const validated = CreateAccountSchema.safeParse(data);
    if (!validated.success) return { error: "Invalid input provided" };

    const { name, code } = validated.data;

    try {
        const existing = await prisma.account.findUnique({ where: { code } });
        if (existing) return { error: "An account with this GL Code already exists." };

        const newAccount = await prisma.account.create({
            data: {
                name,
                code,
                type: 'EXPENSE',
                isActive: true
            }
        });

        return { success: true, account: newAccount };
    } catch (e: any) {
        console.error("Error creating account:", e);
        return { error: e.message || "Failed to create account" };
    }
}

