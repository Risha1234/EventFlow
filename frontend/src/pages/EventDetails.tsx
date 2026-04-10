import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle2, Clock, Ticket, CreditCard } from 'lucide-react';
import { Button, Badge, Card } from '../components/ui';
import BackgroundEffects from '../components/ui/BackgroundEffects';
import { trackActivity } from '../utils/tracking';

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [showSimulatedPayment, setShowSimulatedPayment] = useState(false);
  const [formResponses, setFormResponses] = useState<Record<string, string | number>>({});
  const hasTrackedView = useRef(false);

  useEffect(() => {
    fetchEventDetails();
    fetchMyStatus();
    
    // View tracking — runs only once per mount
    if (id && !hasTrackedView.current) {
      trackActivity(parseInt(id), 'view');
      hasTrackedView.current = true;
    }
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/events/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setEvent(data);
      } else {
        alert(data.error || 'Event not found');
        navigate('/dashboard/events');
      }
    } catch (err) {
      console.error('Error fetching event details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyStatus = async () => {
    try {
      // Fetch both registrations and bookings
      const [regRes, bookRes] = await Promise.all([
        fetch('http://localhost:5000/api/registrations/my', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch('http://localhost:5000/api/bookings/my', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const regData = await regRes.json();
      const bookData = await bookRes.json();

      const booking = Array.isArray(bookData) && bookData.find((b: any) => b.event_id === parseInt(id || '0') && b.status === 'success');
      if (booking) {
        setMyStatus(`booked: ${booking.ticket_type}`);
        return;
      }

      const registration = Array.isArray(regData) && regData.find((r: any) => r.event_id === parseInt(id || '0'));
      if (registration) {
        setMyStatus(registration.status);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const validateFormResponses = () => {
    if (!event || !event.form_fields) return true;
    for (const field of event.form_fields) {
      if (field.required) {
        const val = formResponses[field.id];
        if (val === undefined || val === null || String(val).trim() === '') {
          alert(`Please fill out the required field: ${field.label}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateFormResponses()) return;
    setRegistering(true);
    try {
      const response = await fetch('http://localhost:5000/api/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ event_id: parseInt(id || '0'), responses: formResponses })
      });

      const data = await response.json();
      if (response.ok) {
        if (data.status === 'confirmed') {
          alert('Registered successfully!');
          setMyStatus('confirmed');
          trackActivity(parseInt(id || '0'), 'register');
        } else if (data.status === 'waitlisted') {
          alert('Added to waitlist');
          setMyStatus('waitlisted');
          trackActivity(parseInt(id || '0'), 'register');
        }
        fetchEventDetails();
      } else {
        alert(data.error || 'Failed to register');
      }
    } catch (err) {
      console.error('Error registering:', err);
    } finally {
      setRegistering(false);
    }
  };

  const handleBuyTicket = async () => {
    if (!selectedTicketId) return;
    if (!validateFormResponses()) {
      setShowSimulatedPayment(false);
      return;
    }
    setRegistering(true);
    try {
      const response = await fetch('http://localhost:5000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          event_id: parseInt(id || '0'),
          ticket_id: selectedTicketId,
          responses: formResponses
        })
      });

      const data = await response.json();
      if (response.ok) {
        setShowSimulatedPayment(false);
        alert('Booking confirmed successfully!');
        setMyStatus(`booked: ${data.ticket.name}`);
        trackActivity(parseInt(id || '0'), 'register');
        fetchEventDetails();
      } else {
        alert(data.error || 'Failed to process booking');
        setShowSimulatedPayment(false);
      }
    } catch (err) {
      console.error('Error processing booking:', err);
      alert('An error occurred during booking.');
      setShowSimulatedPayment(false);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-zinc-500 animate-pulse font-medium">Loading event details...</div>
      </div>
    );
  }

  if (!event) return null;

  const isBooked = myStatus && myStatus.startsWith('booked:');

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-8 pb-32 relative min-h-screen">
      <BackgroundEffects />

      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-all duration-300 group mb-4"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-sm font-medium">Back to Events</span>
      </button>

      <div className="space-y-12">
        {/* Hero Section */}
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={
                event.available_seats > 0 ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
            }>
                {event.available_seats > 0 ? `${event.available_seats} Seats Available` : 'Waitlist Only'}
            </Badge>
            <Badge className={`text-[10px] ${event.is_paid ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
              {event.is_paid ? '💰 Paid Event' : '🎉 Free Event'}
            </Badge>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black text-white leading-tight tracking-tighter">
            {event.title}
          </h1>
          
          <p className="text-lg text-zinc-400 leading-relaxed max-w-3xl whitespace-pre-wrap">
            {event.description}
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-6 bg-zinc-900/40 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-500 border border-violet-600/20">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Date & Time</p>
                  <p className="text-white font-bold">{new Date(event.date).toLocaleDateString()}</p>
                </div>
              </Card>
              <Card className="p-6 bg-zinc-900/40 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/10 flex items-center justify-center text-indigo-500 border border-indigo-600/20">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Location</p>
                  <p className="text-white font-bold">{event.location}</p>
                </div>
              </Card>
            </div>

            {/* Ticket Selection (Paid) */}
            {event.is_paid && !isBooked && (
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <Ticket className="text-violet-500" size={20} />
                  <h3 className="text-lg font-bold text-white tracking-tight">Select your ticket</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.tickets && event.tickets.map((ticket: any) => {
                    const isSoldOut = ticket.sold >= ticket.quantity;
                    const isSelected = selectedTicketId === ticket.id;
                    
                    return (
                      <div 
                        key={ticket.id}
                        onClick={() => !isSoldOut && setSelectedTicketId(ticket.id)}
                        className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden group ${
                          isSoldOut 
                            ? 'opacity-40 border-zinc-800 bg-zinc-900/20 grayscale pointer-events-none' 
                            : isSelected 
                              ? 'border-violet-500 bg-violet-500/10 shadow-2xl shadow-violet-500/10' 
                              : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 size={18} className="text-violet-500" />
                          </div>
                        )}
                        
                        <div className="mb-2">
                          <h4 className={`text-base font-bold ${isSelected ? 'text-violet-400' : 'text-white'}`}>
                            {ticket.name}
                          </h4>
                          <span className={`text-2xl font-black ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            ₹{Number(ticket.price).toLocaleString()}
                          </span>
                        </div>
                        
                        <p className="text-xs text-zinc-500">
                          {isSoldOut ? 'Sold Out' : `${ticket.quantity - ticket.sold} seats remaining`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Dynamic Registration Form */}
            {event.form_fields && event.form_fields.length > 0 && !isBooked && myStatus !== 'confirmed' && myStatus !== 'waitlisted' && (
              <section className="space-y-6 pt-4">
                <div className="flex items-center gap-3">
                  <Users className="text-indigo-500" size={20} />
                  <h3 className="text-lg font-bold text-white tracking-tight">Registration Information</h3>
                </div>
                <Card className="p-8 bg-zinc-900/40 space-y-6">
                   {event.form_fields.map((f: any) => (
                      <div key={f.id} className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
                          {f.label} {f.required && <span className="text-violet-500">*</span>}
                        </label>
                        {f.type === 'textarea' ? (
                          <textarea
                            required={f.required}
                            value={formResponses[f.id] || ''}
                            onChange={(e) => setFormResponses({ ...formResponses, [f.id]: e.target.value })}
                            className="w-full min-h-[120px] p-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none placeholder:text-zinc-700"
                            placeholder={`Enter your ${f.label.toLowerCase()}`}
                          />
                        ) : f.type === 'select' ? (
                          <div className="relative">
                            <select
                              required={f.required}
                              value={formResponses[f.id] || ''}
                              onChange={(e) => setFormResponses({ ...formResponses, [f.id]: e.target.value })}
                              className="w-full h-12 px-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors appearance-none"
                            >
                              <option value="" disabled>Select option</option>
                              {f.options && f.options.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                              <ArrowLeft size={16} className="rotate-[270deg]" />
                            </div>
                          </div>
                        ) : (
                          <input
                            type={f.type === 'number' ? 'number' : 'text'}
                            required={f.required}
                            value={formResponses[f.id] || ''}
                            onChange={(e) => setFormResponses({ ...formResponses, [f.id]: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl bg-zinc-950/50 border border-zinc-800 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors placeholder:text-zinc-700"
                            placeholder={`Enter your ${f.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                   ))}
                </Card>
              </section>
            )}
          </div>

          {/* Sidebar / Actions */}
          <div className="lg:sticky lg:top-12 space-y-6">
            <Card className="p-8 bg-zinc-900/60 border-zinc-800/80 shadow-2xl shadow-violet-500/5">
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-zinc-500">
                  <Users size={18} className="text-indigo-500/50" />
                  <span className="text-xs font-bold uppercase tracking-widest">Availability</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-end justify-between">
                    <span className="text-4xl font-black text-white">{event.available_seats}</span>
                    <span className="text-zinc-500 text-sm font-medium mb-1">/ {event.total_seats} total seats</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-1000"
                      style={{ width: `${(event.available_seats / event.total_seats) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800">
                  {myStatus === 'confirmed' ? (
                    <div className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                      <CheckCircle2 size={20} />
                      <span className="text-sm font-bold">Successfully Registered</span>
                    </div>
                  ) : isBooked ? (
                    <div className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-500">
                      <CheckCircle2 size={20} />
                      <span className="text-sm font-bold">Ticket Booked</span>
                    </div>
                  ) : myStatus === 'waitlisted' ? (
                    <div className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                      <Clock size={20} />
                      <span className="text-sm font-bold">You're on the Waitlist</span>
                    </div>
                  ) : event.is_paid ? (
                    <div className="space-y-4">
                      <Button 
                        onClick={() => setShowSimulatedPayment(true)} 
                        disabled={!selectedTicketId || registering}
                        className="w-full h-14 text-sm font-black uppercase tracking-widest"
                      >
                        {registering ? 'Processing...' : 'Secure Checkout'}
                      </Button>
                      {!selectedTicketId && (
                        <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-wider animate-pulse">
                          Select a ticket type to continue
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button 
                      onClick={handleRegister} 
                      disabled={registering}
                      className="w-full h-14 text-sm font-black uppercase tracking-widest"
                    >
                      {registering ? 'Processing...' : event.available_seats > 0 ? 'Register Now' : 'Join Waitlist'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            <p className="text-center text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">
              Powered by EventFlow+
            </p>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showSimulatedPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <Card className="max-w-md w-full p-8 shadow-2xl relative overflow-hidden bg-zinc-900 animate-in zoom-in-95 duration-300">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-violet-600/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-violet-600/20">
                <CreditCard className="text-violet-500" size={32} />
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight mb-2">Checkout</h3>
              <p className="text-sm text-zinc-500">Confirm your simulation purchase</p>
            </div>

            <div className="bg-zinc-950 rounded-2xl p-6 space-y-4 border border-zinc-800 mb-8 font-mono text-xs">
              <div className="flex justify-between items-start">
                <span className="text-zinc-600">ITEM</span>
                <span className="text-white text-right max-w-[200px]">{event.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">TYPE</span>
                <span className="text-violet-400 font-bold">
                  {event.tickets?.find((t: any) => t.id === selectedTicketId)?.name}
                </span>
              </div>
              <div className="pt-4 border-t border-zinc-800 flex justify-between text-base font-bold">
                <span className="text-zinc-400">TOTAL</span>
                <span className="text-white tracking-tight">
                  ₹{Number(event.tickets?.find((t: any) => t.id === selectedTicketId)?.price).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleBuyTicket} 
                disabled={registering}
                className="w-full h-14 text-sm font-bold tracking-widest uppercase"
              >
                {registering ? 'Processing...' : 'Complete Payment'}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setShowSimulatedPayment(false)}
                disabled={registering}
                className="w-full h-12 text-zinc-500"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
