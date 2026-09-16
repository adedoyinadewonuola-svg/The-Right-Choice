"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";

const links = [
  { href: "/today", label: "Daily Stock" },
  { href: "/history", label: "History" },
  { href: "/prices", label: "Price List" },
  { href: "/overview", label: "Dashboard" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="app-header">
      <div className="brand">
        <div style={{ fontSize: 30 }}>₦</div>
        <div>
          <h1>The Right Choice</h1>
          <small>Continuous Stock, Sales & End-of-Day Management</small>
        </div>
      </div>
      <nav className="app-nav">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className={pathname === link.href ? "active" : ""}>
            {link.label}
          </Link>
        ))}
        <form action={logoutAction}>
          <button type="submit" className="btn light" style={{ marginLeft: 8 }}>
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
