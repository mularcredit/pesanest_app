"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { z } from "zod";

const RequisitionSchema = z.object({
    title: z.string().min(5, "Title must be at least 5 characters"),
    amount: z.coerce.number().positive("Amount must be positive"),
    currency: z.string().default('KES'),
    category: z.string().min(1, "Please select a category"),
    description: z.string().min(10, "Justification must be at least 10 characters"),
});

import { checkEnforceClosure } from "@/lib/closure-check";

import { checkExpensePolicies } from "@/lib/policy-engine";
import { approvalWorkflow } from "@/lib/approval-workflow";

export async function createRequisition(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const validatedFields = RequisitionSchema.safeParse({
        title: formData.get("title"),
        amount: formData.get("amount"),
        currency: formData.get("currency"),
        category: formData.get("category"),
        description: formData.get("description"),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { title, amount, currency, category, description } = validatedFields.data;

    // Parallelize all validation checks and user metadata fetching
    const [closureCheck, policyResult, user] = await Promise.all([
        checkEnforceClosure(session.user.id),
        checkExpensePolicies({
            title,
            amount,
            category,
            expenseDate: new Date(),
            userId: session.user.id
        }),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { branchId: true, regionId: true, leadBranch: { select: { regionId: true } } }
        })
    ]);

    if (closureCheck.blocked) {
        return { message: closureCheck.message };
    }

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
        // Backend Validation: Only System Admins can create SSCA requests
        if ((session.user as any).role !== "SYSTEM_ADMIN") {
            return {
                message: "Unauthorized: Only System Administrators can create South Sudan Civil Aviation requests."
            };
        }
        type = isStrictApproval ? "SOUTH_SUDAN_STRICT" : "SOUTH_SUDAN";
    }

    const branch = formData.get("branch") as string;
    const department = formData.get("department") as string;
    const vendor = formData.get("vendor") as string;
    const expectedDateStr = formData.get("expectedDate") as string;

    let finalDescription = description;
    if (vendor && vendor.trim()) {
        finalDescription += `\n\n**Preferred Vendor:** ${vendor.trim()}`;
    }

    const expectedDate = expectedDateStr ? new Date(expectedDateStr) : undefined;

    const userRegionId = user?.regionId || user?.leadBranch?.regionId;


    const requisition = await prisma.requisition.create({
        data: {
            userId: session.user.id,
            title,
            amount,
            currency,
            category,
            description: finalDescription,
            businessJustification: finalDescription,
            status: "PENDING",
            type,
            branchId: (formData.get("branchId") as string) || (formData.get("branch") as string) || user?.branchId || null,
            branch, // Legacy string field
            department,
            expectedDate
        },
    });

    // Initiate Approval Workflow
    console.log(`[Requisition] Creating workflow for amount: ${amount}, category: ${category}`);
    const route = await approvalWorkflow.determineRoute(
        session.user.id,
        amount,
        category,
        false, // No receipt for pre-approval requisition
        type,
        userRegionId || undefined
    );

    console.log(`[Requisition] Route determined: ${route.autoApprove ? 'Auto-approve' : 'Levels: ' + route.levels.length}`);
    const approvals = await approvalWorkflow.createRequisitionApprovals(requisition.id, route);
    console.log(`[Requisition] Created ${approvals.length} approval records`);

    redirect("/dashboard/requisitions");
}
