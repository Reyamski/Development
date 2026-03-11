import { ChevronRight, Flame, ShieldCheck, Truck, Sparkles, Star, Zap, Play, Swords, Trophy, BellRing } from 'lucide-react';
import { motion } from 'framer-motion';

const featuredProducts = [
  {
    title: 'Bandai Namco One Piece Two Legends Card Game OP-08, English Version, 12-Card Booster Pack',
    subtitle: 'English • Sold out',
    price: '$50.00',
    badge: 'Featured',
    image: 'https://cloudninecards.ca/cdn/shop/files/71qBWvl1uRL._AC_SL1500.jpg?v=1771572122&width=3840',
  },
  {
    title: 'Bandai One Piece Card Game Extra Booster One Piece Heroines Edition [EB-03]',
    subtitle: 'Japanese • Sold out',
    price: '$131.00',
    badge: 'Popular',
    image: 'https://cloudninecards.ca/cdn/shop/files/61X1xcYYFCL._AC_SL1088.jpg?v=1771571570&width=500',
  },
  {
    title: 'BANDAI ONE Piece Card Game, Fist of God Speed (OP-11) Booster Box - 24 Packs',
    subtitle: 'Japanese • Sold out',
    price: '$139.28',
    badge: 'Hot Drop',
    image: 'https://cloudninecards.ca/cdn/shop/files/61VDeW8QgNL._AC_SL1200.jpg?v=1771571417&width=500',
  },
];

const collections = [
  {
    title: 'Two Legends OP-08',
    desc: 'Main storyline energy with louder framing and stronger visual drama.',
    image: 'https://cloudninecards.ca/cdn/shop/files/71qBWvl1uRL._AC_SL1500.jpg?v=1771572122&width=3840',
  },
  {
    title: 'One Piece Heroines EB-03',
    desc: 'Secondary arc card styled like a featured character banner.',
    image: 'https://cloudninecards.ca/cdn/shop/files/61X1xcYYFCL._AC_SL1088.jpg?v=1771571570&width=500',
  },
  {
    title: 'Fist of God Speed OP-11',
    desc: 'Boss-fight section feel with more impact than plain collection cards.',
    image: 'https://cloudninecards.ca/cdn/shop/files/61VDeW8QgNL._AC_SL1200.jpg?v=1771571417&width=500',
  },
];

