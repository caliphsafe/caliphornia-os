export type AppItem = {
  id: string;
  name: string;
  subtitle?: string;
  icon: string;
  href: string;
  dock?: boolean;
  passLabel?: string;
};

export type GlobalNavigationIcon = "home" | "music" | "share" | "account";

export type GlobalNavigationItem = {
  id: string;
  label: string;
  href: string;
  icon: GlobalNavigationIcon;
};

export const appRegistry: AppItem[] = [
  {
    id: "fartherhood",
    name: "FarTHErHOOD",
    subtitle: "Notes",
    icon: "/icons/fatherhood.png",
    href: "/apps/fartherhood",
    passLabel: "Project"
  },
  {
    id: "friends",
    name: "Fri.ends",
    subtitle: "Messages",
    icon: "/icons/friends.png",
    href: "/apps/friends",
    passLabel: "Project"
  },
  {
    id: "milia",
    name: "Milia",
    subtitle: "Weather",
    href: "/apps/milia",
    icon: "/icons/milia.png",
    passLabel: "Project"
  },
  {
    id: "calendar",
    name: "Calendar",
    subtitle: "Drops",
    icon: "/icons/calendar.svg",
    href: "/apps/calendar",
    passLabel: "Free"
  },
  {
    id: "music",
    name: "Music",
    subtitle: "Library",
    icon: "/icons/music.png",
    href: "/apps/music",
    dock: true,
    passLabel: "Library"
  },
  {
    id: "share",
    name: "Share",
    subtitle: "AirDrop-style",
    icon: "/icons/share.svg",
    href: "/apps/share",
    dock: true,
    passLabel: "Songs + Projects"
  },
  {
    id: "stats",
    name: "Stats",
    subtitle: "Activity",
    href: "/apps/stats",
    icon: "/icons/stats.png",
    dock: true,
    passLabel: "Activity"
  },
  {
    id: "account",
    name: "Account",
    subtitle: "Settings",
    href: "/apps/account",
    icon: "/icons/account.svg",
    dock: true,
    passLabel: "Settings"
  }
];


const globalNavigationAppIds = ["music", "share", "account"] as const;

export const globalNavigation: GlobalNavigationItem[] = [
  { id: "home", label: "Home", href: "/home", icon: "home" },
  ...globalNavigationAppIds.flatMap((id) => {
    const app = appRegistry.find((item) => item.id === id);
    return app
      ? [{ id: app.id, label: app.name, href: app.href, icon: id }]
      : [];
  }),
];
