import { NavLink, Route, Routes } from "react-router-dom";
import { ConnectWallet } from "../components/ConnectWallet";
import { OverviewPage } from "./OverviewPage.tsx";
import { StakePage } from "./StakePage.tsx";
import { AdminPage } from "./AdminPage.tsx";
import { LayoutDashboard, Sparkles, Shield } from "lucide-react";
import { useBackendSession } from "../hooks/useBackendSession";

export function App() {
  useBackendSession();

  return (
    <div className="min-h-screen bg-bg-950">
      <div className="pointer-events-none fixed inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none fixed -top-48 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/12 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-10xl">
        <aside className="hidden md:flex w-72 flex-col gap-6 border-r border-white/10 bg-black/15 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500/15 border border-brand-400/30 shadow-glow">
              <img src="assets/favicon.png" className="h-5 w-5 text-brand-300" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">StakeMaster</div>
              <div className="text-xs text-white/60">Local Hardhat (31337)</div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <SideLink to="/" icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" />
            <SideLink to="/stake" icon={<Sparkles className="h-4 w-4" />} label="Stake & Yield" />
            <SideLink to="/admin" icon={<Shield className="h-4 w-4" />} label="Admin Panel" />
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Tip</div>
            <div className="mt-1 text-sm text-white/85">
              If your wallet has 0 STK locally, transfer STK from the Hardhat deployer account to your wallet.
            </div>
          </div>
        </aside>

        <main className="flex-1 p-5 md:p-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div>
              <div className="text-2xl font-semibold">Staking Dashboard</div>
              <div className="mt-1 text-sm text-white/60">
                Overview of your staked assets and performance
              </div>
            </div>
            <ConnectWallet />
          </header>

          <nav className="mt-5 grid grid-cols-3 gap-2 md:hidden">
            <SideLink to="/" icon={<LayoutDashboard className="h-4 w-4" />} label="Overview" />
            <SideLink to="/stake" icon={<Sparkles className="h-4 w-4" />} label="Stake" />
            <SideLink to="/admin" icon={<Shield className="h-4 w-4" />} label="Admin" />
          </nav>

          <div className="mt-7">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/stake" element={<StakePage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function SideLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition border",
          isActive
            ? "bg-white/8 border-white/14 text-white"
            : "bg-transparent border-transparent text-white/70 hover:bg-white/6 hover:border-white/10 hover:text-white",
        ].join(" ")
      }
    >
      <span className="text-white/80">{icon}</span>
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

