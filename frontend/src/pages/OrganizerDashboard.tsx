import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Plus, X, LogOut, TrendingUp, Users, Zap, AlertCircle, Sparkles, Ticket, DollarSign, Trash2, FormInput, ChevronDown } from 'lucide-react';
import { Button, Badge, Card } from '../components/ui';
import BackgroundEffects from '../components/ui/BackgroundEffects';
import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, Line } from 'recharts';
import { socket } from '../socket';
import AICopilot from '../components/AICopilot';

export default function OrganizerDashboard() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', date: '', location: '', total_seats: '50' });
  const [isPaid, setIsPaid] = useState(false);
  const [tickets, setTickets] = useState<{ name: string; price: number; quantity: number }[]>([]);
  const [formFields, setFormFields] = useState<{ label: string; type: 'text' | 'number' | 'select' | 'textarea'; required: boolean; options: string }[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const activityFeedRef = useRef<HTMLDivElement>(null);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'conversion' | 'revenue' | 'registrations'>('date');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [selectedTrendEventId, setSelectedTrendEventId] = useState<number | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [isTrendsDropdownOpen, setIsTrendsDropdownOpen] = useState(false);
  const trendsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrganizerEvents();
    fetchInitialActivity();
  }, [events.length, chartData.length]);

  useEffect(() => {
    if (events.length > 0 && !selectedTrendEventId) {
      setSelectedTrendEventId(events[0].id);
    }
  }, [events]);

  useEffect(() => {
    if (selectedTrendEventId) {
      fetchTrendData(selectedTrendEventId);
    }
  }, [selectedTrendEventId]);

  // Handle click outside trends dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (trendsDropdownRef.current && !trendsDropdownRef.current.contains(event.target as Node)) {
        setIsTrendsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Listen for real-time updates
    socket.on("new_activity", (data) => {
      console.log("Real-time activity received:", data);

      const { eventId, action_type, timestamp } = data;

      // 1. Update events stats immutably
      setEvents(prevEvents => prevEvents.map(event => {
        if (event.id === eventId) {
          const updatedEvent = { ...event };
          if (action_type === 'view') updatedEvent.views = (event.views || 0) + 1;
          if (action_type === 'click') updatedEvent.clicks = (event.clicks || 0) + 1;
          if (action_type === 'register') updatedEvent.registration_count = (event.registration_count || 0) + 1;
          return updatedEvent;
        }
        return event;
      }));

      // 2. Rotate Activity Feed (Max 20)
      const eventObj = events.find(e => e.id === eventId);
      const message = `${action_type === 'register' ? 'New registration' : action_type === 'click' ? 'New click' : 'New view'} for "${eventObj?.title || 'Event'}"`;

      setActivityFeed(prev => [
        {
          id: Date.now(),
          type: action_type,
          message: message,
          timestamp: new Date(timestamp)
        },
        ...prev
      ].slice(0, 20));

      // 3. Smart Trend Chart Update
      if (eventId === selectedTrendEventId && action_type === 'register') {
        const dateStr = new Date(timestamp).toISOString().split('T')[0];
        setTrendData(prev => {
          const newData = [...prev];
          if (newData.length > 0) {
            const lastPoint = newData[newData.length - 1];
            const lastPointDate = new Date(lastPoint.date).toISOString().split('T')[0];

            if (lastPointDate === dateStr) {
              // Increment existing point
              newData[newData.length - 1] = { ...lastPoint, count: lastPoint.count + 1 };
              return newData;
            }
          }
          // New date point
          return [...newData, { date: dateStr, count: 1 }];
        });
      }
    });

    return () => {
      socket.off("new_activity");
    };
  }, [events, selectedTrendEventId]);

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityFeedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = activityFeedRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        activityFeedRef.current.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [activityFeed]);

  const fetchOrganizerEvents = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      console.log('Fetching organizer events with token:', token?.substring(0, 20) + '...');

      const response = await fetch('http://localhost:5000/api/organizer/events', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('API error:', data);
        if (response.status === 403) {
          setError('Access denied. Your role may not be organizer. Please try logging in again.');
        } else {
          setError(data.error || 'Failed to fetch events');
        }
        setEvents([]);
        return;
      }

      console.log('Fetched events:', data);

      // Ensure data is an array
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        console.error('Events data is not an array:', data);
        setError('Invalid response format from server');
        setEvents([]);
      }
    } catch (err) {
      console.error('Error fetching organizer events:', err);
      setError('Network error or server unavailable');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };
  const fetchInitialActivity = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/organizer/activity', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setActivityFeed(data);
      }
    } catch (err) {
      console.error('Error fetching initial activity:', err);
    }
  };

  const calculateAnalytics = (eventsList: any[]) => {
    const totalEvents = eventsList.length;
    const totalRegistrations = eventsList.reduce((sum, event) => sum + (event.registration_count || 0), 0);
    const totalRevenue = eventsList.reduce((sum, event) => sum + (event.revenue || 0), 0);
    const fillRates = eventsList.map(event => ((event.total_seats - event.available_seats) / (event.total_seats || 1)) * 100);
    const avgFillRate = fillRates.length > 0 ? Math.round(fillRates.reduce((a, b) => a + b, 0) / fillRates.length * 100) / 100 : 0;

    return { totalEvents, totalRegistrations, totalRevenue, avgFillRate };
  };

  const getHighDemandEvents = (eventsList: any[]) => {
    return eventsList
      .map(event => ({
        ...event,
        conversionRate: event.views > 0 ? (event.registration_count / event.views) * 100 : 0
      }))
      .filter(event => event.conversionRate > 20 || event.available_seats <= 2)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, 3);
  };

  const fetchTrendData = async (eventId: number) => {
    try {
      setTrendLoading(true);
      const response = await fetch(`http://localhost:5000/api/organizer/event-registrations/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTrendData(data);
      }
    } catch (err) {
      console.error('Error fetching trend data:', err);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchTimeseriesData = async (eventId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/organizer/events/${eventId}/analytics/timeseries`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch timeseries data');
        return;
      }

      const data = await response.json();
      const formatted = data.map((item: any) => ({
        time: item.time ? new Date(item.time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        }) : '',
        registrations: item.count
      }));

      setChartData(formatted);
    } catch (err) {
      console.error('Error fetching timeseries data:', err);
    }
  };

  const handleLogout = () => {
    // Clear all auth and app-related data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('intent');
    localStorage.removeItem('hideBecomeOrganizer');
    localStorage.removeItem('hideCreateEvent');

    // Redirect to landing page
    navigate('/');
  };

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
    setCreateLoading(true);
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
      const response = await fetch('http://localhost:5000/events', {
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
        fetchOrganizerEvents();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create event');
      }
    } catch (err) {
      console.error('Error creating event:', err);
      alert('An error occurred while creating the event');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative px-6 py-12">
      <BackgroundEffects />
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div>
            <Badge className="mb-3">Management Portal</Badge>
            <h1 className="text-4xl font-black tracking-tight text-white">Organizer Dashboard</h1>
            <p className="text-zinc-500 mt-2">Oversee your events, analyze performance, and engage with attendees.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="gap-2 shadow-violet-500/20" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Event
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-violet-500/20 text-violet-400 hover:bg-violet-500/5 hover:border-violet-500/40 transition-all duration-300"
              onClick={() => setIsAICopilotOpen(true)}
            >
              <Sparkles size={18} /> AI Copilot
            </Button>

            <Button
              variant="ghost"
              className="gap-2 text-zinc-500 hover:text-white"
              onClick={() => navigate('/settings')}
            >
              <Users size={18} />
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-zinc-500 hover:text-red-400"
              onClick={handleLogout}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </div>

        {/* Create Event Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <Card className="bg-zinc-900 border-zinc-800 max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black tracking-tight text-white">Create Event</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400 block mb-2">Event Title</label>
                  <input
                    type="text"
                    placeholder="Enter event title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 block mb-2">Description</label>
                  <textarea
                    placeholder="Event description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-20 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-zinc-400 block mb-2">Date</label>
                    <input
                      type="datetime-local"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-zinc-400 block mb-2">Total Seats</label>
                    <input
                      type="number"
                      required
                      value={formData.total_seats}
                      onChange={(e) => setFormData({ ...formData, total_seats: e.target.value })}
                      className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-400 block mb-2">Location</label>
                  <input
                    type="text"
                    placeholder="Event location"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600"
                  />
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
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${isPaid ? 'bg-violet-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-md ${isPaid ? 'left-9' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Ticket Configuration (Paid Events) */}
                {isPaid && (
                  <div className="border border-zinc-800 rounded-2xl p-4 space-y-3 bg-zinc-800/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-200">Ticket Types</span>
                      <button type="button" onClick={addTicketRow} className="text-xs font-medium text-violet-500 hover:text-violet-400 flex items-center gap-1 transition-colors">
                        <Plus size={14} /> Add Type
                      </button>
                    </div>
                    {tickets.map((ticket, index) => (
                      <div key={index} className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-600 uppercase">Ticket #{index + 1}</span>
                          <button type="button" onClick={() => removeTicketRow(index)} className="text-zinc-500 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Ticket name"
                          value={ticket.name}
                          onChange={(e) => updateTicket(index, 'name', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            placeholder="Price"
                            value={ticket.price}
                            onChange={(e) => updateTicket(index, 'price', Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            value={ticket.quantity}
                            onChange={(e) => updateTicket(index, 'quantity', Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Form Fields */}
                <div className="border-t border-zinc-800 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <FormInput size={18} className="text-violet-500" />
                      <span className="text-sm font-bold tracking-tight">Registration Fields</span>
                    </div>
                    <button
                      type="button"
                      onClick={addFormField}
                      className="text-xs font-bold text-violet-500 hover:text-violet-400 flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 rounded-lg transition-all"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  </div>

                  {formFields.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 italic bg-zinc-950/30 p-4 rounded-xl border border-zinc-800/50 text-center">
                      No custom fields. Attendees will only provide basic info.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {formFields.map((field, index) => (
                        <div key={index} className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 space-y-3 relative group">
                          <button
                            type="button"
                            onClick={() => removeFormField(index)}
                            className="absolute top-3 right-3 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X size={14} />
                          </button>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="text-[10px] uppercase font-black text-zinc-600 mb-1.5 block">Label</label>
                              <input
                                type="text"
                                placeholder="Attendee's Name, Food Preference, etc."
                                value={field.label}
                                onChange={(e) => updateFormField(index, 'label', e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-black text-zinc-600 mb-1.5 block">Type</label>
                              <select
                                value={field.type}
                                onChange={(e) => updateFormField(index, 'type', e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                              >
                                <option value="text">Short Text</option>
                                <option value="textarea">Long Text</option>
                                <option value="number">Number</option>
                                <option value="select">Dropdown</option>
                              </select>
                            </div>
                            <div className="flex items-end pb-1">
                              <label className="flex items-center gap-2 cursor-pointer group/check">
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(e) => updateFormField(index, 'required', e.target.checked)}
                                  className="hidden"
                                />
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${field.required ? 'bg-violet-600 border-violet-500' : 'border-zinc-700'}`}>
                                  {field.required && <X size={10} className="text-white rotate-45" />}
                                </div>
                                <span className="text-[10px] font-bold text-zinc-500 group-hover/check:text-zinc-300">REQUIRED</span>
                              </label>
                            </div>
                          </div>

                          {field.type === 'select' && (
                            <div className="pt-2">
                              <label className="text-[10px] uppercase font-black text-zinc-600 mb-1.5 block">Options (comma separated)</label>
                              <input
                                type="text"
                                placeholder="Veg, Non-Veg, Vegan"
                                value={field.options}
                                onChange={(e) => updateFormField(index, 'options', e.target.value)}
                                className="w-full h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm focus:outline-none focus:border-violet-500"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-6">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" type="submit" disabled={createLoading}>
                    {createLoading ? 'Creating...' : 'Create Event'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px] relative z-10">
            <p className="text-zinc-500 animate-pulse">Loading dashboard...</p>
          </div>
        ) : error ? (
          <Card className="p-8 border-red-500/20 bg-red-500/5 text-center relative z-10">
            <AlertCircle size={40} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Unable to load dashboard</h3>
            <p className="text-zinc-500 mb-6">{error}</p>
            <Button onClick={fetchOrganizerEvents}>Try Again</Button>
          </Card>
        ) : Array.isArray(events) && events.length > 0 ? (
          <section className="space-y-12 relative z-10">
            {/* Global Analytics Section */}
            {(() => {
              const analytics = calculateAnalytics(events);
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Events', value: analytics.totalEvents, icon: Calendar, color: 'text-violet-500', bg: 'bg-violet-500/10' },
                    { label: 'Attendees', value: analytics.totalRegistrations, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                    { label: 'Fill Rate', value: `${analytics.avgFillRate}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { label: 'Total Revenue', value: `₹${analytics.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                  ].map((stat, i) => (
                    <Card key={i} className="p-6 bg-zinc-900/40 border-zinc-800/50 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.label}</p>
                        <p className="text-3xl font-black mt-1 text-white">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center border border-current/10 group-hover:scale-110 transition-transform`}>
                        <stat.icon size={20} />
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })()}

            {/* High Demand Events Section */}
            {(() => {
              const highDemandEvents = getHighDemandEvents(events);
              return (
                highDemandEvents.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <AlertCircle size={20} className="text-red-500" />
                        High Demand Events
                      </h2>
                      <div className="h-px flex-1 bg-zinc-800 mx-6 hidden sm:block" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {highDemandEvents.map((event) => (
                        <Card
                          key={event.id}
                          className="p-5 bg-gradient-to-br from-zinc-900/60 to-zinc-900/20 border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.25)] transition-all cursor-pointer group"
                          onClick={() => navigate(`/organizer/events/${event.id}`)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <h3 className="text-sm font-bold truncate pr-4 text-zinc-200 group-hover:text-white transition-colors">{event.title}</h3>
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 rounded-full px-3 py-1 text-[10px] shrink-0 font-bold uppercase tracking-tight">
                              🔥 High Demand
                            </Badge>
                          </div>
                          <div className="space-y-3">
                            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full"
                                style={{ width: `${Math.min((event.registration_count / (event.views || 1)) * 100, 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                              {event.registration_count} REGISTRATIONS • {event.views} REACH
                            </p>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )
              );
            })()}

            {/* Registration Trends & Live Feed Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="lg:col-span-2 p-8 bg-zinc-900/40 border-zinc-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-600/10 flex items-center justify-center text-violet-500 border border-violet-600/20">
                      <TrendingUp size={18} />
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">Registration Trends</h2>
                  </div>

                  <div className="relative" ref={trendsDropdownRef}>
                    <button
                      onClick={() => setIsTrendsDropdownOpen(!isTrendsDropdownOpen)}
                      className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-2 pr-10 text-xs text-white focus:outline-none focus:border-violet-500 transition-all min-w-[200px] cursor-pointer flex items-center justify-between hover:bg-zinc-800/80 active:scale-[0.98]"
                    >
                      <span className="truncate max-w-[150px]">
                        {events.find(e => e.id === selectedTrendEventId)?.title || 'Select event to analyze'}
                      </span>
                      <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${isTrendsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTrendsDropdownOpen && (
                      <div className="absolute right-0 top-full mt-2 w-full min-w-[220px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                           <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-800/50 mb-1">
                             Select Event
                           </div>
                           {events.map((e) => (
                             <button
                               key={e.id}
                               onClick={() => {
                                 setSelectedTrendEventId(e.id);
                                 setIsTrendsDropdownOpen(false);
                               }}
                               className={`w-full text-left px-4 py-2.5 text-xs transition-colors hover:bg-violet-500/10 hover:text-violet-400 flex items-center justify-between group ${
                                 selectedTrendEventId === e.id ? 'bg-violet-500/5 text-violet-500 font-bold' : 'text-zinc-400'
                               }`}
                             >
                               <span className="truncate pr-4">{e.title}</span>
                               {selectedTrendEventId === e.id && <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.8)]" />}
                             </button>
                           ))}
                           {events.length === 0 && (
                             <div className="px-4 py-3 text-xs text-zinc-600 italic text-center">
                               No events found
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  {!selectedTrendEventId ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-zinc-800 rounded-2xl">
                      <TrendingUp size={32} className="text-zinc-700 mb-3" />
                      <p className="text-zinc-500 text-sm">Select an event to view growth trends</p>
                    </div>
                  ) : trendLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                  ) : trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <XAxis
                          dataKey="date"
                          stroke="#3f3f46"
                          style={{ fontSize: '10px', fontWeight: 'bold' }}
                          tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        />
                        <YAxis stroke="#3f3f46" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#8b5cf6"
                          strokeWidth={3}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4, stroke: '#09090b' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                      No trend data available for this event yet
                    </div>
                  )}
                </div>
              </Card>

              {/* Activity Feed */}
              <Card className="p-8 bg-zinc-900/40 border-zinc-800/50 max-h-[480px] flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 border border-emerald-600/20">
                    <Zap size={18} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-white">Live Feed</h2>
                </div>

                <div 
                  ref={activityFeedRef}
                  className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent hover:scrollbar-thumb-zinc-700 transition-colors"
                >
                  {activityFeed.length === 0 ? (
                    <p className="text-zinc-600 text-sm py-4">Waiting for activity...</p>
                  ) : (
                    activityFeed.map((activity) => (
                      <div key={activity.id} className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <p className="text-xs text-zinc-300 font-medium">{activity.message}</p>
                        <p className="text-[10px] text-zinc-600 uppercase font-black">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Event List Section */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black tracking-tight text-white">Your Events</h2>
                <div className="flex items-center gap-2 bg-zinc-900/50 p-1 rounded-xl border border-zinc-800">
                  {['date', 'revenue', 'registrations'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSortBy(mode as any)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${sortBy === mode ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {[...events].sort((a, b) => {
                  if (sortBy === 'revenue') return (b.revenue || 0) - (a.revenue || 0);
                  if (sortBy === 'registrations') return (b.registration_count || 0) - (a.registration_count || 0);
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                }).map((event) => (
                  <Card key={event.id} className="p-6 bg-zinc-900/40 border-zinc-800/50 group hover:border-zinc-700 transition-all duration-300">
                    <div className="flex justify-between items-start mb-6">
                      <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                        {new Date(event.date) > new Date() ? 'Upcoming' : 'Past'}
                      </Badge>
                      <Badge className="bg-zinc-800/50 text-zinc-500 border-zinc-700/50">
                        {event.is_paid ? 'Paid' : 'Free'}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-bold text-white mb-4 group-hover:text-violet-400 transition-colors line-clamp-1">{event.title}</h3>

                    <div className="space-y-2 mb-8 text-sm text-zinc-500">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-zinc-700" />
                        <span>{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-zinc-700" />
                        <span>{event.registration_count} registered</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="secondary" className="flex-1 text-xs" onClick={() => navigate(`/organizer/events/${event.id}`)}>
                        Manage
                      </Button>
                      <Button variant="outline" className="flex-1 text-xs" onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}>
                        {expandedEventId === event.id ? 'Close' : 'Insights'}
                      </Button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/events/${event.id}`;
                          navigator.clipboard.writeText(url);
                          alert('Event link copied to clipboard!');
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-zinc-700/50"
                        title="Copy Link"
                      >
                        <Plus size={14} className="rotate-45" />
                      </button>
                    </div>

                    {expandedEventId === event.id && (
                      <div className="mt-4 pt-4 border-t border-zinc-800 animate-in slide-in-from-top-2 duration-300 space-y-4">
                        {/* SECTION 1: Metrics */}
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-none mb-1">Revenue</p>
                            <p className="text-sm font-black text-emerald-500">₹{event.revenue?.toLocaleString() || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-none mb-1">Views</p>
                            <p className="text-sm font-black text-white">{event.views || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-none mb-1">Registrations</p>
                            <p className="text-sm font-black text-violet-400">{event.registration_count || 0}</p>
                          </div>
                        </div>

                        {/* SECTION 2: Smart Insights */}
                        <div className="space-y-2">
                          <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em]">Smart Insights</p>
                          <div className="grid grid-cols-1 gap-2">
                             {(() => {
                                const conversionRate = (event.registration_count / (event.views || 1)) * 100;
                                const avgConversion = events.reduce((acc, curr) => acc + (curr.registration_count / (curr.views || 1)) * 100, 0) / (events.length || 1);
                                const performancePercent = avgConversion > 0 ? (conversionRate / avgConversion) * 100 : 0;
                                
                                const insights: React.ReactNode[] = [];

                                // Behavioral Insights
                                if (event.views > 0 && event.registration_count === 0) {
                                  insights.push(<>⚠️ Users are <span className="text-white font-semibold">viewing but not registering</span></>);
                                }
                                if (event.views < 5) {
                                  insights.push(<>📊 <span className="text-white font-semibold">Low visibility</span> — promote this event to boost reach</>);
                                }
                                if (event.registration_count > 0 && event.views === event.registration_count) {
                                  insights.push(<>🔥 <span className="text-white font-semibold">Perfect conversion</span> — every viewer registered!</>);
                                }
                                if ((event.revenue || 0) > 0) {
                                  insights.push(<>💰 <span className="text-white font-semibold">Revenue generating</span> event identified</>);
                                }

                                // Performance Insights (only if at least 2 events exist for comparison)
                                if (events.length >= 2 && avgConversion > 0) {
                                   if (performancePercent > 120) {
                                     insights.push(<>🚀 Performs <span className="text-white font-semibold">{Math.round(performancePercent - 100)}% better</span> than your average event</>);
                                   } else if (performancePercent >= 80 && performancePercent <= 120) {
                                     insights.push(<>👍 Performing <span className="text-white font-semibold">close to your average</span> event metrics</>);
                                   } else if (performancePercent < 80) {
                                     insights.push(<>⚠️ Performs <span className="text-white font-semibold">{Math.round(100 - performancePercent)}% below</span> your average event</>);
                                   }
                                }

                                // Percentile Insight
                                if (events.length >= 3) {
                                   const sortedByConv = [...events].sort((a,b) => (a.registration_count / (a.views || 1)) - (b.registration_count / (b.views || 1)));
                                   const rank = sortedByConv.findIndex(e => e.id === event.id);
                                   const percentile = Math.round((rank / (events.length - 1)) * 100);
                                   if (percentile > 0) {
                                      insights.push(<>🔥 Performs better than <span className="text-white font-semibold">{percentile}%</span> of your other events</>);
                                   }
                                }

                                if (insights.length === 0) {
                                   return <p className="text-[10px] text-zinc-600 italic">Not enough data for deeper insights yet</p>;
                                }

                                return insights.slice(0, 3).map((insight, i) => (
                                   <div key={i} className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400">
                                      {insight}
                                   </div>
                                ));
                             })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] relative z-10">
            <p className="text-zinc-500 mb-4">You haven't created any events yet</p>
            <Button onClick={() => setShowModal(true)}>Create Your First Event</Button>
          </div>
        )}
      </div>

      <AICopilot isOpen={isAICopilotOpen} onClose={() => setIsAICopilotOpen(false)} />
    </div>
  );
}
