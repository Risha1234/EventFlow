import { useState, useEffect } from 'react';
import { Download, Filter, XCircle, Calendar, MapPin } from 'lucide-react';
import { Badge } from '../components/ui';

export default function WaitlistPage() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/registrations/my', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setRegistrations(data);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to leave the waitlist?')) return;
    
    try {
      const response = await fetch(`http://localhost:5000/api/registrations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        alert('Successfully left the waitlist.');
        fetchRegistrations();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel registration');
      }
    } catch (err) {
      console.error('Error cancelling:', err);
    }
  };

  const waitlisted = registrations.filter(r => r.status === 'waitlisted');

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">
            My Waitlist
          </h1>
          <p className="text-zinc-500 mt-1">
            Track your position for high-demand events.
          </p>
        </div>
        <div className="flex items-center gap-3">
            <button className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-white transition-all"><Download size={20} /></button>
            <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-sm font-medium hover:bg-white/10 transition-all">
                <Filter size={18} /> Sort by Date
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
               Pending Spots
               <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">{waitlisted.length}</Badge>
            </h2>
          </div>
          
          <div className="bg-zinc-950/50 border border-white/5 rounded-[2rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    <th className="px-8 py-6">Event Details</th>
                    <th className="px-8 py-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {waitlisted.length > 0 ? waitlisted.map((reg) => (
                    <tr key={reg.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-1">
                            <p className="text-lg font-bold text-white leading-tight">{reg.title}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-sm text-zinc-500 flex items-center gap-1.5"><Calendar size={14} className="text-amber-500" /> {new Date(reg.date).toLocaleDateString()}</span>
                              <span className="text-sm text-zinc-500 flex items-center gap-1.5"><MapPin size={14} className="text-amber-500" /> {reg.location}</span>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button 
                           onClick={() => handleCancel(reg.id)}
                           className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 border border-white/5 text-xs font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all flex items-center gap-2 ml-auto"
                        >
                          <XCircle size={14} /> Leave Waitlist
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={2} className="px-8 py-12 text-center text-zinc-500 text-sm italic">
                        {loading ? 'Loading waitlist...' : 'Your waitlist is empty.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
