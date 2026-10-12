import { BookOpen, Home, Swords, Trophy, User } from "lucide-react";

export const studentNav = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/study", label: "Study", icon: BookOpen },
  { href: "/battles", label: "Battles", icon: Swords },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
