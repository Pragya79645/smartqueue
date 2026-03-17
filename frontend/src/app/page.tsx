"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Brain,
  Camera,
  CircleAlert,
  Clock3,
  Gauge,
  Lightbulb,
  LineChart,
  Radar,
  ScanLine,
  Sparkles,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const problemCards = [
  {
    icon: Clock3,
    title: "Long Waiting Times",
    description:
      "Customers face unpredictable delays during peak hours, reducing satisfaction and trust.",
  },
  {
    icon: Users,
    title: "Inefficient Staff Allocation",
    description:
      "Staff remains unevenly distributed across counters while demand shifts in real time.",
  },
  {
    icon: CircleAlert,
    title: "Poor Service Experience",
    description:
      "Overloaded counters and slow response times lead to frustrated visitors and rushed operations.",
  },
  {
    icon: Radar,
    title: "Lack of Real-Time Insights",
    description:
      "Without live visibility, managers cannot act early to prevent congestion and bottlenecks.",
  },
];

const pipelineSteps = [
  {
    icon: Camera,
    title: "Camera (CCTV)",
    description: "Live video streams capture counter activity continuously.",
  },
  {
    icon: ScanLine,
    title: "YOLO Detection",
    description: "AI vision detects people and tracks queue formation in real time.",
  },
  {
    icon: Activity,
    title: "Queue Analysis",
    description: "Counter-level queue states are calculated for actionable operations data.",
  },
  {
    icon: LineChart,
    title: "LSTM Prediction",
    description: "Forecasts congestion trends to anticipate near-future demand.",
  },
  {
    icon: Brain,
    title: "Staff Optimization",
    description: "Recommends intelligent staff allocation to reduce waiting time.",
  },
];

const features = [
  {
    icon: Radar,
    title: "Real-Time Queue Detection",
    description:
      "Continuously monitors queue density and movement using AI-powered vision.",
  },
  {
    icon: Gauge,
    title: "Counter-Wise Monitoring",
    description:
      "Tracks each counter independently for granular operational decisions.",
  },
  {
    icon: LineChart,
    title: "Predictive Analytics (LSTM)",
    description:
      "Uses time-series learning to project demand and identify upcoming congestion.",
  },
  {
    icon: Brain,
    title: "Dynamic Staff Allocation",
    description:
      "Balances staff load dynamically to maintain service quality during fluctuations.",
  },
  {
    icon: Lightbulb,
    title: "Smart Alerts & Recommendations",
    description:
      "Provides clear recommendations such as reallocating staff or opening counters.",
  },
  {
    icon: Sparkles,
    title: "Staff Management Dashboard",
    description:
      "Unified interface for supervisors to review and act on live optimization outputs.",
  },
];

const workflow = [
  "Capture via camera",
  "Detect people",
  "Analyze queues",
  "Predict congestion",
  "Optimize staff allocation",
];

const impactStats = [
  { value: "38%", label: "Reduced waiting time", icon: Clock3 },
  { value: "29%", label: "Better staff utilization", icon: Users },
  { value: "41%", label: "Improved operational efficiency", icon: Activity },
  { value: "Multi-site", label: "Scalable for smart cities", icon: Radar },
];

export default function Home() {
  return (
    <main className="relative overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-sky-300/35 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-cyan-200/45 blur-3xl" />
        <div className="absolute bottom-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:px-8 lg:pt-24">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-8 shadow-[0_24px_80px_-42px_rgba(14,116,144,0.45)] backdrop-blur-xl sm:p-12"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.23),transparent_32%),radial-gradient(circle_at_82%_7%,rgba(6,182,212,0.16),transparent_28%)]" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-sm font-medium text-sky-700">
              Intelligent Operations Platform
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              AI-Powered Smart Queue Optimization System
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
              Real-time detection, predictive analytics, and intelligent staff allocation
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                View Live Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                Explore Features
              </a>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="problem">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="section-title text-slate-900">The Operational Challenge</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Traditional queue management struggles to keep pace with rapidly changing demand.
          </p>
        </motion.div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problemCards.map((card, i) => (
            <motion.article
              key={card.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <card.icon className="h-5 w-5 text-sky-600" />
              <h3 className="mt-4 font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="solution">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="section-title text-slate-900">AI Solution Pipeline</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            A streamlined decision flow that turns camera feeds into real-time staffing intelligence.
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {pipelineSteps.map((step, i) => (
            <motion.div
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <step.icon className="h-5 w-5 text-cyan-700" />
              <h3 className="mt-3 text-sm font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.description}</p>
              {i < pipelineSteps.length - 1 ? (
                <span className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-300 lg:block">
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : null}
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="features">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="section-title text-slate-900">Core Features</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Purpose-built capabilities for queue-heavy environments that require speed and precision.
          </p>
        </motion.div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.article
              key={feature.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-sky-200 hover:shadow-lg"
            >
              <div className="inline-flex rounded-xl bg-sky-50 p-2 text-sky-700 transition group-hover:bg-sky-100">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="how-it-works">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="section-title text-slate-900">How It Works</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            From perception to decisioning, the system closes the loop in near real time.
          </p>
        </motion.div>
        <ol className="mt-8 grid gap-4 md:grid-cols-5">
          {workflow.map((step, i) => (
            <motion.li
              key={step}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <p className="mt-3 text-sm font-medium text-slate-800">{step}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="preview">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.35)] sm:p-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="section-title text-slate-900">Live System Preview</h2>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Live Insights
            </span>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-medium text-slate-700">Counter Forecast (Current → 15 min)</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span className="text-slate-700">Counter 1</span>
                  <span className="font-semibold text-slate-900">3 → 6</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <span className="text-amber-900">Counter 2</span>
                  <span className="font-semibold text-amber-900">10 → 15 ⚠️</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <span className="text-slate-700">Counter 3</span>
                  <span className="font-semibold text-slate-900">2 → 3</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-medium text-slate-700">Recommendations</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="rounded-xl bg-white px-4 py-3">Move 1 staff to Counter 2</li>
                <li className="rounded-xl bg-white px-4 py-3">Open new counter</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 sm:px-8" id="impact">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
        >
          <h2 className="section-title text-slate-900">Measured Impact</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Designed for practical outcomes across retail, public service, and smart city infrastructure.
          </p>
        </motion.div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {impactStats.map((item, i) => (
            <motion.article
              key={item.label}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={fadeUp}
              transition={{ duration: 0.45, delay: i * 0.07 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <item.icon className="h-5 w-5 text-cyan-700" />
              <p className="mt-4 text-2xl font-semibold text-slate-900">{item.value}</p>
              <p className="mt-1 text-sm text-slate-600">{item.label}</p>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-14 sm:px-8" id="cta">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          transition={{ duration: 0.55 }}
          className="rounded-3xl border border-slate-200 bg-[linear-gradient(145deg,#e0f2fe,#f8fafc)] p-8 text-center shadow-sm sm:p-12"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Transform Queue Management with AI
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Deploy a smarter operational layer that predicts demand and optimizes teams in real time.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Launch Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-slate-200/80 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-sm text-slate-500 sm:flex-row sm:px-8">
          <p className="font-medium text-slate-700">Smart Queue AI</p>
          <p>Intelligent queue orchestration for modern service operations.</p>
        </div>
      </footer>
    </main>
  );
}
