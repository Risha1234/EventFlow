import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button, ShaderBackground } from '../components/ui';
import {
  Zap, ChevronRight,
  Sparkles, Rocket, Gauge, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Parallax transforms
  const backgroundY = useTransform(scrollY, [0, 1000], [0, -300]);
  const heroGlowY = useTransform(scrollY, [0, 800], [0, -200]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen text-foreground selection:bg-primary-500/30 selection:text-primary-200 relative overflow-hidden">
      <ShaderBackground />
      <style>{`

        @keyframes float-subtle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes glow-pulse {
          0%, 100% { text-shadow: 0 0 20px rgba(139,92,246,0.3), 0 0 60px rgba(99,102,241,0.15), 0 0 100px rgba(139,92,246,0.05); }
          50% { text-shadow: 0 0 40px rgba(139,92,246,0.5), 0 0 80px rgba(99,102,241,0.3), 0 0 120px rgba(139,92,246,0.1); }
        }
        
        .glow-text {
          animation: glow-pulse 4s ease-in-out infinite;
        }

        @keyframes shimmer-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }

        .shimmer-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 50%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(139,92,246,0.08) 25%,
            rgba(255,255,255,0.15) 50%,
            rgba(139,92,246,0.08) 75%,
            transparent 100%
          );
          animation: shimmer-sweep 4s ease-in-out 1.8s;
          pointer-events: none;
        }
      `}</style>

      <MeshGradient backgroundY={backgroundY} heroGlowY={heroGlowY} />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-[100] border-b border-white/[0.08] bg-zinc-950/60 backdrop-blur-2xl backdrop-saturate-150">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 group cursor-pointer"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
              <Zap className="text-white fill-white" size={20} />
            </div>
            <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              EventFlow<span className="text-primary-500">+</span>
            </span>
          </motion.div>

          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-zinc-400">
            {['Features', 'How it works', 'Pricing'].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.toLowerCase().replace(/\s+/g, '-'))?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors relative group"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-primary-500 group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <Button size="sm" className="shadow-primary-500/20 shadow-lg" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Log in</Button>
                <Button size="sm" className="shadow-primary-500/20 shadow-lg" onClick={() => navigate('/register')}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative z-[2] min-h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-8"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6 }}
              >
                <Badge className="mb-8">
                  <Sparkles size={12} className="mr-2" />
                  Next-Gen Event Management
                </Badge>
              </motion.div>
              <motion.h1
                className="text-7xl md:text-9xl font-black tracking-tighter mb-10 leading-none glow-text h-auto relative"
              >
                <div className="inline-block relative">
                  {"EventFlow+".split("").map((char, i) => (
                    <motion.span
                      key={i}
                      initial={{
                        opacity: 0,
                        y: 60,
                        scale: 0.5,
                        filter: 'blur(20px)',
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                      }}
                      transition={{
                        delay: 0.3 + i * 0.1,
                        duration: 0.9,
                        ease: [0.25, 0.46, 0.45, 0.94]
                      }}
                      className="inline-block"
                    >
                      {char === "+" ? (
                        <motion.span
                          className="text-transparent bg-gradient-to-r from-violet-400 via-primary-500 to-indigo-400 bg-clip-text font-black"
                          animate={{
                            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                          }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ backgroundSize: '200% 200%' }}
                        >+</motion.span>
                      ) : (
                        <span className="bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">{char}</span>
                      )}
                    </motion.span>
                  ))}
                  {/* Shimmer sweep across text */}
                  <div className="shimmer-overlay" />
                </div>
                {/* Glow backdrop behind text - blends with shader */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 1.5, ease: 'easeOut' }}
                  className="absolute inset-0 -z-10 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.04) 40%, transparent 70%)',
                    filter: 'blur(30px)',
                  }}
                />
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
              >
                Discover. Register. Organize events seamlessly.
              </motion.p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-16 px-10 group relative overflow-hidden hover:shadow-[0_0_40px_rgba(99,102,241,0.6)] transition-all duration-300 active:scale-95 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-indigo-600"
                    onClick={() => {
                      if (localStorage.getItem('token')) {
                        navigate('/dashboard/events');
                      } else {
                        localStorage.setItem("intent", "explore");
                        navigate('/login');
                      }
                    }}
                  >
                    <span className="relative z-10 flex items-center gap-2 font-bold">
                      Explore Events <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform duration-300" />
                    </span>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary-400 to-indigo-400 group-hover:h-full transition-all duration-300 opacity-0 group-hover:opacity-100" />
                  </Button>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto"
                >
                  <Button
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto h-16 px-10 group border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl hover:border-primary-500/50 hover:bg-white/[0.08] transition-all duration-300 active:scale-95 hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] font-bold"
                    onClick={() => {
                      if (localStorage.getItem('token')) {
                        navigate('/dashboard/events');
                      } else {
                        localStorage.setItem("intent", "host");
                        navigate('/login');
                      }
                    }}
                  >
                    <Zap size={20} className="mr-2 fill-current group-hover:scale-125 transition-transform duration-300 group-hover:rotate-12" /> Start Hosting
                  </Button>
                </motion.div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => navigate('/admin/login')}
                  className="text-xs font-bold text-zinc-500 hover:text-primary-400 transition-all duration-300 uppercase tracking-[0.2em] mt-4 sm:mt-0 hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.3)]"
                >
                  Admin Portal
                </motion.button>
              </div>

              {/* Inline Stats - replaces Dashboard3D */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto"
              >
                {[
                  { value: '10K+', label: 'Events Hosted' },
                  { value: '2.4M', label: 'Registrations' },
                  { value: '99.9%', label: 'Uptime' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.15, duration: 0.5 }}
                    className="text-center"
                  >
                    <div className="text-3xl md:text-4xl font-black bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                      {stat.value}
                    </div>
                    <div className="text-xs font-medium text-zinc-500 mt-2 uppercase tracking-widest">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.8 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-1.5"
          >
            <motion.div className="w-1.5 h-1.5 rounded-full bg-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats/Logo Cloud */}
      <section id="how-it-works" className="py-20 border-y border-white/[0.06] bg-zinc-950/40 backdrop-blur-md relative z-[2] overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto px-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12 items-center">
            {['Intelligent', 'Real-Time', 'Scalable', 'Secure'].map((logo, idx) => (
              <motion.div
                key={logo}
                initial={{ opacity: 0.3, y: 20 }}
                whileInView={{ opacity: 0.5, y: 0 }}
                whileHover={{ opacity: 1, scale: 1.05 }}
                transition={{ delay: idx * 0.15, duration: 0.5 }}
                viewport={{ once: true }}
                className="text-2xl font-black text-center text-zinc-600 hover:text-white transition-all duration-300 cursor-default grayscale hover:grayscale-0"
              >
                {logo}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-40 px-6 relative z-[2] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <motion.header
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true, margin: "-100px" }}
            className="max-w-2xl mb-24"
          >
            <h2 className="text-5xl font-bold tracking-tight mb-6">Designed for <br /><span className="text-primary-500">Peak Performance.</span></h2>
            <p className="text-zinc-400 text-lg font-light">Eliminate bottlenecks and friction with our proprietary event engine.</p>
          </motion.header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Rocket className="w-8 h-8" />}
              title="Ultra-Low Latency"
              desc="Real-time synchronization across all devices. Sync seat availability in under 50ms."
              color="from-amber-500/20 to-orange-500/20"
              index={0}
            />
            <FeatureCard
              icon={<Gauge className="w-8 h-8" />}
              title="Elastic Capacity"
              desc="Auto-scaling infrastructure that handles 1M+ simultaneous registrations without sweat."
              color="from-blue-500/20 to-indigo-500/20"
              index={1}
            />
            <FeatureCard
              icon={<Lock className="w-8 h-8" />}
              title="Military-Grade Security"
              desc="End-to-end encryption for all attendee data and financial transactions."
              color="from-emerald-500/20 to-teal-500/20"
              index={2}
            />
          </div>
        </div>
      </section>

      {/* Divider Section */}
      <section className="py-20 px-6 overflow-hidden relative z-[2]">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-[0.3em] whitespace-nowrap">Premium Features</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
        </div>
      </section>

      {/* CTA Section */}
      <section id="pricing" className="py-60 px-6 relative z-[2] overflow-hidden">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 1 }}
            viewport={{ once: true }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-600/10 rounded-full blur-[120px]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-5xl mx-auto rounded-[4rem] p-24 bg-zinc-950/50 backdrop-blur-2xl border border-white/[0.08] text-center relative z-10 shadow-2xl hover:border-primary-500/30 transition-all duration-500 hover:shadow-2xl hover:shadow-primary-500/10"
        >
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            viewport={{ once: true }}
            className="text-6xl font-bold mb-8 tracking-tighter"
          >
            Ready to evolve?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
            className="text-2xl text-zinc-400 mb-12 max-w-xl mx-auto font-light leading-relaxed"
          >
            Join the next generation of event organizers creating unforgettable experiences.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="lg"
                className="h-16 px-12 text-lg font-bold shadow-2xl shadow-primary-500/40 hover:shadow-3xl hover:shadow-primary-500/50 transition-all duration-300 hover:scale-105 active:scale-95"
                onClick={() => navigate('/register')}
              >
                Get Started Now
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-32 px-6 border-t border-white/[0.06] relative z-[2] bg-zinc-950/95 backdrop-blur-xl overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16"
        >
          <div className="col-span-1 md:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              viewport={{ once: true }}
              className="flex items-center gap-3 mb-8"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-indigo-600 rounded-xl flex items-center justify-center hover:scale-110 transition-transform duration-300">
                <Zap className="text-white fill-white" size={20} />
              </div>
              <span className="text-2xl font-bold tracking-tighter text-white">EventFlow<span className="text-primary-500">+</span></span>
            </motion.div>
            <p className="text-zinc-500 text-lg max-w-sm font-light leading-relaxed hover:text-zinc-400 transition-colors">
              Setting the global standard for professional event infrastructure and real-time attendee management.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">Product</h4>
            <ul className="space-y-4 text-zinc-500 font-medium">
              {['Features', 'Intelligence', 'Security', 'Pricing', 'API'].map((item, idx) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.05 }}
                  viewport={{ once: true }}
                >
                  <a href="#" className="hover:text-primary-400 transition-colors duration-300">{item}</a>
                </motion.li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-8 uppercase tracking-widest text-xs">Platform</h4>
            <ul className="space-y-4 text-zinc-500 font-medium">
              {['Support', 'Documentation', 'Changelog', 'Status', 'Legal'].map((item, idx) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + idx * 0.05 }}
                  viewport={{ once: true }}
                >
                  <a href="#" className="hover:text-primary-400 transition-colors duration-300">{item}</a>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-zinc-600 text-sm"
        >
          <p>© 2024 EventFlow Plus Global. All rights reserved.</p>
          <div className="flex items-center gap-10">
            <a href="#" className="hover:text-white transition-colors duration-300">Privacy Infrastructure</a>
            <a href="#" className="hover:text-white transition-colors duration-300">Terms of Protocol</a>
          </div>
        </motion.div>
      </footer>
    </div>
  );
}