const trust = [
  { icon: ShieldCheck, title: 'Trusted Storefront', desc: 'Cleaner branding and policy visibility builds buyer confidence.' },
  { icon: Truck, title: 'Shipping Clarity', desc: 'Buyer sees preorder, shipping, and tax notes right away.' },
  { icon: Flame, title: 'Hot Drops First', desc: 'Your biggest releases get the spotlight instead of buried listings.' },
  { icon: Star, title: 'Collector Feel', desc: 'More premium visual style so the brand feels memorable.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#05010c] text-white">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-fuchsia-500/20 bg-[#07030f]">
        <img
          src="https://cloudninecards.ca/cdn/shop/files/One-Piece-Wallpaper-HD-Free-download.png?v=1771326893&width=3840"
          alt="hero"
          className="absolute inset-0 h-full w-full object-cover opacity-30 saturate-[1.45]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(5,1,12,0.98)_0%,rgba(23,7,48,0.94)_35%,rgba(40,10,66,0.74)_58%,rgba(0,229,255,0.16)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.35),transparent_22%),radial-gradient(circle_at_left_center,rgba(168,85,247,0.3),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.22),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:30px_30px] opacity-50" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-6 md:pb-24 md:pt-8">
          {/* Nav */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-yellow-300 bg-clip-text text-2xl font-black tracking-[0.28em] text-transparent md:text-3xl">
                CLOUDNINECARDS
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.34em] text-white/45">
                full hype anime • premium tcg drops • sealed madness
              </div>
            </div>
            <div className="hidden items-center gap-6 text-sm font-bold uppercase tracking-[0.14em] text-white/75 md:flex">
              <a href="/" className="transition hover:text-cyan-300">Home</a>
              <a href="/collections/all" className="transition hover:text-cyan-300">Shop</a>
              <a href="/collections/pre-orders" className="transition hover:text-cyan-300">Pre-orders</a>
              <a href="/collections/new-arrivals" className="transition hover:text-cyan-300">New Arrivals</a>
              <a href="/pages/contact" className="transition hover:text-cyan-300">Contact</a>
            </div>
          </div>

          {/* Hero Content */}
          <div className="grid items-center gap-10 md:grid-cols-[1.04fr_0.96fr] md:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-fuchsia-100 shadow-[0_0_35px_rgba(217,70,239,0.22)]">
                <Sparkles className="h-4 w-4" /> New Season Drop
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <span className="inline-flex -skew-x-12 items-center gap-2 border border-cyan-300/35 bg-cyan-300/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100">
                  <Zap className="h-3.5 w-3.5 skew-x-12" /><span className="skew-x-12">New Arc</span>
                </span>
                <span className="inline-flex -skew-x-12 items-center gap-2 border border-yellow-300/35 bg-yellow-300/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-yellow-100">
                  <Play className="h-3.5 w-3.5 skew-x-12" /><span className="skew-x-12">Featured Release</span>
                </span>
                <span className="inline-flex -skew-x-12 items-center gap-2 border border-rose-300/35 bg-rose-300/12 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-rose-100">
                  <BellRing className="h-3.5 w-3.5 skew-x-12" /><span className="skew-x-12">Alert Drop</span>
                </span>
              </div>

              <div className="relative mt-6 max-w-5xl">
                <div className="absolute -left-4 top-3 h-[78%] w-1 rounded-full bg-gradient-to-b from-cyan-300 via-fuchsia-400 to-yellow-300 shadow-[0_0_18px_rgba(34,211,238,0.45)]" />
                <h1 className="pl-4 text-5xl font-black uppercase leading-[0.84] tracking-[-0.07em] md:text-8xl">
                  turn the store into an{' '}
                  <span className="block bg-gradient-to-r from-cyan-300 via-fuchsia-300 to-yellow-300 bg-clip-text text-transparent">
                    anime opening sequence.
                  </span>
                </h1>
              </div>

              <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
                More speed lines. More boss-fight energy. More collectible hype. The homepage should feel like a major card set reveal, not just a normal shop front.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-400 px-7 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_14px_40px_rgba(34,211,238,0.3)] transition hover:scale-[1.03]">
                  Enter the drop
                </button>
                <button className="rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white backdrop-blur transition hover:border-fuchsia-300/50 hover:bg-white/10">
                  See pre-orders
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                {['One Piece', 'Dragon Ball', 'Pokemon', 'Pre-orders'].map((tag, idx) => (
                  <span key={tag} className={`rounded-full border px-4 py-2 ${
                    idx === 0 ? 'border-cyan-300/25 bg-cyan-300/10' :
                    idx === 1 ? 'border-fuchsia-300/25 bg-fuchsia-300/10' :
                    idx === 2 ? 'border-yellow-300/25 bg-yellow-300/10' :
                    'border-white/10 bg-white/5'
                  }`}>{tag}</span>
                ))}
              </div>

              <div className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
                {[
                  { icon: Swords, label: 'Epic drops weekly' },
                  { icon: Trophy, label: 'Collector-first layout' },
                  { icon: Zap, label: 'High impact visuals' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.08em] text-white">
                        <Icon className="h-4 w-4 text-cyan-300" /> {item.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Hero Product Cards */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.1 }}
              className="grid gap-4"
            >
              <div className="grid grid-cols-[1.06fr_0.94fr] gap-4">
                <div className="relative overflow-hidden rounded-[34px] border border-fuchsia-400/20 bg-white/5 shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
                  <img
                    src="https://cloudninecards.ca/cdn/shop/files/71qBWvl1uRL._AC_SL1500.jpg?v=1771572122&width=3840"
                    alt="Two Legends OP-08"
                    className="h-[420px] w-full object-cover saturate-[1.35] contrast-[1.04]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.95),rgba(0,0,0,0.34),transparent)]" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                    <div className="mb-3 inline-flex rounded-full bg-red-500/90 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg">
                      Now Live
                    </div>
                    <div className="text-3xl font-black uppercase leading-none md:text-4xl">Two Legends OP-08</div>
                    <div className="mt-2 max-w-sm text-sm leading-6 text-white/78">
                      Main-character energy with stronger contrast and full reveal-event drama.
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="relative overflow-hidden rounded-[24px] border border-cyan-300/20 bg-white/5 shadow-xl">
                    <img
                      src="https://cloudninecards.ca/cdn/shop/files/61_FxpqROpL._AC_SL1200.jpg?v=1771571401&width=500"
                      alt="Arc 02"
                      className="h-[196px] w-full object-cover saturate-[1.35]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200">Royal Blood OP-10</div>
                      <div className="mt-1 text-lg font-black uppercase">Side quest card</div>
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[24px] border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(217,70,239,0.18),rgba(34,211,238,0.18))] p-5 backdrop-blur">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Power-up mode</div>
                    <div className="mt-2 text-2xl font-black uppercase leading-tight">Now this feels like a trailer.</div>
                    <p className="mt-2 text-sm leading-7 text-white/80">
                      Bigger headlines, punchier shapes, and layered effects make the page feel louder.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── TRUST BADGES ── */}
      <section className="relative mx-auto max-w-7xl px-6 py-8 md:py-12">
        <div className="grid gap-4 md:grid-cols-4">
          {trust.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5">
                <div className={`absolute inset-x-0 top-0 h-1 ${idx % 2 === 0 ? 'bg-cyan-300/80' : 'bg-fuchsia-400/80'}`} />
                <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-black/25 p-3">
                  <Icon className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="text-lg font-black uppercase">{item.title}</div>
                <p className="mt-2 text-sm leading-7 text-white/65">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── COLLECTIONS ── */}
      <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="mb-6">
          <div className="text-sm font-black uppercase tracking-[0.24em] text-violet-300/75">Story arcs / collections</div>
          <h2 className="mt-2 text-3xl font-black uppercase md:text-5xl">Browse by Collection</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {collections.map((item, idx) => (
            <div key={item.title} className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-white/5">
              <img src={item.image} alt={item.title} className="h-[410px] w-full object-cover saturate-[1.35] transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.96),rgba(0,0,0,0.35),transparent)]" />
              <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                Arc 0{idx + 1}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="text-2xl font-black uppercase md:text-3xl">{item.title}</div>
                <p className="mt-2 max-w-sm text-sm leading-7 text-white/77">{item.desc}</p>
                <button className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-cyan-100 transition hover:bg-cyan-300/15">
                  Explore Collection <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section className="mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300/75">Featured battle board</div>
            <h2 className="mt-2 text-3xl font-black uppercase md:text-5xl">Hot Drops</h2>
          </div>
          <button className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black uppercase tracking-[0.08em] text-white/80 md:inline-flex">
            View all products
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featuredProducts.map((item, idx) => (
            <div key={item.title} className="group relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,#0b1022,#14081d)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-yellow-300" />
              <div className="relative overflow-hidden">
                <img src={item.image} alt={item.title} className="h-[295px] w-full object-cover saturate-[1.35] transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/72 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white backdrop-blur">
                  {item.badge}
                </div>
              </div>
              <div className="p-5">
                <div className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300/75">{item.subtitle}</div>
                <div className="mt-2 text-xl font-black leading-snug">{item.title}</div>
                <div className="mt-4 text-3xl font-black">{item.price}</div>
                <div className="mt-5 flex gap-3">
                  <button className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-400 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:opacity-95">
                    View Product
                  </button>
                  <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition hover:bg-white/10">
                    Save
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── EMAIL CTA ── */}
      <section className="mx-auto max-w-7xl px-6 pb-20 pt-6">
        <div className="relative overflow-hidden rounded-[34px] border border-fuchsia-400/20 bg-[linear-gradient(135deg,rgba(91,33,182,0.45),rgba(14,165,233,0.18))] p-8">
          <img
            src="https://cloudninecards.ca/cdn/shop/files/One-Piece-Wallpaper-HD-Free-download.png?v=1771326893&width=3840"
            alt="CTA background"
            className="absolute inset-0 h-full w-full object-cover opacity-20 saturate-[1.45]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),rgba(0,0,0,0.25),transparent)]" />
          <div className="relative">
            <div className="text-sm font-black uppercase tracking-[0.22em] text-violet-100/80">Join the drop list</div>
            <h3 className="mt-2 max-w-lg text-3xl font-black uppercase md:text-4xl">Get early access before the next arc starts.</h3>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/82">
              Be first to know about restocks, new sets, and exclusive drops.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                className="rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/55 backdrop-blur outline-none focus:border-cyan-300/50"
              />
              <button className="rounded-2xl bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-400 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-black">
                Get early access
              </button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
