'use server'

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// --- Schemas ---
const CustomerImportSchema = z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    taxId: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    currency: z.string().default('KES')
})

const SaleImportSchema = z.object({
    invoiceNumber: z.string().min(1),
    customerName: z.string().min(1),
    issueDate: z.string().or(z.date()), // Accepts ISO string or Date object
    dueDate: z.string().or(z.date()).optional(),
    description: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
})

export async function importCustomers(data: any[]) {
    const session = await auth()
    if (!session?.user) return { success: false, message: "Unauthorized" }

    let successCount = 0
    let errors = []

    for (const row of data) {
        try {
            // Validate
            const validated = CustomerImportSchema.parse({
                ...row,
                email: row.email || null, // Clean empty strings
            })

            // Upsert (Update if exists by email, else create) -> Actually finding by Name is safer if email missing
            // But Prisma Upsert needs a unique constraint. 
            // We'll try to find by Name first.

            const existing = await prisma.customer.findFirst({
                where: { name: { equals: validated.name, mode: 'insensitive' } }
            })

            if (existing) {
                await prisma.customer.update({
                    where: { id: existing.id },
                    data: {
                        email: validated.email || existing.email,
                        phone: validated.phone || existing.phone,
                        taxId: validated.taxId || existing.taxId,
                        address: validated.address || existing.address,
                        city: validated.city || existing.city,
                        country: validated.country || existing.country
                    }
                })
            } else {
                await prisma.customer.create({
                    data: {
                        name: validated.name,
                        email: validated.email,
                        phone: validated.phone,
                        taxId: validated.taxId,
                        address: validated.address,
                        city: validated.city,
                        country: validated.country,
                        currency: validated.currency || 'KES',
                        isActive: true
                    }
                })
            }
            successCount++
        } catch (e: any) {
            console.error("Row Error:", row, e)
            errors.push(`Row "${row.name || 'Unknown'}": ${e.message}`)
        }
    }

    revalidatePath('/dashboard/accounting/customers')
    return {
        success: true,
        message: `Imported ${successCount} customers successfully.`,
        errors: errors.length > 0 ? errors : undefined
    }
}

export async function importSales(data: any[]) {
    const session = await auth()
    if (!session?.user) return { success: false, message: "Unauthorized" }

    let successCount = 0
    let errors = []

    // Group by Invoice Number to handle multiple lines per invoice
    const invoiceGroups: Record<string, any[]> = {}

    // First pass: Grouping
    for (const row of data) {
        const invNum = row.invoiceNumber || row.InvoiceNumber || `AUTO-${Date.now()}-${Math.random().toString().slice(2, 5)}`
        if (!invoiceGroups[invNum]) invoiceGroups[invNum] = []
        invoiceGroups[invNum].push(row)
    }

    // Process each invoice
    for (const [invNum, rows] of Object.entries(invoiceGroups)) {
        try {
            const firstRow = rows[0]
            const customerName = firstRow.customerName || firstRow.CustomerName
            if (!customerName) throw new Error("Customer Name missing")

            // Find Customer
            let customer = await prisma.customer.findFirst({
                where: { name: { equals: customerName, mode: 'insensitive' } }
            })

            // Auto-create customer if missing? STRICT MODE: No. User should import customers first.
            // But for ease of use, we'll error out.
            if (!customer) {
                throw new Error(`Customer "${customerName}" not found. Please import customers first.`)
            }

            // Calculate Dates with fallback
            const issueDate = firstRow.issueDate ? new Date(firstRow.issueDate) : new Date()
            const dueDate = firstRow.dueDate ? new Date(firstRow.dueDate) : new Date(new Date().setDate(new Date().getDate() + 30))

            // Calculate Total
            const items = rows.map(r => ({
                description: r.description || r.Description || "Item",
                quantity: parseFloat(r.quantity || r.Quantity || 0),
                unitPrice: parseFloat(r.unitPrice || r.UnitPrice || 0)
            }))
            const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

            // Create Sale and Items
            await prisma.sale.create({
                data: {
                    invoiceNumber: invNum,
                    customerId: customer.id,
                    issueDate: issueDate,
                    dueDate: dueDate,
                    totalAmount: totalAmount,
                    status: 'SENT', // Default to SENT so it hits GL? Or DRAFT? Let's say SENT for migrated data.
                    items: {
                        create: items.map((item: any) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            total: item.quantity * item.unitPrice
                        }))
                    }
                }
            })

            successCount++
        } catch (e: any) {
            // If unique constraint on invoice number (P2002)
            if (e.code === 'P2002') {
                errors.push(`Invoice ${invNum}: Already exists (skipped).`)
            } else {
                console.error("Invoice Error:", invNum, e)
                errors.push(`Invoice ${invNum}: ${e.message}`)
            }
        }
    }

    revalidatePath('/dashboard/accounting/sales')
    return {
        success: true,
        message: `Imported ${successCount} invoices successfully.`,
        errors: errors.length > 0 ? errors : undefined
    }
}
