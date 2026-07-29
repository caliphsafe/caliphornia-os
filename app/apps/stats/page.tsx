import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { getCurrentAppUser, getOrCreateAppUser } from "@/lib/users";
import { getStats } from "@/lib/stats/queries";
import type { AppUser } from "@/types/domain";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function pct(value: number, max: number) {
  if (max <= 0) return "0%";
  return `${Math.max(6, Math.min(100, Math.round((value / max) * 100)))}%`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string }>;
}) {
  const session = await readSession();
  if (!session?.email) redirect("/");

  const params = await searchParams;
  const range = params?.range || "30d";

  let user: AppUser = {
    id: "session-user",
    email: session.email,
    username: session.username || session.email.split("@")[0],
    role: session.role || "user",
  };

  try {
    user = (await getCurrentAppUser()) || (await getOrCreateAppUser(session.email, session.username || null));
  } catch (error) {
    console.error("STATS_USER_LOOKUP_FAILED", error);
  }

  let stats = {
    my: { songs_played: 0, shares_started: 0, qualified_shares: 0, kiiku_available: 0, kiiku_pending: 0 },
    global: { songs_played: 0, nearby_shares: 0, new_accounts_from_sharing: 0, project_contributions: 0, kiiku_earned: 0 },
  };

  try {
    if (user.id !== "session-user") stats = await getStats(user.id, range);
  } catch (error) {
    console.error("STATS_LOOKUP_FAILED", error);
  }

  const listening = Number(stats.my.songs_played || 0);
  const shares = Number(stats.my.shares_started || 0);
  const qualified = Number(stats.my.qualified_shares || 0);
  const maxRing = Math.max(1, listening, shares, qualified, 10);
  const myEntries = Object.entries(stats.my);
  const globalEntries = Object.entries(stats.global);

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back home">‹</Link>
        <div className={styles.userChip}>{user.username || user.email}</div>
      </div>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Activity</h1>
          <p className={styles.date}>Caliphornia OS Stats</p>
        </div>
      </header>

      <nav className={styles.modeSwitch} aria-label="Stats range">
        <Link className={`${styles.modeSwitchBtn} ${range === "today" ? styles.modeSwitchBtnActive : ""}`} href="?range=today">Today</Link>
        <Link className={`${styles.modeSwitchBtn} ${range === "7d" ? styles.modeSwitchBtnActive : ""}`} href="?range=7d">7 Days</Link>
        <Link className={`${styles.modeSwitchBtn} ${range === "30d" ? styles.modeSwitchBtnActive : ""}`} href="?range=30d">30 Days</Link>
        <Link className={`${styles.modeSwitchBtn} ${range === "all" ? styles.modeSwitchBtnActive : ""}`} href="?range=all">All</Link>
      </nav>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>My Rings</h2>
          <div className={styles.rings}>
            <span className={`${styles.ring} ${styles.ringListening}`} style={{ "--listening": pct(listening, maxRing) } as any} />
            <span className={`${styles.ring} ${styles.ringFavorites}`} style={{ "--favorites": pct(shares, maxRing) } as any} />
            <span className={`${styles.ring} ${styles.ringReach}`} style={{ "--reach": pct(qualified, maxRing) } as any} />
            <span className={styles.ringsCenter} />
          </div>
        </div>

        <div className={styles.ringLegend}>
          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.listeningDot}`}></span>
            <div><strong>{listening}</strong><span>Songs played</span></div>
          </div>
          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.favoritesDot}`}></span>
            <div><strong>{shares}</strong><span>Nearby shares started</span></div>
          </div>
          <div className={styles.legendRow}>
            <span className={`${styles.legendDot} ${styles.reachDot}`}></span>
            <div><strong>{qualified}</strong><span>Qualified shares</span></div>
          </div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeaderMini}><p className={styles.miniLabel}>Kiiku Available</p><span className={styles.chev}>›</span></div>
          <div className={styles.bigNumberPurple}>{stats.my.kiiku_available}</div>
          <div className={styles.sparkWrap}>{Array.from({ length: 24 }).map((_, i) => <span key={i} className={styles.sparkBar} style={{ height: `${20 + ((i * 13) % 82)}%` }} />)}</div>
          <div className={styles.sparkTimeline}><span>Start</span><span>Now</span></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeaderMini}><p className={styles.miniLabel}>Global Plays</p><span className={styles.chev}>›</span></div>
          <div className={styles.bigNumberBlue}>{stats.global.songs_played}</div>
          <div className={styles.sparkWrap}>{Array.from({ length: 24 }).map((_, i) => <span key={i} className={`${styles.sparkBar} ${styles.sparkBarBlue}`} style={{ height: `${18 + ((i * 17) % 78)}%` }} />)}</div>
          <div className={styles.sparkTimeline}><span>Community</span><span>Now</span></div>
        </div>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <h2 className={styles.cardTitle}>My Activity</h2>
        <div className={styles.listStack}>
          {myEntries.map(([key, value]) => (
            <div key={key} className={styles.listRow}>
              <strong>{titleCase(key)}</strong>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <h2 className={styles.cardTitle}>Global Activity</h2>
        <div className={styles.listStack}>
          {globalEntries.map(([key, value]) => (
            <div key={key} className={styles.listRow}>
              <strong>{titleCase(key)}</strong>
              <span>{String(value)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
