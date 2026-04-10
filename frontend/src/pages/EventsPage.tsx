import API_URL from "../utils/api";
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, MoreVertical, Plus, X, Ticket, DollarSign, Trash2, FormInput, Search, Filter, XCircle, ChevronDown } from 'lucide-react';
import { Button, Badge, Card } from '../components/ui';
import BackgroundEffects from '../components/ui/BackgroundEffects';
import { jwtDecode } from 'jwt-decode';
import { trackActivity } from '../utils/tracking';

export default function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [role, setRole] = useState('');
  const [userName, setUserName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', date: '', location: '', total_seats: '50' });
  const [isPaid, setIsPaid] = useState(false);
  const [tickets, setTickets] = useState<{ name: string; price: number; quantity: number }[]>([]);
  const [formFields, setFormFields] = useState<{ label: string; type: 'text' | 'number' | 'select' | 'textarea'; required: boolean; options: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRegistrations, setMyRegistrations] = useState<any[]>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [recommendedEvents, setRecommendedEvents] = useState<any[]>([]);
  const [trendingEvents, setTrendingEvents] = useState<any[]>([]);

  // Filtering System State
  const [filters, setFilters] = useState({
    isPaid: 'all', // 'all' | 'true' | 'false'
    search: '',
    dateFilter: 'all', // 'all' | 'today' | 'upcoming'
    minPrice: '',
    maxPrice: ''
  });

  useEffect(() => {
    // Debounce filters triggering fetch
    const handler = setTimeout(() => {
      fetchEvents(filters);
    }, 300);
    return () => clearTimeout(handler);
  }, [filters]);

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (storedRole) {
      setRole(storedRole);
    }
    const token = localStorage.getItem('token');
    if (token) {
      let extractedName = '';

      // 1. Try to get from localStorage user object
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          extractedName = userObj?.name || userObj?.username || '';
        }
      } catch (e) {}

      // 2. Try to get from JWT if not found in user object
      try {
        const decoded: any = jwtDecode(token);
        if (!storedRole) setRole(decoded.role);
        
        if (!extractedName) {
          extractedName = decoded.name || decoded.username || (decoded.email ? decoded.email.split('@')[0] : '');
        }
      } catch (e) {
        console.error('Failed to decode token');
      }

      setUserName(extractedName);
      fetchMyRegistrations();
      fetchMyBookings();
      fetchRecommendations();
      fetchTrending();
    }
  }, []);

  const fetchMyRegistrations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/registrations/my`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setMyRegistrations(data);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bookings/my`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setMyBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/events/recommended`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setRecommendedEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    }
  };

  const fetchEvents = async (currentFilters = filters) => {
    try {
      const q = new URLSearchParams();
      if (currentFilters.isPaid !== 'all') q.append('is_paid', currentFilters.isPaid);
      if (currentFilters.search.trim() !== '') q.append('search', currentFilters.search);
      if (currentFilters.dateFilter !== 'all') q.append('date_filter', currentFilters.dateFilter);
      if (currentFilters.minPrice) q.append('min_price', currentFilters.minPrice);
      if (currentFilters.maxPrice) q.append('max_price', currentFilters.maxPrice);

      const endpoint = `${API_URL}/events${q.toString() ? '?' + q.toString() : ''}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setEvents(data);
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await fetch(`${API_URL}/api/events/trending`);
      const data = await response.json();
      setTrendingEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching trending events:', err);
    }
  };

  // Ticket helpers
  const addTicketRow = () => {
    setTickets([...tickets, { name: '', price: 0, quantity: 10 }]);
  };

  const removeTicketRow = (index: number) => {
    setTickets(tickets.filter((_, i) => i !== index));
  };

  const updateTicket = (index: number, field: string, value: string | number) => {
    const updated = [...tickets];
    (updated[index] as any)[field] = value;
    setTickets(updated);
  };

  const isTicketConfigValid = () => {
    if (!isPaid) return true;
    if (tickets.length === 0) return false;
    return tickets.every(t => t.name.trim() !== '' && t.price >= 0 && t.quantity > 0);
  };

  const addFormField = () => {
    setFormFields([...formFields, { label: '', type: 'text', required: false, options: '' }]);
  };

  const removeFormField = (index: number) => {
    setFormFields(formFields.filter((_, i) => i !== index));
  };

  const updateFormField = (index: number, field: string, value: any) => {
    const updated = [...formFields];
    (updated[index] as any)[field] = value;
    setFormFields(updated);
  };

  const isFormConfigValid = () => {
    return formFields.every(f => {
      const hasLabel = f.label.trim() !== '';
      const hasOptionsIfSelect = f.type === 'select' ? f.options.trim() !== '' : true;
      return hasLabel && hasOptionsIfSelect;
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPaid && !isTicketConfigValid()) {
      alert('Please configure at least one valid ticket type for paid events.');
      return;
    }
    if (!isFormConfigValid()) {
      alert('Please fill out all labels and options (for dropdowns) in your custom form fields.');
      return;
    }
    setLoading(true);
    try {
      const payload: any = { ...formData, is_paid: isPaid };
      if (isPaid) {
        payload.tickets = tickets.map(t => ({
          name: t.name.trim(),
          price: Number(t.price),
          quantity: Number(t.quantity)
        }));
      }
      if (formFields.length > 0) {
        payload.form_fields = formFields.map(f => ({
          label: f.label.trim(),
          type: f.type,
          required: f.required,
          options: f.type === 'select' ? f.options.split(',').map(o => o.trim()).filter(Boolean) : []
        }));
      }
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ title: '', description: '', date: '', location: '', total_seats: '50' });
        setIsPaid(false);
        setTickets([]);
        setFormFields([]);
        fetchEvents();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create event');
      }
    } catch (err) {
      console.error('Error creating event:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (eventId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/registrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ event_id: eventId })
      });

      const data = await response.json();
      if (response.ok) {
        fetchEvents();
        fetchMyRegistrations();
        // Track successful registration
        trackActivity(eventId, 'register');
      } else {
        alert(data.error || 'Failed to register');
      }
    } catch (err) {
      console.error('Error registering:', err);
    } finally {
      setLoading(false);
    }
  };

  const isEventBooked = (eventId: number) => {
    return myBookings.some(b => b.event_id === eventId && b.status === 'success');
  };

  const renderEventCard = (event: any) => (
    <Card key={event.id} className="group h-full flex flex-col p-6 hover:border-zinc-700/50 hover:shadow-2xl hover:shadow-violet-500/5 transition-all duration-300 ease-out hover:scale-[1.01]">
      <div className="flex justify-between items-start mb-6">
        <div className="flex flex-wrap gap-2">
          <Badge className={
              event.registered >= event.capacity ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
          }>{event.registered >= event.capacity ? 'Full' : 'Active'}</Badge>
          <Badge className={`text-xs ${event.is_paid ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
            {event.is_paid ? '💰 Paid' : '🎉 Free'}
          </Badge>
          {event.category && (
            <Badge className="bg-transparent border-zinc-800 text-zinc-500">
              {event.category}
            </Badge>
          )}
        </div>
      </div>
      
      <h3 className="text-xl font-bold mb-4 line-clamp-1 text-white group-hover:text-violet-400 transition-colors">{event.title}</h3>
      
      <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Calendar size={16} className="text-violet-500/50" />
              <span>{new Date(event.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-zinc-400">
              <MapPin size={16} className="text-indigo-500/50" />
              <span>{event.location}</span>
          </div>
      </div>

      <div className="mt-auto">
        <div className="space-y-2 mb-6">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                <span className="text-zinc-500">Registration</span>
                <span className="text-zinc-300">{event.total_seats - event.available_seats} / {event.total_seats}</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-1000 ${event.available_seats === 0 ? 'bg-amber-500' : 'bg-gradient-to-r from-violet-600 to-indigo-600'}`} 
                    style={{ width: `${((event.total_seats - event.available_seats) / (event.total_seats || 1)) * 100}%` }} 
                />
            </div>
        </div>

        <div className="flex items-center gap-2">
            {(role === 'organizer' || role === 'admin') ? (
              <Button variant="secondary" className="flex-1 text-xs">Manage</Button>
            ) : (
              <>
                {event.is_paid ? (
                  isEventBooked(event.id) ? (
                    <Button variant="secondary" disabled className="flex-1 text-xs opacity-80 cursor-default">
                      Booked ✓
                    </Button>
                  ) : (
                    <Button onClick={() => { trackActivity(event.id, 'click'); navigate(`/dashboard/events/${event.id}`); }} className="flex-1 text-xs gap-1.5">
                      <Ticket size={14} /> Tickets
                    </Button>
                  )
                ) : (
                  myRegistrations.find(r => r.event_id === event.id) ? (
                    <Button variant="secondary" disabled className="flex-1 text-xs opacity-80 cursor-default">
                      {myRegistrations.find(r => r.event_id === event.id).status === 'confirmed' ? 'Registered' : 'Waitlisted'}
                    </Button>
                  ) : (
                    <Button onClick={() => { trackActivity(event.id, 'click'); handleRegister(event.id); }} disabled={loading} className="flex-1 text-xs">
                      {event.available_seats > 0 ? 'Register' : 'Waitlist'}
                    </Button>
                  )
                )}
              </>
            )}
            <Button onClick={() => { trackActivity(event.id, 'click'); navigate(`/dashboard/events/${event.id}`); }} variant="outline" className="flex-1 text-xs">
              View
            </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 pb-12 space-y-12 relative min-h-screen">
      <BackgroundEffects />
      
      {/* Hero Section */}
      <div className="relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-4xl">
            <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent leading-tight">
              Welcome{userName ? `, ${userName}` : ''}
            </h2>
            <p className="text-base md:text-lg text-zinc-400 mt-4 leading-relaxed">
              Manage, track, and grow your events in real-time
            </p>
            <h1 className="text-lg font-semibold text-white mt-6">
              Browse Events
            </h1>
          </div>
          {(role === 'organizer' || role === 'admin') && !localStorage.getItem("hideCreateEvent") && (
            <Button className="gap-2 shrink-0" onClick={() => setShowModal(true)}>
              <Plus size={18} /> Create Event
            </Button>
          )}
        </div>
      </div>

      {/* Recommended for You Section */}
      {role === 'user' && recommendedEvents.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Recommended for You
            </h2>
            <div className="h-px flex-1 bg-zinc-800 mx-6 hidden sm:block" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendedEvents.slice(0, 3).map(event => renderEventCard(event))}
          </div>
        </section>
      )}

      {/* Trending Section */}
      {trendingEvents.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              🔥 Trending Now
            </h2>
            <div className="h-px flex-1 bg-zinc-800 mx-6 hidden sm:block" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trendingEvents.slice(0, 3).map(event => (
              <div key={event.id} className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                {renderEventCard(event)}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters UI */}
      <Card className="bg-zinc-900/40 p-2 md:p-3 flex flex-col lg:flex-row gap-2 items-stretch lg:items-center">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search events..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="w-full h-11 pl-11 pr-4 bg-transparent border-none rounded-xl text-white text-sm focus:ring-0 placeholder:text-zinc-600"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 p-1">
          <div className="relative">
            <select
              value={filters.dateFilter}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFilter: e.target.value as any }))}
              className="h-9 pl-3 pr-8 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer appearance-none min-w-[120px] hover:bg-zinc-800/80 hover:border-zinc-600"
            >
              <option value="all" className="bg-zinc-900 text-zinc-300">Any Date</option>
              <option value="upcoming" className="bg-zinc-900 text-zinc-300">Upcoming</option>
              <option value="today" className="bg-zinc-900 text-zinc-300">Today</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          
          <div className="relative">
            <select
              value={filters.isPaid}
              onChange={(e) => setFilters(prev => ({ ...prev, isPaid: e.target.value as any, minPrice: '', maxPrice: '' }))}
              className="h-9 pl-3 pr-8 bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer appearance-none min-w-[120px] hover:bg-zinc-800/80 hover:border-zinc-600"
            >
              <option value="all" className="bg-zinc-900 text-zinc-300">Free & Paid</option>
              <option value="false" className="bg-zinc-900 text-zinc-300">Free Only</option>
              <option value="true" className="bg-zinc-900 text-zinc-300">Paid Only</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          
          {filters.isPaid !== 'false' && (
            <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2 h-9">
              <span className="text-zinc-600 text-[10px] font-bold">₹</span>
              <input
                type="number"
                placeholder="Min"
                min="0"
                value={filters.minPrice}
                onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                className="w-12 bg-transparent text-white text-xs focus:outline-none placeholder:text-zinc-700"
              />
              <span className="text-zinc-800">-</span>
              <input
                type="number"
                placeholder="Max"
                min="0"
                value={filters.maxPrice}
                onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                className="w-12 bg-transparent text-white text-xs focus:outline-none placeholder:text-zinc-700"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ isPaid: 'all', search: '', dateFilter: 'all', minPrice: '', maxPrice: '' })}
            className="h-9 text-zinc-500 hover:text-white"
          >
            <XCircle size={14} className="mr-1.5" /> Reset
          </Button>
        </div>
      </Card>
      
      {events.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-24 text-center bg-zinc-900/20 border-zinc-800/50">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6">
            <Filter size={24} className="text-zinc-600" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No events found</h3>
          <p className="text-zinc-500 max-w-sm mb-8 text-sm leading-relaxed">Try adjusting your active filters or search for something else to find exciting events.</p>
          <Button variant="outline" size="sm" onClick={() => setFilters({ isPaid: 'all', search: '', dateFilter: 'all', minPrice: '', maxPrice: '' })}>
            Clear all filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {events.map((event) => renderEventCard(event))}
        </div>
      )}

      {/* Create Event Modal with Free/Paid support */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Create New Event</h2>
                  <p className="text-zinc-500 mt-1">Set the stage for your next big thing.</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
             </div>

             <form onSubmit={handleCreateEvent} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Event Title</label>
                  <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-primary-600 transition-all outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Description</label>
                  <textarea rows={3} required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-primary-600 transition-all outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Date</label>
                    <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-primary-600 transition-all outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Location</label>
                    <input required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-primary-600 transition-all outline-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Total Seats</label>
                  <input type="number" required value={formData.total_seats} onChange={e => setFormData({...formData, total_seats: e.target.value})} className="w-full h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-primary-600 transition-all outline-none" />
                </div>

                {/* Free / Paid Toggle */}
                <div className="border-t border-zinc-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ticket size={18} className="text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-300">Event Type</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(!isPaid);
                        if (isPaid) setTickets([]);
                        else if (tickets.length === 0) setTickets([{ name: 'General', price: 499, quantity: 50 }]);
                      }}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        isPaid ? 'bg-primary-600' : 'bg-zinc-700'
                      }`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-md ${
                        isPaid ? 'left-9' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {isPaid ? '💰 Paid Event — configure ticket types below' : '🎉 Free Event — no tickets needed'}
                  </p>
                </div>

                {/* Ticket Configuration (Paid Events) */}
                {isPaid && (
                  <div className="border border-zinc-800 rounded-2xl p-4 space-y-3 bg-zinc-800/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign size={16} className="text-primary-500" />
                        <span className="text-sm font-bold text-zinc-200">Ticket Types</span>
                      </div>
                      <button
                        type="button"
                        onClick={addTicketRow}
                        className="text-xs font-medium text-primary-500 hover:text-primary-400 flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14} /> Add Type
                      </button>
                    </div>

                    {tickets.length === 0 && (
                      <p className="text-xs text-zinc-500 text-center py-4">Add at least one ticket type for paid events</p>
                    )}

                    {tickets.map((ticket, index) => (
                      <div key={index} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-400">Ticket #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeTicketRow(index)}
                            className="text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Ticket name (e.g. General, VIP)"
                          value={ticket.name}
                          onChange={(e) => updateTicket(index, 'name', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Price (₹)</label>
                            <input
                              type="number"
                              min="0"
                              value={ticket.price}
                              onChange={(e) => updateTicket(index, 'price', Number(e.target.value))}
                              className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={ticket.quantity}
                              onChange={(e) => updateTicket(index, 'quantity', Number(e.target.value))}
                              className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Registration Form Builder */}
                <div className="border border-zinc-800 rounded-2xl p-4 space-y-3 bg-zinc-800/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FormInput size={16} className="text-indigo-400" />
                      <span className="text-sm font-bold text-zinc-200">Registration Form Builder</span>
                    </div>
                    <button
                      type="button"
                      onClick={addFormField}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  </div>
                  
                  {formFields.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-2">No custom fields. Users only need to register.</p>
                  )}

                  {formFields.map((field, index) => (
                    <div key={index} className="bg-zinc-900 border border-zinc-700/50 rounded-xl p-3 space-y-3 relative group">
                      <button
                        type="button"
                        onClick={() => removeFormField(index)}
                        className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-3 pr-6">
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Field Label</label>
                          <input
                            type="text"
                            placeholder="e.g. Full Name"
                            value={field.label}
                            onChange={(e) => updateFormField(index, 'label', e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Input Type</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateFormField(index, 'type', e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                          >
                            <option value="text">Text (Short answer)</option>
                            <option value="textarea">Textarea (Long answer)</option>
                            <option value="number">Number</option>
                            <option value="select">Dropdown (Select)</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={field.required}
                            onChange={(e) => updateFormField(index, 'required', e.target.checked)}
                            className="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-indigo-500 focus:ring-offset-zinc-900"
                          />
                          <span className="text-xs text-zinc-300">Required field</span>
                        </label>
                      </div>

                      {field.type === 'select' && (
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Dropdown Options (Comma separated)</label>
                          <input
                            type="text"
                            placeholder="e.g. Small, Medium, Large"
                            value={field.options}
                            onChange={(e) => updateFormField(index, 'options', e.target.value)}
                            className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <Button type="submit" disabled={loading || (isPaid && !isTicketConfigValid()) || !isFormConfigValid()} className="w-full h-14 text-base font-bold shadow-lg shadow-primary-900/20">
                  {loading ? 'Publishing...' : 'Publish Event'}
                </Button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
