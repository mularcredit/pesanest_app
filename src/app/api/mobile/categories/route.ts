import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const categories = [
      // Fixed Recurring
      "Rent", "Internet & Connectivity", "Airtime & Communication",
      "Fuel Allocation", "Hired Bike Payments",
      // Operational
      "Stationery", "Office Supplies", "Meetings & Conferences",
      "Accommodation", "Emergency Field Expenses",
      // Petty Cash
      "Electricity", "Fuel", "Repairs", "Maintenance", "Water",
      // Procurement
      "ICT Equipment", "Furniture", "Hardware",
    ];

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
