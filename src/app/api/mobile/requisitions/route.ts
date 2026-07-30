import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine what requisitions to return based on Role
    let requisitions: any[] = [];

    if (user.role === 'REGIONAL_MANAGER') {
      // Return ALL requisitions in the region requiring approval
      if (user.regionId) {
        requisitions = await prisma.requisition.findMany({
          where: {
            branchRef: { regionId: user.regionId },
            status: 'PENDING'
          },
          include: {
            items: true,
            user: { select: { name: true, email: true } },
            branchRef: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    } else if (user.role === 'TEAM_LEADER' || user.role === 'MANAGER') {
      // Branch Manager sees their own branch's requisitions
      if (user.branchId) {
        requisitions = await prisma.requisition.findMany({
          where: {
            branchId: user.branchId,
          },
          include: {
            items: true,
            user: { select: { name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        });
      }
    } else {
      // Employee sees their own
      requisitions = await prisma.requisition.findMany({
        where: { userId: user.id },
        include: { items: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    return NextResponse.json({ requisitions });
  } catch (error) {
    console.error("Error fetching mobile requisitions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { checkExpensePolicies } from "@/lib/policy-engine";
import { approvalWorkflow } from "@/lib/approval-workflow";

export async function POST(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { 
      title, 
      description,
      currency = 'KES', 
      items = [], 
      type = "STANDARD", 
      branch, 
      department,
      vendor,
      paymentMethod,
      paymentReference
    } = body;
    
    // Fallback for older mobile app versions that only send basic data (during transition)
    let processedItems = items;
    let finalDescription = description || body.businessJustification || "";
    
    if (processedItems.length === 0 && body.amount && body.category) {
      processedItems = [{
        title: body.title,
        description: "",
        quantity: 1,
        unitPrice: parseFloat(body.amount),
        category: body.category
      }];
    }

    if (!title || processedItems.length === 0) {
      return NextResponse.json({ error: "Title and at least one item are required" }, { status: 400 });
    }

    // Calculate total amount
    const totalAmount = processedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

    // Get primary category
    const primaryCategory = processedItems.sort((a: any, b: any) => 
      (b.quantity * b.unitPrice) - (a.quantity * a.unitPrice)
    )[0].category;

    // Run Policy Checks
    const policyResult = await checkExpensePolicies({
      title,
      amount: totalAmount,
      category: primaryCategory,
      expenseDate: new Date(),
      userId: user.id
    });

    if (!policyResult.isValid) {
      const blockers = policyResult.violations.filter(v => v.isBlocking).map(v => v.message);
      if (blockers.length > 0) {
        return NextResponse.json({ error: `Policy Violation: ${blockers.join(", ")}` }, { status: 400 });
      }
    }

    // Merge notes
    if (vendor && vendor.trim()) {
      finalDescription += `\n\n**Preferred Vendor:** ${vendor.trim()}`;
    }
    if (paymentMethod && paymentMethod.trim()) {
      finalDescription += `\n\n**Payment Method:** ${paymentMethod.trim()}`;
      if (paymentReference && paymentReference.trim()) {
        finalDescription += ` — Ref/Number: ${paymentReference.trim()}`;
      }
    }

    const requisition = await prisma.requisition.create({
      data: {
        userId: user.id,
        title,
        amount: totalAmount,
        currency,
        category: primaryCategory,
        description: finalDescription,
        businessJustification: finalDescription,
        status: "PENDING",
        type,
        branchId: branch || user.branchId || undefined,
        department,
        items: {
          create: processedItems.map((item: any) => {
            return {
              title: item.title,
              description: item.description || "",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              category: item.category,
              isInitial: true,
              status: "PENDING",
              type: type
            };
          })
        }
      }
    });

    // Resolve regionId for approval routing
    const userWithBranch = await prisma.user.findUnique({
      where: { id: user.id },
      include: { leadBranch: true }
    });
    const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;

    // Initiate Approval Workflow
    const route = await approvalWorkflow.determineRoute(
      user.id,
      totalAmount,
      primaryCategory,
      false,
      type,
      userRegionId || undefined
    );

    await approvalWorkflow.createRequisitionApprovals(requisition.id, route);

    return NextResponse.json({ requisition });
  } catch (error) {
    console.error("Error creating mobile requisition:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
