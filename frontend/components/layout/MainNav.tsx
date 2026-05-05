import Link from "next/link";

const navItems = [
  { href: "/login", label: "Login" },
  { href: "/admin", label: "Admin" },
  { href: "/client", label: "Client" },
];

export function MainNav() {
  return (
    <nav className="main-nav" aria-label="Sendwise primary navigation">
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
