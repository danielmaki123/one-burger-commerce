import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CUSTOMER_SESSION_COOKIE_NAME } from "@/modules/customers/adapters/customer-session-cookie";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { getCustomerSession } from "@/modules/customers/features/get-customer-session/get-customer-session";
import { createErrorResponse } from "@/shared/lib/http/error-response";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
    const repository = new PrismaCustomerAuthRepository();
    const session = await getCustomerSession(sessionToken, repository);

    return NextResponse.json({
      data: session,
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}
