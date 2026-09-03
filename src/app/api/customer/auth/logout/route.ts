import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { CUSTOMER_SESSION_COOKIE_NAME } from "@/modules/customers/adapters/customer-session-cookie";
import { PrismaCustomerAuthRepository } from "@/modules/customers/adapters/prisma-customer-auth-repository";
import { logoutCustomer } from "@/modules/customers/features/logout-customer/logout-customer";

export async function POST() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
  const repository = new PrismaCustomerAuthRepository();

  await logoutCustomer(sessionToken, repository);
  cookieStore.delete(CUSTOMER_SESSION_COOKIE_NAME);

  return new NextResponse(null, { status: 204 });
}
