import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui';
import { Zap, Globe, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function SignupPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Registration successful:', data);
        alert('Registration successful! Please log in.');
        navigate('/login');
      } else {
        console.error('Registration failed:', data.error || 'Unknown error');
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 pb-20">
      <Link to="/" className="fixed top-8 left-8 text-zinc-500 hover:text-white transition-colors flex items-center gap-2 text-sm">
        <ArrowLeft size={16} /> Back to site
      </Link>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
          <p className="text-zinc-500 mt-2">Get started with EventFlow+ today</p>
        </div>

        <div className="bg-surface border border-border p-8 rounded-[2rem] shadow-xl">
          <form className="space-y-6" onSubmit={handleSignup}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Full Name</label>
              <input 
                type="text" 
                placeholder="John Doe"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Email Address</label>
              <input 
                type="email" 
                placeholder="name@example.com"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Password</label>
              <input 
                type="password" 
                placeholder="Make it strong"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
              />
            </div>
            
            <div className="flex items-start gap-3">
                <input type="checkbox" required className="mt-1 rounded border-zinc-800 bg-zinc-900 text-primary-600 focus:ring-primary-600/20 focus:ring-offset-background" />
                <p className="text-xs text-zinc-500 leading-tight">
                    I agree to the <a href="#" className="text-primary-500 hover:underline">Terms of Service</a> and <a href="#" className="text-primary-500 hover:underline">Privacy Policy</a>.
                </p>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-zinc-500">Or sign up with</span></div>
          </div>

          <button className="w-full h-12 px-4 rounded-xl border border-zinc-800 flex items-center justify-center gap-3 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
            <Globe size={20} />
            Google
          </button>
        </div>

        <p className="text-center mt-8 text-sm text-zinc-500">
          Already have an account? <Link to="/login" className="text-primary-500 font-medium hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
