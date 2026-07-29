export type AppItem = { id: string; name: string; icon: string; href: string };

export const appRegistry: AppItem[] = [
  { id: "fartherhood", name: "FarTHErHOOD", icon: "/icons/fatherhood.png", href: "/apps/fartherhood" },
  { id: "friends", name: "fri.ends", icon: "/icons/friends.png", href: "/apps/friends" },
  { id: "milia", name: "Milia", href: "/apps/milia", icon: "/icons/milia.png" },
  { id: "music", name: "Music", icon: "/icons/music.png", href: "/apps/music" },
  { id: "nearby", name: "Nearby", icon: "/icons/nearby.svg", href: "/apps/nearby" },
  { id: "wallet", name: "Kiiku", icon: "/icons/wallet.svg", href: "/apps/wallet" },
  { id: "calendar", name: "Calendar", icon: "/icons/calendar.svg", href: "/apps/calendar" },
  { id: "stats", name: "Stats", href: "/apps/stats", icon: "/icons/stats.png" },
  { id: "account", name: "Account", href: "/apps/account", icon: "/icons/account.svg" }
];
