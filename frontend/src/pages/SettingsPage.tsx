import { useState, useEffect } from 'react';
import { User, Bell, Shield } from 'lucide-react';
import { Button } from '../components/ui';
import { jwtDecode } from 'jwt-decode';

export default function SettingsPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      let extractedName = '';
      let extractedEmail = '';

      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          extractedName = userObj?.name || userObj?.username || '';
          extractedEmail = userObj?.email || '';
        }
      } catch (e) {}

      try {
        const decoded: any = jwtDecode(token);
        if (!extractedName) {
          extractedName = decoded.name || decoded.username || (decoded.email ? decoded.email.split('@')[0] : '');
        }
        if (!extractedEmail) {
          extractedEmail = decoded.email || '';
        }
      } catch (e) {
        console.error('Failed to decode token');
      }

      if (extractedName) {
        const parts = extractedName.trim().split(' ');
        setFirstName(parts[0] || '');
        setLastName(parts.length > 1 ? parts.slice(1).join(' ') : '');
      }
      if (extractedEmail) setEmail(extractedEmail);
    }
  }, []);

  const handleSave = () => {
    setIsSaving(true);
    setSaveMessage('');
    
    const newName = `${firstName.trim()} ${lastName.trim()}`.trim();
    
    try {
      let existingUser = {};
      const userStr = localStorage.getItem('user');
      if (userStr) {
        existingUser = JSON.parse(userStr);
      }
      
      const updatedUser = {
        ...existingUser,
        name: newName,
        email: email
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      setTimeout(() => {
        setIsSaving(false);
        setSaveMessage('Settings saved successfully!');
        
        setTimeout(() => setSaveMessage(''), 3000);
      }, 600);
      
    } catch (e) {
      console.error("Failed to save settings");
      setIsSaving(false);
      setSaveMessage('Failed to save settings.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your account and preferences.</p>
      </div>

      <div className="space-y-6">
        <SettingSection title="Profile" icon={<User size={20} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm text-zinc-500">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary-600/20 outline-none" />
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-zinc-500">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary-600/20 outline-none" />
                </div>
                <div className="col-span-2 space-y-2">
                    <label className="text-sm text-zinc-500">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary-600/20 outline-none" />
                </div>
            </div>
            <div className="mt-6 flex justify-end items-center gap-4 border-t border-white/5 pt-6">
                {saveMessage && (
                  <span className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
                    {saveMessage}
                  </span>
                )}
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </Button>
            </div>
        </SettingSection>

        <SettingSection title="Notifications" icon={<Bell size={20} />}>
            <div className="space-y-4">
                <ToggleItem label="Email notifications" desc="Receive updates about your event registrations." active />
                <ToggleItem label="Push notifications" desc="Get real-time alerts on your mobile device." />
                <ToggleItem label="Weekly summary" desc="A recap of your events performance every Monday." active />
            </div>
        </SettingSection>

        <SettingSection title="Security" icon={<Shield size={20} />}>
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-white font-medium">Two-factor authentication</h4>
                    <p className="text-sm text-zinc-500">Add an extra layer of security to your account.</p>
                </div>
                <Button variant="secondary" size="sm">Enable</Button>
            </div>
        </SettingSection>
      </div>
    </div>
  );
}

function SettingSection({ title, icon, children }: any) {
    return (
        <div className="bg-zinc-950/50 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-8">
                <div className="text-zinc-500">{icon}</div>
                <h3 className="font-bold text-lg">{title}</h3>
            </div>
            {children}
        </div>
    )
}

function ToggleItem({ label, desc, active = false }: any) {
    return (
        <div className="flex items-center justify-between gap-6">
            <div>
                <h4 className="text-white font-medium text-sm">{label}</h4>
                <p className="text-xs text-zinc-500 mt-1">{desc}</p>
            </div>
            <div className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${active ? 'bg-primary-600' : 'bg-zinc-800'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${active ? 'left-6' : 'left-1'}`} />
            </div>
        </div>
    )
}
