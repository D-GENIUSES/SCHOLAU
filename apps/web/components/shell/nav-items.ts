import {
  NavBattlesIcon,
  NavHomeIcon,
  NavLeaderboardIcon,
  NavProfileIcon,
  NavSocialIcon,
} from "./nav-icons";

export const studentNav = [
  { href: "/home", label: "Home", icon: NavHomeIcon },
  { href: "/social", label: "Social", icon: NavSocialIcon },
  { href: "/battles", label: "Battles", icon: NavBattlesIcon },
  { href: "/leaderboard", label: "Leaderboard", icon: NavLeaderboardIcon },
  { href: "/profile", label: "Profile", icon: NavProfileIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
