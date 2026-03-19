export type AppItem = {
  id: string;
  name: string;
  icon: string;
  href: string;
};

export const appRegistry: AppItem[] = [
  {
    id: "fartherhood",
    name: "FarTHErHOOD",
    icon: "/icons/fatherhood.png",
    href: "/apps/fartherhood"
  },
  {
    id: "friends",
    name: "frie.ends",
    icon: "/icons/friends.png",
    href: "/apps/friends"
  },
  {
    id: "music",
    name: "Music",
    icon: "/icons/music.png",
    href: "/apps/music"
  }
];
