import { appRegistry } from "@/lib/app-registry";
import type { AppUser } from "@/types/domain";

function getDisplayName(user: AppUser) {
  return user.username || user.email.split("@")[0] || "Caliphornia";
}

function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function HomeScreen({ user }: { user: AppUser }) {
  const dockIds = new Set(["music", "stats", "wallet", "account"]);
  const visibleApps = appRegistry.filter((app) => !dockIds.has(app.id));
  const dockApps = appRegistry.filter((app) => dockIds.has(app.id));

  return (
    <main
      style={{
        minHeight: "100dvh",
        color: "#f8fafc",
        position: "relative",
        overflow: "hidden",
        padding: "18px",
        display: "grid",
        alignItems: "stretch",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -3,
          background:
            "radial-gradient(circle at 50% 0%, rgba(157,220,255,.35), transparent 30%), radial-gradient(circle at 18% 84%, rgba(248,212,119,.24), transparent 28%), radial-gradient(circle at 85% 70%, rgba(127,92,255,.24), transparent 28%), linear-gradient(180deg,#111827 0%,#05060a 54%,#02030a 100%)",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          background:
            "linear-gradient(120deg, transparent, rgba(255,255,255,.06), transparent)",
          opacity: 0.5,
        }}
      />

      <section
        style={{
          width: "min(460px, 100%)",
          margin: "0 auto",
          minHeight: "calc(100dvh - 36px)",
          borderRadius: 44,
          border: "1px solid rgba(255,255,255,.16)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.035))",
          boxShadow: "0 44px 140px rgba(0,0,0,.48)",
          backdropFilter: "blur(28px)",
          padding: "18px 16px 16px",
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: 18,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 116,
            height: 28,
            borderRadius: 999,
            background: "rgba(0,0,0,.58)",
            border: "1px solid rgba(255,255,255,.08)",
          }}
        />

        <header
          style={{
            paddingTop: 42,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: ".72rem",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                fontWeight: 800,
                color: "rgba(157,220,255,.92)",
              }}
            >
              Caliphornia OS
            </div>

            <h1
              style={{
                margin: "6px 0 0",
                fontSize: "1.8rem",
                lineHeight: 1,
                letterSpacing: "-.055em",
              }}
            >
              {getDisplayName(user)}
            </h1>
          </div>

          <a
            href="/api/logout"
            style={{
              borderRadius: 999,
              padding: "10px 14px",
              color: "rgba(248,250,252,.86)",
              background: "rgba(255,255,255,.11)",
              border: "1px solid rgba(255,255,255,.14)",
              fontSize: ".84rem",
              fontWeight: 700,
            }}
          >
            Lock
          </a>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.25fr .75fr",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 28,
              padding: 16,
              minHeight: 126,
              background:
                "linear-gradient(160deg, rgba(255,255,255,.16), rgba(255,255,255,.07))",
              border: "1px solid rgba(255,255,255,.16)",
              boxShadow: "0 24px 60px rgba(0,0,0,.26)",
              backdropFilter: "blur(20px)",
              display: "grid",
              alignContent: "space-between",
            }}
          >
            <div
              style={{
                color: "rgba(248,250,252,.72)",
                fontSize: ".8rem",
                fontWeight: 700,
              }}
            >
              {getTodayLabel()}
            </div>

            <div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  letterSpacing: "-.04em",
                }}
              >
                Music. Kiiku. Sharing.
              </div>
              <div
                style={{
                  marginTop: 4,
                  color: "rgba(248,250,252,.72)",
                  fontSize: ".82rem",
                  lineHeight: 1.35,
                }}
              >
                One connected world for every Caliph release.
              </div>
            </div>
          </div>

          <a
            href="/apps/nearby"
            style={{
              borderRadius: 28,
              padding: 15,
              background:
                "linear-gradient(160deg, rgba(248,212,119,.28), rgba(255,255,255,.08))",
              border: "1px solid rgba(255,255,255,.16)",
              boxShadow: "0 24px 60px rgba(0,0,0,.24)",
              backdropFilter: "blur(20px)",
              display: "grid",
              alignContent: "space-between",
              minHeight: 126,
            }}
          >
            <span
              style={{
                fontSize: "1.75rem",
                lineHeight: 1,
              }}
            >
              ⌁
            </span>
            <span>
              <strong style={{ display: "block", fontSize: ".95rem" }}>
                Nearby
              </strong>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  color: "rgba(248,250,252,.72)",
                  fontSize: ".76rem",
                  lineHeight: 1.3,
                }}
              >
                Share without QR codes
              </span>
            </span>
          </a>
        </section>

        <section
          aria-label="Apps"
          style={{
            alignSelf: "start",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "22px 14px",
            padding: "10px 4px 0",
          }}
        >
          {visibleApps.map((app) => (
            <a
              key={app.id}
              href={app.href}
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,.30), rgba(255,255,255,.08))",
                  border: "1px solid rgba(255,255,255,.18)",
                  boxShadow: "0 18px 42px rgba(0,0,0,.30)",
                }}
              >
                <img
                  src={app.icon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </span>

              <span
                style={{
                  fontSize: ".74rem",
                  color: "rgba(248,250,252,.84)",
                  textAlign: "center",
                  lineHeight: 1.15,
                  maxWidth: 74,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {app.name}
              </span>
            </a>
          ))}
        </section>

        <nav
          aria-label="Dock"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(dockApps.length, 1)}, minmax(0, 1fr))`,
            gap: 10,
            padding: 10,
            borderRadius: 32,
            background: "rgba(255,255,255,.13)",
            border: "1px solid rgba(255,255,255,.16)",
            boxShadow: "0 24px 80px rgba(0,0,0,.34)",
            backdropFilter: "blur(26px)",
          }}
        >
          {dockApps.map((app) => (
            <a
              key={app.id}
              href={app.href}
              style={{
                display: "grid",
                justifyItems: "center",
                gap: 6,
                color: "rgba(248,250,252,.88)",
              }}
            >
              <span
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                  background:
                    "linear-gradient(145deg, rgba(255,255,255,.32), rgba(255,255,255,.10))",
                  border: "1px solid rgba(255,255,255,.18)",
                }}
              >
                <img
                  src={app.icon}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </span>

              <span style={{ fontSize: ".68rem" }}>{app.name}</span>
            </a>
          ))}
        </nav>
      </section>
    </main>
  );
}
