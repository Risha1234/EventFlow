import API_URL from "../utils/api";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../components/ui';
import { Zap, Globe, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        console.log('Login successful', { token: data.token, role: data.role });
        
        // Handle intent-based redirection
        const intent = localStorage.getItem("intent");
        console.log("Intent:", intent);
        
        if (intent === "host") {
          // User clicked "Start Hosting" - upgrade to organizer
          try {
            const becomeOrgResponse = await fetch(`${API_URL}/become-organizer`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            });

            if (becomeOrgResponse.ok) {
              const orgData = await becomeOrgResponse.json();
              // Update token with organizer role
              localStorage.setItem('token', orgData.token);
              localStorage.setItem('role', 'organizer');
              console.log('Upgraded to organizer:', orgData.user);
            } else {
              console.error('Failed to upgrade to organizer');
              alert('Failed to upgrade to organizer role');
              return;
            }
          } catch (err) {
            console.error('Error upgrading to organizer:', err);
            alert('Error upgrading to organizer role');
            return;
          }
          
          localStorage.removeItem("intent");
          navigate("/organizer/dashboard");
        } else if (intent === "explore") {
          // User clicked "Explore Events"
          localStorage.setItem("hideBecomeOrganizer", "true");
          localStorage.setItem("hideCreateEvent", "true");
          localStorage.removeItem("intent");
          navigate("/dashboard/events");
        } else {
          // Normal login - follow JWT role
          localStorage.removeItem("intent");
          const decoded: any = jwtDecode(data.token);
          const role = decoded.role;
          
          if (role === 'organizer') {
            navigate('/organizer/dashboard');
          } else {
            navigate('/dashboard/events');
          }
        }
      } else {
        console.error('Login failed:', data.error || 'Unknown error');
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
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
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-zinc-500 mt-2">Enter your credentials to access your events</p>
        </div>

        <div className="bg-surface border border-border p-8 rounded-[2rem] shadow-xl">
          <form className="space-y-6" onSubmit={handleLogin}>
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
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-400">Password</label>
                <a href="#" className="text-xs text-primary-500 hover:underline">Forgot password?</a>
              </div>
              <input 
                type="password" 
                placeholder="••••••••"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold">
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-zinc-500">Or continue with</span></div>
          </div>

          <button className="w-full h-12 px-4 rounded-xl border border-zinc-800 flex items-center justify-center gap-3 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all">
            <Globe size={20} />
            Google
          </button>
        </div>

        <p className="text-center mt-8 text-sm text-zinc-500">
          Don't have an account? <Link to="/register" className="text-primary-500 font-medium hover:underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}
