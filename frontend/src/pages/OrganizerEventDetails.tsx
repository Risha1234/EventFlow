import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users, Mail, Activity, BarChart3, X, Eye } from 'lucide-react';
import { Button } from '../components/ui';
import { socket } from '../socket';

export default function OrganizerEventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any>({ confirmed: [], waitlisted: [] });
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState<any[]>([]);
  const [selectedAttendee, setSelectedAttendee] = useState<any>(null);

  useEffect(() => {
    fetchEventDetails();
    fetchAttendees();
    fetchAnalytics();
    
    // Listen for real-time updates
    socket.on("event:update", (data) => {
      console.log("Real-time update received:", data);
      
      // Only refetch if it's for this event
      if (data.eventId === parseInt(id!)) {
        const updateType = data.type;
        const message = updateType === 'REGISTERED' 
          ? 'New registration received'
          : updateType === 'CANCELLED' 
          ? 'Registration cancelled'
          : 'User promoted from waitlist';
        
        // Add to activity feed
        setActivity(prev => [
          { type: updateType, message, timestamp: new Date() },
          ...prev.slice(0, 9)
        ]);
        
        // Refetch data
        fetchEventDetails();
        fetchAttendees();
        fetchAnalytics();
      }
    });
    
    return () => {
      socket.off("event:update");
    };
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/events/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        setError('Event not found or access denied');
        return;
      }

      const data = await response.json();
      setEvent(data);
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Failed to load event details');
    }
  };

  const fetchAttendees = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/organizer/events/${id}/attendees`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You can only view attendees for your own events');
        } else {
          setError('Failed to load attendees');
        }
        return;
      }

      const data = await response.json();
      setAttendees(data);
    } catch (err) {
      console.error('Error fetching attendees:', err);
      setError('Failed to load attendees');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/organizer/events/${id}/analytics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        console.error('Failed to load analytics');
        return;
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => navigate('/organizer/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!event || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-500">Loading event details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header with Back Button */}
        <button
          onClick={() => navigate('/organizer/dashboard')}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        {/* Attendee Details Modal */}
        {selectedAttendee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setSelectedAttendee(null)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                 <X size={24} />
              </button>
              <h3 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
                 <Users size={24} className="text-primary-500" /> Attendee Details
              </h3>
              
              <div className="space-y-6">
                 <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Basic Information</h4>
                    <div className="space-y-3 text-sm">
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Name</span> 
                          <span className="font-medium text-zinc-200">{selectedAttendee.name}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Email</span> 
                          <span className="font-medium text-zinc-200">{selectedAttendee.email}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-zinc-500">Status</span> 
                          <span className="font-medium text-zinc-200 capitalize">{selectedAttendee.status}</span>
                       </div>
                       {selectedAttendee.ticket_type && (
                         <div className="flex justify-between mt-2 pt-2 border-t border-zinc-900">
                            <span className="text-zinc-500 pt-1">Ticket</span> 
                            <span className="font-bold text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-1 rounded inline-block">
                               {selectedAttendee.ticket_type}
                            </span>
                         </div>
                       )}
                    </div>
                 </div>

                 {event.form_fields && event.form_fields.length > 0 ? (
                   <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Form Responses</h4>
                      <div className="space-y-4 text-sm">
                         {event.form_fields.map((field: any) => {
                            const responseValue = selectedAttendee.responses?.[field.id];
                            const hasValue = responseValue !== undefined && responseValue !== null && responseValue !== '';
                            return (
                              <div key={field.id} className="border-b border-zinc-900/50 pb-3 last:border-0 last:pb-0">
                                 <p className="text-zinc-500 text-xs mb-1.5">{field.label}</p>
                                 <p className={`font-medium ${hasValue ? 'text-zinc-200' : 'text-zinc-600 italic'}`}>
                                    {hasValue ? responseValue : '-'}
                                 </p>
                              </div>
                            );
                         })}
                      </div>
                   </div>
                 ) : (
                    <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 text-center">
                       <p className="text-sm text-zinc-500">No custom form fields were configured for this event.</p>
                    </div>
                 )}
              </div>
              
              <Button onClick={() => setSelectedAttendee(null)} className="w-full mt-6 bg-zinc-800 text-white hover:bg-zinc-700">
                 Close
              </Button>
            </div>
          </div>
        )}

        {/* Event Details */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 mb-8">
          <h1 className="text-4xl font-bold mb-6">{event.title}</h1>

          {event.description && (
            <p className="text-zinc-400 mb-6 max-w-2xl">{event.description}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-4">
              <Calendar className="text-primary-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-zinc-500">Date & Time</p>
                <p className="text-lg font-semibold">{new Date(event.date).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="text-primary-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-zinc-500">Location</p>
                <p className="text-lg font-semibold">{event.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Users className="text-primary-500 mt-1 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm text-zinc-500">Capacity</p>
                <p className="text-lg font-semibold">
                  {event.total_seats - event.available_seats} / {event.total_seats}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        {analytics && (
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-8">
              <BarChart3 size={24} className="text-primary-500" />
              <h2 className="text-2xl font-bold">Event Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Registered Card */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 hover:border-green-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Registered</p>
                    <p className="text-3xl font-bold text-green-500">{analytics.confirmed}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-green-500" />
                  </div>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${(analytics.confirmed / analytics.total_seats) * 100}%` }}
                  />
                </div>
              </div>

              {/* Waitlist Card */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 hover:border-amber-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Waitlist</p>
                    <p className="text-3xl font-bold text-amber-500">{analytics.waitlisted}</p>
                  </div>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <Users size={20} className="text-amber-500" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500">Users waiting for spot</p>
              </div>

              {/* Available Seats Card */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 hover:border-blue-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Seats Left</p>
                    <p className="text-3xl font-bold text-blue-500">{analytics.available_seats}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <BarChart3 size={20} className="text-blue-500" />
                  </div>
                </div>
                <p className="text-xs text-zinc-500">of {analytics.total_seats} total</p>
              </div>

              {/* Fill Rate Card */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6 hover:border-primary-500/50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-zinc-500 mb-1">Fill Rate</p>
                    <p className="text-3xl font-bold text-primary-500">{analytics.fill_rate}%</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center">
                    <BarChart3 size={20} className="text-primary-500" />
                  </div>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2">
                  <div 
                    className="bg-primary-500 h-2 rounded-full"
                    style={{ width: `${analytics.fill_rate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Attendees Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Confirmed Attendees */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <h2 className="text-2xl font-bold">Confirmed Attendees</h2>
              <span className="ml-auto text-sm text-zinc-500">{attendees.confirmed.length}</span>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {attendees.confirmed.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No confirmed attendees yet</p>
              ) : (
                attendees.confirmed.map((attendee: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAttendee({ ...attendee, status: 'confirmed' })}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 hover:border-primary-500/50 hover:bg-zinc-800 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users size={18} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                         <p className="font-semibold">{attendee.name}</p>
                         {attendee.ticket_type && (
                           <span className="text-[10px] font-bold text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                              {attendee.ticket_type}
                           </span>
                         )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                        <Mail size={14} />
                        <span className="truncate">{attendee.email}</span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1">
                        Registered: {new Date(attendee.registered_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-primary-500/10 group-hover:border-primary-500/30 group-hover:text-primary-500 transition-all flex-shrink-0">
                       <Eye size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Waitlisted Users */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-amber-500 rounded-full" />
              <h2 className="text-2xl font-bold">Waitlisted Users</h2>
              <span className="ml-auto text-sm text-zinc-500">{attendees.waitlisted.length}</span>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {attendees.waitlisted.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No waitlisted users</p>
              ) : (
                attendees.waitlisted.map((attendee: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedAttendee({ ...attendee, status: 'waitlisted' })}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 hover:border-amber-500/50 hover:bg-zinc-800 transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Users size={18} className="text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{attendee.name}</p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                        <Mail size={14} />
                        <span className="truncate">{attendee.email}</span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1">
                        Joined waitlist: {new Date(attendee.registered_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button className="w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:bg-amber-500/10 group-hover:border-amber-500/30 group-hover:text-amber-500 transition-all flex-shrink-0">
                       <Eye size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
          <h3 className="text-xl font-bold mb-6">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-zinc-500 mb-2">Total Registrations</p>
              <p className="text-3xl font-bold">{attendees.confirmed.length + attendees.waitlisted.length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-2">Confirmed</p>
              <p className="text-3xl font-bold text-green-500">{attendees.confirmed.length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-2">Waitlisted</p>
              <p className="text-3xl font-bold text-amber-500">{attendees.waitlisted.length}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500 mb-2">Available Seats</p>
              <p className="text-3xl font-bold text-primary-500">{event.available_seats}</p>
            </div>
          </div>
        </div>

        {/* Live Activity Feed */}
        {activity.length > 0 && (
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <Activity size={20} className="text-primary-500" />
              <h3 className="text-xl font-bold">Live Activity</h3>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-primary-600/10 text-primary-500 text-xs font-bold">
                LIVE
              </span>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto">
              {activity.map((item, idx) => (
                <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3 flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      item.type === 'REGISTERED'
                        ? 'bg-green-500'
                        : item.type === 'PROMOTED'
                        ? 'bg-indigo-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-300">{item.message}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
