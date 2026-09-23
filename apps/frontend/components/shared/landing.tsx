"use client";
import { apiFetch, apiErrorMessage } from "@frontend/lib/api-client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Sparkles,
  GitBranch,
  Target,
  Users,
  LoaderCircle,
} from "lucide-react";
import { Brand, ReadinessRing } from "@frontend/components/shared/presentation";
import { Button } from "@frontend/components/shared/ui/button";
export function Landing() {
  const router = useRouter();
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  async function login(role: string) {
    setBusy(role);
    setError("");
    try {
      const r = await apiFetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(apiErrorMessage(data.error));
      router.push(data.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in");
      setBusy("");
    }
  }
  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <span className="landing-nav-label">
          CAREER QUEST <span>BY HALYK TALENTOS</span>
        </span>
        <span className="landing-edition">
          HackAlem AI ’26 <ArrowUpRight size={15} />
        </span>
      </header>
      <main className="landing-main">
        <section className="landing-copy">
          <div className="landing-kicker">
            <span /> A NEW PERSPECTIVE ON YOUR POTENTIAL
          </div>
          <h1>
            Your career has
            <br />a next move.
            <br />
            <span>Find yours.</span>
          </h1>
          <p className="landing-description">
            AI helps you connect where you are with where you want to be. Turn
            your skills, ambitions and experience into a clear next step.
          </p>
          <div className="landing-actions">
            <Button onClick={() => login("EMPLOYEE")} disabled={!!busy}>
              {busy === "EMPLOYEE" ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <ArrowRight size={18} />
              )}
              Employee demo
            </Button>
            <Button
              variant="outline"
              onClick={() => login("HR")}
              disabled={!!busy}
            >
              <Users size={18} />
              {busy === "HR" ? "Opening…" : "HR demo"}
            </Button>
            <Button
              variant="outline"
              onClick={() => login("MANAGER")}
              disabled={!!busy}
            >
              <Users size={18} />
              {busy === "MANAGER" ? "Opening…" : "Manager demo"}
            </Button>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <p className="demo-caption">
            Meet Aidar. Explore his next chapter.
            <br />
            <span>Demo accounts use entirely synthetic data.</span>
          </p>
          <div className="landing-trust">
            <ShieldCheck size={20} />
            <p>
              <strong>Clarity you can trust.</strong>
              <br />
              Explainable recommendations. Privacy by design.
            </p>
          </div>
        </section>
        <section
          className="landing-visual"
          aria-label="Example career navigation"
        >
          <div className="visual-topline">
            <span>YOUR NEXT CHAPTER</span>
            <span>01 / ∞</span>
          </div>
          <div className="landing-orbit">
            <div className="orbit-line orbit-one" />
            <div className="orbit-line orbit-two" />
            <div className="orbit-line orbit-three" />
            <div className="landing-profile-card">
              <div className="flex-row">
                <div className="avatar avatar-large">AS</div>
                <div>
                  <strong>Aidar Sarsenov</strong>
                  <p>Backend Engineer · Middle</p>
                </div>
                <span className="profile-spark">
                  <Sparkles size={20} />
                </span>
              </div>
              <div className="landing-readiness">
                <ReadinessRing value={68} />
                <div>
                  <div className="eyebrow">NEXT DESTINATION</div>
                  <h3>
                    Senior Backend
                    <br />
                    Engineer
                  </h3>
                  <span className="light-tag">3 skills to unlock</span>
                </div>
              </div>
              <div className="landing-path">
                <span>
                  <Check size={13} /> Junior
                </span>
                <i />
                <strong>Middle</strong>
                <i />
                <span>
                  Senior <ArrowUpRight size={13} />
                </span>
              </div>
            </div>
            <div className="floating-recommendation">
              <span className="small-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <div className="eyebrow">YOUR NEXT BEST ACTION</div>
                <strong>Advanced System Design</strong>
                <p>
                  One workshop. <span>+8% career readiness.</span>
                </p>
              </div>
              <ArrowUpRight size={20} />
            </div>
          </div>
          <div className="visual-bottomline">
            <span>
              <GitBranch size={16} /> Many paths. One that’s yours.
            </span>
            <span>POWERED BY EVIDENCE</span>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Target size={18} />
          <strong>Know your strengths.</strong>
          <span>See the full picture of your skills.</span>
        </div>
        <div>
          <GitBranch size={18} />
          <strong>Explore what’s next.</strong>
          <span>Find a path aligned with your ambitions.</span>
        </div>
        <div>
          <Sparkles size={18} />
          <strong>Make your next move.</strong>
          <span>Take action with a reason behind it.</span>
        </div>
      </footer>
    </div>
  );
}
