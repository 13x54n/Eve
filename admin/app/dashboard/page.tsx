// app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // const token = (await cookies()).get("access_token")?.value;

  // if (!token) {
  //   redirect("/login");
  // }

  // const response = await fetch(
  //   `${process.env.BACKEND_URL}/users/me`,
  //   {
  //     headers: {
  //       Authorization: `Bearer ${token}`,
  //     },
  //     cache: "no-store",
  //   }
  // );

  // if (!response.ok) {
  //   redirect("/login");
  // }

  // const user = await response.json();

  return <h1>Dashboard</h1>;
}