function MeshGradient({ backgroundY, heroGlowY }: { backgroundY?: any; heroGlowY?: any }) {
  return (
    <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden">
      {/* Subtle accent glow - complements shader without competing */}
      <motion.div
        className="absolute top-0 -left-[10%] w-[600px] h-[600px] bg-primary-600/8 blur-[100px] rounded-full"
        style={{ y: backgroundY }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.06, 0.12, 0.06],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Soft hero accent */}
      <motion.div
        className="absolute top-1/3 -right-[15%] w-[400px] h-[400px] bg-indigo-600/8 blur-[80px] rounded-full"
        style={{ y: heroGlowY }}
        animate={{
          scale: [1.1, 0.95, 1.1],
          opacity: [0.05, 0.14, 0.05],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
      />
    </div>
  )
}


function FeatureCard({ icon, title, desc, color, index = 0 }: { icon: React.ReactNode, title: string, desc: string, color: string, index?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * -15;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * 15;
    setRotate({ x, y });
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setRotate({ x: 0, y: 0 })}
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -16, scale: 1.03 }}
      transition={{
        duration: 0.6,
        delay: index * 0.15,
        when: "beforeChildren"
      }}
      viewport={{ once: true, margin: "-50px" }}
      style={{
        rotateX: rotate.x,
        rotateY: rotate.y,
        perspective: 1200,
        transformStyle: "preserve-3d"
      }}
      className="p-10 rounded-[2.5rem] bg-zinc-950/50 backdrop-blur-xl border border-white/[0.08] hover:border-primary-500/40 transition-all duration-500 group relative overflow-hidden cursor-default shadow-lg hover:shadow-[0_0_60px_rgba(99,102,241,0.2)] hover:bg-zinc-950/60"
    >
      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-8 group-hover:scale-125 transition-all duration-300 group-hover:shadow-[0_0_30px_rgba(99,102,241,0.4)]`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 transition-colors group-hover:text-primary-300">{title}</h3>
      <p className="text-zinc-400 leading-relaxed font-light group-hover:text-zinc-200 transition-colors">{desc}</p>

      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-primary-600/10 rounded-full blur-3xl group-hover:bg-primary-500/20 transition-all duration-500" />
    </motion.div>
  );
}

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`px-4 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 border border-white/10 inline-flex items-center backdrop-blur-md ${className}`}>
    {children}
  </div>
);

