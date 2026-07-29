import type { CSSProperties } from "react";
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

function safeNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\w/g, (m) => m.toUpperCase());
}

async function resolveUser(session: { email: string; username?: string; role?: string }): Promise<AppUser> {
  try {
    const existing = await getCurrentAppUser();
    if (existing?.id) return existing;
    return await getOrCreateAppUser(session.email, session.username || null);
  } catch (error) {
    console.error("STATS_USER_LOOKUP_FAILED", error);
    return { id: "session-user", email: session.email, username: session.username || session.email.split("@")[0], role: session.role || "user" };
  }
}

export default async function StatsPage({ searchParams }: { searchParams?: Promise<{ range?: string; mode?: string }> }) {
  const params = await searchParams;
  const session = await readSession();
  if (!session?.email) redirect("/");

  const user = await resolveUser(session);
  const range = params?.range || "30d";
  const stats = user.id === "session-user" ? { my: {}, global: {} } : await getStats(user.id, range);

  const my = stats.my as Record<string, unknown>;
  const global = stats.global as Record<string, unknown>;
  const listening = safeNumber(my.songs_played);
  const shares = safeNumber(my.qualified_shares || my.shares_started);
  const kiiku = safeNumber(my.kiiku_available);
  const ringMax = Math.max(10, listening, shares, kiiku);

  const sparkValues = [12,22,16,30,18,42,25,35,20,46,34,55,38,48,30,64,44,58,39,70,50,60,44,76];

  return (
    <main className={styles.page}>
      <div className={styles.topChrome}>
        <Link href="/home" className={styles.backPill} aria-label="Back"><img src="/apps/fartherhood/back.png" alt="" className={styles.backImg} /></Link>
        <Link href="/apps/share" className={styles.userChip}>Share</Link>
      </div>

      <header className={styles.header}>
        <div><h1 className={styles.title}>Activity</h1><p className={styles.date}>Caliphornia OS Stats</p></div>
      </header>

      <nav className={styles.modeSwitch} aria-label="Stats range">
        {["today", "7d", "30d", "all"].map((item) => (
          <Link key={item} href={`?range=${item}`} className={`${styles.modeSwitchBtn} ${range === item ? styles.modeSwitchBtnActive : ""}`}>{item === "7d" ? "7 Days" : item === "30d" ? "30 Days" : item === "all" ? "All" : "Today"}</Link>
        ))}
      </nav>

      <section className={`${styles.card} ${styles.ringsCard}`}>
        <div>
          <h2 className={styles.cardTitle}>My Rings</h2>
          <div className={styles.rings} aria-hidden="true">
            <span className={`${styles.ring} ${styles.ringListening}`} style={{ "--listening": pct(listening, ringMax) } as CSSProperties} />
            <span className={`${styles.ring} ${styles.ringFavorites}`} style={{ "--favorites": pct(shares, ringMax) } as CSSProperties} />
            <span className={`${styles.ring} ${styles.ringReach}`} style={{ "--reach": pct(kiiku, ringMax) } as CSSProperties} />
            <span className={styles.ringsCenter} />
          </div>
        </div>
        <div className={styles.ringLegend}>
          <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.listeningDot}`} /><div><strong>{listening}</strong><span>Songs played</span></div></div>
          <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.favoritesDot}`} /><div><strong>{shares}</strong><span>Shares and qualified listens</span></div></div>
          <div className={styles.legendRow}><span className={`${styles.legendDot} ${styles.reachDot}`} /><div><strong>{kiiku}</strong><span>Available Kiiku</span></div></div>
        </div>
      </section>

      <section className={styles.twoColGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeaderMini}><p className={styles.miniLabel}>Global Plays</p><span className={styles.chev}>›</span></div>
          <div className={styles.bigNumberBlue}>{safeNumber(global.songs_played)}</div>
          <div className={styles.sparkWrap}>{sparkValues.map((v, i) => <span key={i} className={styles.sparkBarBlue} style={{ height: `${v}%` }} />)}</div>
          <div className={styles.sparkTimeline}><span>Start</span><span>Now</span></div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeaderMini}><p className={styles.miniLabel}>Share Reach</p><span className={styles.chev}>›</span></div>
          <div className={styles.bigNumberGreen}>{safeNumber(global.nearby_shares)}</div>
          <p className={styles.emptyText}>Share replaces Nearby in the UI, while the protected one-play logic stays underneath.</p>
        </div>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}><h2 className={styles.cardTitle}>My Activity</h2><span className={styles.chev}>›</span></div>
        <div className={styles.listStack}>
          {Object.entries(my).map(([key, value]) => (
            <div className={styles.listRow} key={key}><div><strong>{label(key)}</strong><span>{key.includes("kiiku") ? "Kiiku wallet" : "Personal activity"}</span></div><strong>{String(value || 0)}</strong></div>
          ))}
        </div>
      </section>

      <section className={`${styles.card} ${styles.fullCard}`}>
        <div className={styles.cardHeaderMini}><h2 className={styles.cardTitle}>Global Activity</h2><span className={styles.chev}>›</span></div>
        <div className={styles.listStack}>
          {Object.entries(global).map(([key, value]) => (
            <div className={styles.listRow} key={key}><div><strong>{label(key)}</strong><span>Community activity</span></div><strong>{String(value || 0)}</strong></div>
          ))}
        </div>
      </section>
    </main>
  );
}
