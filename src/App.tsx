import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { jsPDF } from "jspdf"; 

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [message, setMessage] = useState({ text: '', isError: false });

  const [session, setSession] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  // Navigation & Ansichten
  const [currentView, setCurrentView] = useState<'termine' | 'kalender' | 'verwaltung' | 'bandkasse' | 'songs'>('termine'); 
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'Probe' | 'Auftritt' | 'Band-Event'>('all');

  // Termine & Abstimmungen
  const [events, setEvents] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedSetlistImage, setSelectedSetlistImage] = useState<string | null>(null); 
  
  // Abwesenheiten States
  const [absences, setAbsences] = useState<any[]>([]);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceStartTime, setAbsenceStartTime] = useState('00:00');
  const [absenceEndTime, setAbsenceEndTime] = useState('23:59');
  const [absenceIsAllDay, setAbsenceIsAllDay] = useState(true);
  const [absenceCategory, setAbsenceCategory] = useState<'Urlaub' | 'Termin' | 'Arbeit' | 'Schule'>('Urlaub');
  const [absenceNotes, setAbsenceNotes] = useState('');

  // Songs States
  const [songs, setSongs] = useState<any[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songLyrics, setSongLyrics] = useState('');
  const [songChords, setSongChords] = useState('');
  const [songTabLink, setSongTabLink] = useState('');
  const [songPdfUrl, setSongPdfUrl] = useState('');
  const [generatedPdfPreviewUrl, setGeneratedPdfPreviewUrl] = useState<string | null>(null); 

  // Bandkasse States
  const [fundBalance, setFundBalance] = useState<number>(0);
  const [newBalanceInput, setNewBalanceInput] = useState<string>('');

  // Kalender-Monats-Slider
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  
  // State für das Tagesdetail-Fenster (Modal)
  const [selectedDayDetails, setSelectedDayDetails] = useState<{ dayLabel: string; events: any[]; absences: any[] } | null>(null);

  // Formular-Zustände für Events
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState<'Probe' | 'Auftritt' | 'Band-Event'>('Probe');
  
  // Setlist Upload States
  const [eventSetlistImage, setEventSetlistImage] = useState(''); 
  const [setlistFile, setSetlistFile] = useState<File | null>(null); 

  // Instrumente-Verwaltung States
  const [instruments, setInstruments] = useState<string[]>(['Drums', 'Bass', 'Lead Gitarre', 'Gesang', 'Piano']);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        initAppData(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        initAppData(session.user.id);
      } else {
        setMyProfile(null);
        setEvents([]);
        setAbsences([]);
        setSongs([]);
        setCurrentView('termine');
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const initAppData = async (userId: string) => {
    setIsLoading(true);
    await fetchProfile(userId);
    await loadData();
    setIsLoading(false);
  };

  const loadData = async () => {
    await Promise.all([
      fetchEvents(),
      fetchResponses(),
      fetchAbsences(),
      fetchSongs(),
      fetchFundBalance()
    ]);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setMyProfile(data);
      await fetchAllProfiles();
    }
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (data) {
      setAllProfiles(data);
      const uniqueUsed = Array.from(new Set(data.map((p: any) => p.instrument).filter(Boolean))) as string[];
      setInstruments(prev => Array.from(new Set([...prev, ...uniqueUsed])));
    }
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    if (data) setEvents(data);
  };

  const fetchResponses = async () => {
    const { data } = await supabase.from('event_responses').select('*');
    if (data) setResponses(data);
  };

  const fetchAbsences = async () => {
    const { data } = await supabase.from('user_absences').select('*').order('start_date', { ascending: true });
    if (data) setAbsences(data);
  };

  const fetchSongs = async () => {
    const { data } = await supabase.from('songs').select('*').order('title', { ascending: true });
    if (data) setSongs(data);
  };

  const fetchFundBalance = async () => {
    const { data, error } = await supabase.from('band_fund').select('balance').eq('id', 1).single();
    if (data && !error) {
      setFundBalance(data.balance);
      setNewBalanceInput(data.balance.toString());
    }
  };

  const handleUpdateFundBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile.is_admin) return;

    const numValue = parseFloat(newBalanceInput.replace(',', '.'));
    if (isNaN(numValue)) {
      alert('Bitte eine gültige Zahl eingeben.');
      return;
    }

    const { error } = await supabase.from('band_fund').update({ balance: numValue }).eq('id', 1);
    
    if (!error) {
      setFundBalance(numValue);
      setNewBalanceInput(numValue.toString());
      alert('Kassenstand wurde erfolgreich aktualisiert!');
    } else {
      alert('Fehler beim Speichern: ' + error.message);
    }
  };

  const handleSetlistImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSetlistFile(file); 
      const reader = new FileReader();
      reader.onloadend = () => {
        setEventSetlistImage(reader.result as string); 
      };
      reader.readAsDataURL(file);
    }
  };

  const generatePdfPreview = (lyricsText: string) => {
    if (!lyricsText) return;
    const doc = new jsPDF();
    doc.setFontSize(12);
    const splitLyrics = doc.splitTextToSize(lyricsText, 180); 
    doc.text(splitLyrics, 10, 10);
    const pdfBlobUrl = doc.output('bloburl');
    setGeneratedPdfPreviewUrl(pdfBlobUrl.toString());
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile.can_manage_events && !myProfile.is_admin) return;

    const { error } = await supabase.from('songs').insert([
      {
        title: songTitle,
        artist: songArtist,
        lyrics: songLyrics,
        chords: songChords,
        tab_link: songTabLink,
        pdf_url: songPdfUrl,
        created_by: session.user.id
      }
    ]);

    if (!error) {
      setSongTitle(''); setSongArtist(''); setSongLyrics(''); setSongChords('');
      setSongTabLink(''); setSongPdfUrl(''); setIsAddingSong(false);
      fetchSongs();
    } else {
      alert('Fehler beim Speichern des Songs: ' + error.message);
    }
  };

  const handleDeleteSong = async (songId: string) => {
    if (!myProfile.can_manage_events && !myProfile.is_admin) return;
    if (confirm('Bist du sicher, dass du diesen Song löschen möchtest?')) {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (!error) {
        setSongs(prev => prev.filter(s => s.id !== songId));
        if (selectedSong?.id === songId) {
          setSelectedSong(null);
          setGeneratedPdfPreviewUrl(null);
        }
      }
    }
  };

  const isUserAbsentOnDate = (absence: any, targetDateStr: string) => {
    const target = new Date(targetDateStr);
    const start = new Date(absence.start_date);
    const end = new Date(absence.end_date);
    
    target.setHours(0,0,0,0);
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    return target >= start && target <= end;
  };

  const handleAddAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absenceStartDate || !absenceEndDate) return;

    const { error } = await supabase.from('user_absences').insert([
      {
        user_id: session.user.id,
        start_date: absenceStartDate,
        end_date: absenceEndDate,
        start_time: absenceIsAllDay ? null : absenceStartTime,
        end_time: absenceIsAllDay ? null : absenceEndTime,
        is_all_day: absenceIsAllDay,
        category: absenceCategory,
        notes: absenceNotes
      }
    ]);

    if (!error) {
      setAbsenceStartDate('');
      setAbsenceEndDate('');
      setAbsenceNotes('');
      setAbsenceIsAllDay(true);
      await fetchAbsences();
      
      const conflictingEvents = events.filter(ev => {
        const target = new Date(ev.event_date);
        const start = new Date(absenceStartDate);
        const end = new Date(absenceEndDate);
        target.setHours(0,0,0,0); start.setHours(0,0,0,0); end.setHours(0,0,0,0);
        return target >= start && target <= end;
      });

      for (const ev of conflictingEvents) {
        const existingVote = responses.find(r => r.event_id === ev.id && r.user_id === session.user.id);
        if (existingVote) {
          await supabase.from('event_responses').update({ status: 'nein' }).eq('id', existingVote.id);
        } else {
          await supabase.from('event_responses').insert([{ event_id: ev.id, user_id: session.user.id, status: 'nein' }]);
        }
      }
      await fetchResponses();
    }
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    if (confirm('Möchtest du diese Abwesenheit wirklich löschen?')) {
      const { error } = await supabase.from('user_absences').delete().eq('id', absenceId);
      if (!error) {
        setAbsences(prev => prev.filter(a => a.id !== absenceId));
      } else {
        alert('Fehler beim Löschen: ' + error.message);
      }
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile.can_manage_events && !myProfile.is_admin) return;

    let finalImageUrl = eventSetlistImage;

    if (setlistFile && eventType === 'Auftritt') {
      const fileExt = setlistFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('setlists')
        .upload(fileName, setlistFile);

      if (uploadData) {
        const { data } = supabase.storage.from('setlists').getPublicUrl(fileName);
        finalImageUrl = data.publicUrl;
      } else if (uploadError) {
        alert('Fehler beim Bild-Upload: ' + uploadError.message);
      }
    }

    const eventData = {
      title: eventTitle,
      event_date: eventDate,
      event_time: eventTime,
      location: eventLocation,
      description: eventDescription,
      event_type: eventType,
      setlist_image: eventType === 'Auftritt' ? finalImageUrl : null, 
    };

    let savedEventId = editingEventId;

    if (editingEventId) {
      const { error } = await supabase.from('events').update(eventData).eq('id', editingEventId);
      if (error) return;
    } else {
      const { data, error } = await supabase.from('events').insert([{ ...eventData, created_by: session.user.id }]).select();
      if (error || !data) return;
      savedEventId = data[0].id;
    }

    const blockedPeople = absences.filter(a => isUserAbsentOnDate(a, eventDate));
    for (const block of blockedPeople) {
      const existing = responses.find(r => r.event_id === savedEventId && r.user_id === block.user_id);
      if (existing) {
        await supabase.from('event_responses').update({ status: 'nein' }).eq('id', existing.id);
      } else {
        await supabase.from('event_responses').insert([{ event_id: savedEventId, user_id: block.user_id, status: 'nein' }]);
      }
    }

    setEditingEventId(null); setIsAddingEvent(false); resetForm(); loadData();
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!myProfile.can_manage_events && !myProfile.is_admin) return;
    
    if (confirm('Bist du sicher, dass du diesen Termin komplett löschen willst?')) {
      try {
        await supabase.from('event_responses').delete().eq('event_id', eventId);
        const { error: eventError } = await supabase.from('events').delete().eq('id', eventId);
        
        if (!eventError) { 
          setEvents(prevEvents => prevEvents.filter(ev => ev.id !== eventId));
          setResponses(prevResponses => prevResponses.filter(r => r.event_id !== eventId));
          if (expandedEventId === eventId) setExpandedEventId(null); 
        } else {
          alert('Fehler beim Löschen: ' + eventError.message);
        }
      } catch (err) {
        console.error('Löschvorgang fehlgeschlagen:', err);
      }
    }
  };

  const startEditEvent = (ev: any) => {
    setEditingEventId(ev.id); 
    setEventTitle(ev.title); 
    setEventDate(ev.event_date);
    setEventTime(ev.event_time.substring(0, 5)); 
    setEventLocation(ev.location || '');
    setEventDescription(ev.description || ''); 
    setEventType(ev.event_type || 'Probe');
    setEventSetlistImage(ev.setlist_image || '');
    setSetlistFile(null);
    setIsAddingEvent(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEventTitle(''); setEventDate(''); setEventTime(''); setEventLocation(''); setEventDescription('');
    setEventType('Probe'); setEventSetlistImage(''); setSetlistFile(null); setEditingEventId(null);
  };

  const handleVote = async (eventId: string, status: 'ja' | 'nein') => {
    const existing = responses.find(r => r.event_id === eventId && r.user_id === session.user.id);
    if (existing) {
      await supabase.from('event_responses').update({ status }).eq('id', existing.id);
    } else {
      await supabase.from('event_responses').insert([{ event_id: eventId, user_id: session.user.id, status }]);
    }
    fetchResponses();
  };

  const toggleApprove = async (id: string, currentStatus: boolean) => {
    await supabase.from('profiles').update({ is_approved: !currentStatus }).eq('id', id);
    fetchAllProfiles();
  };

  const togglePermission = async (id: string, columnName: string, currentStatus: boolean) => {
    await supabase.from('profiles').update({ [columnName]: !currentStatus }).eq('id', id);
    fetchAllProfiles();
  };

  const getParsedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    const months = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
    return { dayNum: d.getDate(), dayName: days[d.getDay()], monthName: months[d.getMonth()] };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });
    
    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setMessage({ text: error.message, isError: true });
      if (data?.user) {
        const combinedName = `${firstName.trim()} ${lastName.trim()}`;
        const { error: profileError } = await supabase.from('profiles').insert([
          { id: data.user.id, full_name: combinedName, birth_date: birthDate, is_approved: false }
        ]);
        if (profileError) return setMessage({ text: profileError.message, isError: true });
        setMessage({ text: 'Registrierung erfolgreich! Bitte warte auf die Admin-Freischaltung.', isError: false });
        setIsRegister(false);
        setFirstName(''); setLastName('');
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMessage({ text: error.message, isError: true });
      if (data?.user) {
        const { data: prof } = await supabase.from('profiles').select('is_approved, is_admin').eq('id', data.user.id).single();
        if (prof && !prof.is_approved && !prof.is_admin) {
          await supabase.auth.signOut();
          return setMessage({ text: 'Dein Account wurde noch nicht vom Admin freigeschaltet.', isError: true });
        }
      }
    }
  };

  const handleLogout = () => { setIsMenuOpen(false); supabase.auth.signOut(); };
  const navigateTo = (view: typeof currentView) => { setCurrentView(view); setIsMenuOpen(false); };

  const getFirstName = (fullName: string) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };

  const getDaysInMonthGrid = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay(); 
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const gridDays = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      gridDays.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      gridDays.push({ day, dateString });
    }

    return gridDays;
  };

  const getGroupedEventsByMonth = () => {
    const groups: { [key: string]: any[] } = {};
    filteredEvents.forEach(ev => {
      const d = new Date(ev.event_date);
      const key = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return groups;
  };

  const changeMonth = (direction: number) => {
    const next = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + direction, 1);
    setCurrentCalendarDate(next);
  };

  const handleDayClick = (dateString: string, dayNum: number, dayEvents: any[], dayAbsences: any[]) => {
    const formattedDate = new Date(dateString).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    setSelectedDayDetails({
      dayLabel: formattedDate,
      events: dayEvents,
      absences: dayAbsences
    });
  };

  const filteredEvents = events.filter(ev => activeFilter === 'all' || ev.event_type === activeFilter);
  const activeMembersCount = allProfiles.filter(p => p.is_approved || p.is_admin).length;
  
  const filteredSongs = songs.filter(s => 
    s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) || 
    (s.artist && s.artist.toLowerCase().includes(songSearchQuery.toLowerCase()))
  );

  const myOwnAbsences = absences.filter(a => a.user_id === session?.user?.id);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full m-0 p-0 bg-gray-950 text-gray-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-400 font-bold tracking-wider uppercase animate-pulse">Lade Band-Portal...</p>
        </div>
      </div>
    );
  }

  const calendarGrid = getDaysInMonthGrid();
  const groupedEvents = getGroupedEventsByMonth();
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  if (session && myProfile) {
    return (
      <div className="min-h-[100dvh] w-full bg-gray-950 text-gray-100 font-sans relative overflow-x-hidden selection:bg-amber-500 selection:text-black m-0 p-0">
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          
          <div className="flex justify-between items-center border-b border-gray-900 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent tracking-tight">Burnin' Bugs</h1>
              <p className="text-xs text-gray-500">Hi, {getFirstName(myProfile.full_name)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleLogout} className="bg-gray-900 border border-gray-800 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-xl transition-colors">Abmelden</button>
              {(myProfile.is_approved || myProfile.is_admin) && (
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors z-50 relative flex flex-col justify-center items-center gap-1 w-9 h-9">
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-transform duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1' : ''}`}></span>
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-opacity duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-transform duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}></span>
                </button>
              )}
            </div>
          </div>

          {isMenuOpen && (
            <div className="fixed inset-0 bg-gray-950/98 backdrop-blur-xl z-40 flex flex-col items-center justify-center space-y-6">
              <button onClick={() => navigateTo('termine')} className={`text-2xl font-bold ${currentView === 'termine' ? 'text-amber-500' : 'text-gray-500'}`}>📅 Termine</button>
              <button onClick={() => navigateTo('songs')} className={`text-2xl font-bold ${currentView === 'songs' ? 'text-amber-500' : 'text-gray-500'}`}>🎵 Songs & Tabs</button>
              <button onClick={() => navigateTo('kalender')} className={`text-2xl font-bold ${currentView === 'kalender' ? 'text-amber-500' : 'text-gray-500'}`}>🌴 Kalender / Urlaub</button>
              <button onClick={() => navigateTo('bandkasse')} className={`text-2xl font-bold ${currentView === 'bandkasse' ? 'text-amber-500' : 'text-gray-500'}`}>💰 Bandkasse</button>
              {myProfile.is_admin && <button onClick={() => navigateTo('verwaltung')} className={`text-2xl font-bold ${currentView === 'verwaltung' ? 'text-amber-500' : 'text-gray-500'}`}>🛡️ Verwaltung</button>}
            </div>
          )}

          {/* Alle Modals/Popups sind jetzt begrenzt mit max-w-[95vw] und max-h-[90dvh] */}
          {selectedSetlistImage && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-3xl max-h-[90dvh] max-w-[95vw] rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">📜 Setlist Vorschau</h3>
                  <button onClick={() => setSelectedSetlistImage(null)} className="p-1 bg-gray-950 border border-gray-800 rounded-lg text-xs font-bold px-3 py-1.5 text-gray-400 hover:text-white">Schließen</button>
                </div>
                <div className="overflow-y-auto flex-1 flex items-center justify-center">
                  <img src={selectedSetlistImage} alt="Setlist" className="max-w-full h-auto object-contain rounded-xl border border-gray-800 shadow-inner" />
                </div>
              </div>
            </div>
          )}

          {selectedSong && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl max-h-[90dvh] max-w-[95vw] rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-start border-b border-gray-800 pb-3 mb-4 shrink-0">
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedSong.title}</h3>
                    <p className="text-xs text-amber-500 font-semibold">{selectedSong.artist || 'Unbekannter Interpret'}</p>
                  </div>
                  <button onClick={() => { setSelectedSong(null); setGeneratedPdfPreviewUrl(null); }} className="p-1 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-xs font-bold px-3 py-1.5 shrink-0">Schließen</button>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  {selectedSong.chords && (
                    <div className="bg-gray-950 border border-gray-800 p-3.5 rounded-xl">
                      <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1.5">🎸 Akkorde</h4>
                      <p className="text-xs font-mono text-gray-200 whitespace-pre-wrap">{selectedSong.chords}</p>
                    </div>
                  )}

                  {(selectedSong.tab_link || selectedSong.pdf_url) && (
                    <div className="flex flex-col gap-2">
                      {selectedSong.tab_link && (
                        <div className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-300">Gitarren Tabs:</span>
                          <a href={selectedSong.tab_link} target="_blank" rel="noopener noreferrer" className="text-xs bg-amber-500 text-gray-950 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">🌐 Tab öffnen</a>
                        </div>
                      )}
                      
                      {selectedSong.pdf_url && (
                        <div className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-300">Noten PDF:</span>
                          <a href={selectedSong.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors">📄 PDF öffnen</a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">📜 Songtext</h4>
                      {selectedSong.lyrics && (
                        <button type="button" onClick={() => generatePdfPreview(selectedSong.lyrics)} className="bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5">📄 PDF Ansicht</button>
                      )}
                    </div>
                    <p className="text-xs text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{selectedSong.lyrics || 'Kein Songtext hinterlegt.'}</p>
                    
                    {generatedPdfPreviewUrl && (
                      <div className="mt-4 pt-4 border-t border-gray-800/80 animate-fade-in">
                        <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">👀 PDF Vorschau</h4>
                        <iframe src={generatedPdfPreviewUrl} width="100%" height="350px" className="border border-gray-700 rounded-xl bg-white w-full shadow-inner" title="PDF Vorschau" />
                      </div>
                    )}
                  </div>
                </div>

                {(myProfile.can_manage_events || myProfile.is_admin) && (
                  <div className="pt-4 mt-2 border-t border-gray-800 flex justify-end shrink-0">
                    <button onClick={() => handleDeleteSong(selectedSong.id)} className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold px-3 py-2 rounded-xl transition-colors">🗑️ Song löschen</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedDayDetails && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-md max-h-[90dvh] max-w-[95vw] rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-start border-b border-gray-800 pb-3 mb-4 shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tagesdetails</h3>
                    <p className="text-sm font-black text-white mt-0.5">{selectedDayDetails.dayLabel}</p>
                  </div>
                  <button onClick={() => setSelectedDayDetails(null)} className="p-1 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-xs font-bold px-2.5 py-1 shrink-0">Schließen</button>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  <div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5">🎵 Termine & Gigs</h4>
                    {selectedDayDetails.events.length === 0 ? (
                      <p className="text-xs text-gray-600 italic">Keine Termine an diesem Tag.</p>
                    ) : (
                      selectedDayDetails.events.map(e => (
                        <div key={e.id} className="bg-gray-950 border border-gray-850 p-2.5 rounded-xl text-xs space-y-1 mb-2">
                          <div className="flex justify-between font-bold text-gray-200">
                            <span>{e.title}</span>
                            <span className="text-blue-400 uppercase text-[9px] border border-blue-500/20 bg-blue-500/5 px-1.5 rounded">{e.event_type}</span>
                          </div>
                          <div className="text-gray-400 text-[11px]">🕒 Uhrzeit: {e.event_time.substring(0,5)} Uhr</div>
                          {e.location && <div className="text-gray-500 text-[11px]">📍 Ort: {e.location}</div>}
                          {(myProfile.can_manage_events || myProfile.is_admin) && (
                            <div className="pt-1.5 border-t border-gray-800/60 mt-2">
                              <button type="button" onClick={() => handleDeleteEvent(e.id)} className="text-[10px] text-red-400 hover:underline">🗑️ Aus diesem Tag löschen</button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'songs' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-300">🎵 Song-Repertoire ({songs.length})</h2>
                {(myProfile.can_manage_events || myProfile.is_admin) && (
                  <button onClick={() => setIsAddingSong(!isAddingSong)} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold px-3 py-2 rounded-xl transition-transform active:scale-95">
                    {isAddingSong ? 'Schließen' : '+ Song hinzufügen'}
                  </button>
                )}
              </div>

              {isAddingSong && (
                <form onSubmit={handleAddSong} className="bg-gray-900/90 border border-amber-500/20 p-5 rounded-2xl space-y-4 shadow-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Songtitel</label>
                      <input type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="z.B. Knockin' on Heaven's Door" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Künstler / Interpret</label>
                      <input type="text" value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="z.B. Bob Dylan" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Link für Gitarren Tabs</label>
                      <input type="url" value={songTabLink} onChange={(e) => setSongTabLink(e.target.value)} placeholder="https://www.ultimate-guitar.com/..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Link zum PDF (z.B. Google Drive)</label>
                      <input type="url" value={songPdfUrl} onChange={(e) => setSongPdfUrl(e.target.value)} placeholder="https://..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Akkorde</label>
                      <textarea value={songChords} onChange={(e) => setSongChords(e.target.value)} placeholder="z.B. G - D - Am - C" rows={4} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500 resize-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Songtext (Lyrics)</label>
                      <textarea value={songLyrics} onChange={(e) => setSongLyrics(e.target.value)} placeholder="Strophe 1..." rows={4} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">Song speichern</button>
                </form>
              )}

              <div className="relative">
                <input type="text" value={songSearchQuery} onChange={(e) => setSongSearchQuery(e.target.value)} placeholder="🔍 Nach Songtitel oder Interpret suchen..." className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500 shadow-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSongs.length === 0 ? (
                  <p className="text-xs text-gray-500 italic col-span-2">Keine Songs gefunden.</p>
                ) : (
                  filteredSongs.map(song => (
                    <div key={song.id} onClick={() => setSelectedSong(song)} className="bg-gray-900/40 border border-gray-800 hover:border-gray-700 p-4 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between group">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="text-sm font-bold text-gray-100 group-hover:text-amber-400 transition-colors">{song.title}</h3>
                          <div className="flex gap-1">
                            {song.tab_link && <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold">Tabs 🎸</span>}
                            {song.pdf_url && <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-bold">PDF 📄</span>}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{song.artist || 'Unbekannter Interpret'}</p>
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[11px] text-gray-500">
                        <span>{song.chords ? '🎛️ Akkorde vorhanden' : 'Keine Akkorde'}</span>
                        <span className="text-amber-500 font-bold">Ansehen &rarr;</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {currentView === 'termine' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-300">{editingEventId ? '✏️ Termin bearbeiten' : 'Terminübersicht'}</h2>
                {(myProfile.can_manage_events || myProfile.is_admin) && (
                  <button onClick={() => { if (isAddingEvent) resetForm(); setIsAddingEvent(!isAddingEvent); }} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold px-3 py-2 rounded-xl transition-transform active:scale-95">
                    {isAddingEvent ? 'Schließen' : '+ Termin planen'}
                  </button>
                )}
              </div>

              {isAddingEvent && (
                <form onSubmit={handleSaveEvent} className="bg-gray-900/90 border border-amber-500/20 p-5 rounded-2xl space-y-4 shadow-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Typ</label>
                      <select value={eventType} onChange={(e: any) => setEventType(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500">
                        <option value="Probe">🎵 Probe</option>
                        <option value="Auftritt">🎤 Auftritt</option>
                        <option value="Band-Event">🎸 Band-Event</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Titel / Name</label>
                      <input type="text" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="z.B. Kneipen-Gig oder Grillabend" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Datum</label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Uhrzeit Beginn</label>
                      <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Location</label>
                    <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Adresse oder Location-Name" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500" />
                  </div>

                  {eventType === 'Auftritt' && (
                    <div className="bg-gray-950 border border-gray-850 p-4 rounded-xl space-y-3">
                      <label className="block text-[10px] text-amber-400 font-bold uppercase">📜 Setlist Bild für den Auftritt</label>
                      <div className="flex gap-2 items-center flex-wrap">
                        <input type="file" accept="image/*" onChange={handleSetlistImageUpload} className="text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-gray-950 hover:file:bg-amber-600 cursor-pointer" />
                      </div>
                      {eventSetlistImage && (
                        <div className="relative w-24 h-24 border border-gray-700 rounded-lg overflow-hidden group">
                          <img src={eventSetlistImage} alt="Setlist Vorschau" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => { setEventSetlistImage(''); setSetlistFile(null); }} className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold transition-opacity">Löschen</button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Zusätzliche Infos</label>
                    <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Infos für die Band..." rows={2} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none" />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl py-2.5 transition-colors">{editingEventId ? 'Änderungen speichern' : 'Termin live veröffentlichen'}</button>
                </form>
              )}

              <div className="relative bg-gray-900/80 p-1 rounded-xl flex border border-gray-800/60 max-w-xl">
                <div className="absolute top-1 bottom-1 bg-gray-800 border border-gray-700/50 rounded-lg shadow transition-all duration-300" style={{ left: activeFilter === 'all' ? '4px' : activeFilter === 'Probe' ? '25%' : activeFilter === 'Auftritt' ? '50%' : '75%', width: 'calc(25% - 6px)' }} />
                <button onClick={() => setActiveFilter('all')} className={`relative z-10 w-1/4 py-1.5 text-xs font-bold transition-colors text-center ${activeFilter === 'all' ? 'text-white' : 'text-gray-400'}`}>Alle</button>
                <button onClick={() => setActiveFilter('Probe')} className={`relative z-10 w-1/4 py-1.5 text-xs font-bold transition-colors text-center ${activeFilter === 'Probe' ? 'text-white' : 'text-gray-400'}`}>Proben</button>
                <button onClick={() => setActiveFilter('Auftritt')} className={`relative z-10 w-1/4 py-1.5 text-xs font-bold transition-colors text-center ${activeFilter === 'Auftritt' ? 'text-white' : 'text-gray-400'}`}>Auftritte</button>
                <button onClick={() => setActiveFilter('Band-Event')} className={`relative z-10 w-1/4 py-1.5 text-xs font-bold transition-colors text-center ${activeFilter === 'Band-Event' ? 'text-white' : 'text-gray-400'}`}>Events</button>
              </div>

              <div className="space-y-6">
                {Object.keys(groupedEvents).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Keine Termine für die aktuelle Auswahl vorhanden.</p>
                ) : (
                  Object.keys(groupedEvents).map(monthYearKey => (
                    <div key={monthYearKey} className="space-y-3">
                      <h3 className="text-xs font-black text-amber-500 tracking-wider uppercase border-b border-gray-900 pb-1">{monthYearKey}</h3>
                      
                      <div className="space-y-3">
                        {groupedEvents[monthYearKey].map(ev => {
                          const { dayNum, dayName, monthName } = getParsedDate(ev.event_date);
                          const eventVotes = responses.filter(r => r.event_id === ev.id);
                          const goingUsers = allProfiles.filter(p => eventVotes.some(v => v.user_id === p.id && v.status === 'ja'));
                          const decliningUsers = allProfiles.filter(p => eventVotes.some(v => v.user_id === p.id && v.status === 'nein'));
                          const pendingUsers = allProfiles.filter(p => p.is_approved && !eventVotes.some(v => v.user_id === p.id));
                          const myVote = eventVotes.find(v => v.user_id === session.user.id)?.status;
                          const isExpanded = expandedEventId === ev.id;
                          const isAllGoing = goingUsers.length === activeMembersCount && activeMembersCount > 0;

                          return (
                            <div key={ev.id} className={`relative overflow-hidden bg-gray-900/40 border rounded-2xl p-4 transition-all shadow-sm ${isAllGoing ? 'border-emerald-500/50 bg-emerald-500/[0.03] shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-gray-800 hover:border-gray-700/70'}`}>
                              
                              <div className="flex items-start gap-4 relative z-10">
                                <div className={`flex flex-col items-center justify-center bg-gray-950 border rounded-xl min-w-[64px] h-[72px] text-center p-2 shadow-inner ${isAllGoing ? 'border-emerald-500/30' : 'border-gray-800'}`}>
                                  <span className={`text-[10px] font-black tracking-wider uppercase leading-none ${isAllGoing ? 'text-emerald-400' : 'text-amber-500'}`}>{dayName}</span>
                                  <span className="text-2xl font-black text-white my-0.5 leading-none">{dayNum}</span>
                                  <span className="text-[9px] font-bold text-gray-400 tracking-wide uppercase leading-none">{monthName}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-base font-bold text-gray-100 tracking-tight truncate">{ev.title}</h3>
                                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${ev.event_type === 'Auftritt' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ev.event_type === 'Band-Event' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{ev.event_type}</span>
                                  </div>
                                  <div className="space-y-1 text-xs text-gray-400">
                                    <div className="flex items-center gap-1.5"><span className="text-amber-500/80">🕒</span><span className="font-medium text-gray-300">{ev.event_time.substring(0, 5)} Uhr</span></div>
                                    {ev.location && <div className="flex items-center gap-1.5"><span className="text-amber-500/80">📍</span><span className="truncate text-gray-400">{ev.location}</span></div>}
                                  </div>

                                  {(myProfile.can_manage_events || myProfile.is_admin) && (
                                    <div className="mt-2.5 flex gap-2">
                                      <button type="button" onClick={() => startEditEvent(ev)} className="text-[10px] text-gray-400 hover:text-white bg-gray-950 border border-gray-800 px-2.5 py-1 rounded-lg transition-colors">✏️ Bearbeiten</button>
                                      <button type="button" onClick={() => handleDeleteEvent(ev.id)} className="text-[10px] text-red-400 hover:text-red-350 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg transition-colors">🗑️ Termin löschen</button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col gap-1.5 bg-gray-950/60 border border-gray-800/80 p-1.5 rounded-xl min-w-[90px]">
                                  <button onClick={() => handleVote(ev.id, 'ja')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${myVote === 'ja' ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40' : 'bg-transparent text-emerald-400/70 hover:bg-emerald-500/10'}`}>👍 Zusage</button>
                                  <button onClick={() => handleVote(ev.id, 'nein')} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${myVote === 'nein' ? 'bg-red-500/25 text-red-400 border border-red-500/40' : 'bg-transparent text-red-400/70 hover:bg-red-500/10'}`}>👎 Absage</button>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between flex-wrap gap-2 text-[11px] relative z-10">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">🟢 {goingUsers.length}</span>
                                  <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-semibold">🔴 {decliningUsers.length}</span>
                                  <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold">🟡 {pendingUsers.length} offen</span>
                                </div>
                                <button onClick={() => setExpandedEventId(isExpanded ? null : ev.id)} className="text-xs font-bold text-amber-500/90 hover:text-amber-400 flex items-center gap-1 transition-colors">
                                  {isExpanded ? 'Details verbergen 🔼' : 'Details & wer kommt? 🔽'}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-4 text-xs relative z-10">
                                  {ev.description && (
                                    <div>
                                      <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-1">ℹ️ Notizen & Infos:</h4>
                                      <p className="text-gray-300 bg-gray-900/40 p-3 rounded-lg border border-gray-800 italic whitespace-pre-wrap">{ev.description}</p>
                                    </div>
                                  )}

                                  {ev.event_type === 'Auftritt' && ev.setlist_image && (
                                    <div className="bg-purple-950/20 border border-purple-900/30 p-3 rounded-xl flex items-center justify-between">
                                      <span className="font-bold text-purple-400">📜 Setlist hinterlegt</span>
                                      <button onClick={() => setSelectedSetlistImage(ev.setlist_image)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors">Bild anzeigen</button>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[10px] mb-2">📋 Anmeldestatus:</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-lg space-y-1">
                                        <span className="font-bold text-emerald-400 block border-b border-emerald-900/40 pb-1 mb-1">Dabei ({goingUsers.length})</span>
                                        {goingUsers.length === 0 ? <span className="text-gray-600 italic block">Niemand</span> : goingUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-emerald-300/90 font-medium py-0.5">✓ {u.full_name}</span>)}
                                      </div>
                                      <div className="bg-red-950/20 border border-red-900/30 p-2 rounded-lg space-y-1">
                                        <span className="font-bold text-red-400 block border-b border-red-900/40 pb-1 mb-1">Abgesagt ({decliningUsers.length})</span>
                                        {decliningUsers.length === 0 ? <span className="text-gray-600 italic block">Niemand</span> : decliningUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-red-300/90 font-medium py-0.5">✕ {u.full_name}</span>)}
                                      </div>
                                      <div className="bg-amber-950/20 border border-amber-900/30 p-2 rounded-lg space-y-1">
                                        <span className="font-bold text-amber-400 block border-b border-amber-900/40 pb-1 mb-1">Offen ({pendingUsers.length})</span>
                                        {pendingUsers.length === 0 ? <span className="text-gray-600 italic block">Alle abgestimmt</span> : pendingUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-amber-300/80 py-0.5">? {u.full_name}</span>)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {currentView === 'kalender' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-sm">
                <button onClick={() => changeMonth(-1)} className="p-2 bg-gray-950 hover:bg-gray-800 rounded-xl text-amber-500 font-bold text-sm border border-gray-800 transition-colors">&lt; Zurück</button>
                <h2 className="text-base font-black text-gray-100 uppercase tracking-wider">
                  {currentCalendarDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="p-2 bg-gray-950 hover:bg-gray-800 rounded-xl text-amber-500 font-bold text-sm border border-gray-800 transition-colors">Weiter &gt;</button>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-sm">
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {weekDays.map(day => <div key={day} className="py-1">{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarGrid.map((dayData, index) => {
                    if (!dayData) return <div key={`empty-${index}`} className="bg-gray-950/20 rounded-lg min-h-[75px]" />;

                    const dayEvents = events.filter(e => e.event_date === dayData.dateString);
                    const dayAbsences = absences.filter(a => isUserAbsentOnDate(a, dayData.dateString));

                    return (
                      <div key={dayData.dateString} onClick={() => handleDayClick(dayData.dateString, dayData.day, dayEvents, dayAbsences)} className="bg-gray-950 border border-gray-850 p-1.5 rounded-xl min-h-[75px] flex flex-col justify-between hover:border-amber-500/50 cursor-pointer transition-all group">
                        <span className="text-[11px] font-bold text-gray-400 group-hover:text-white transition-colors ml-0.5">{dayData.day}</span>
                        
                        <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end overflow-hidden pb-0.5">
                          {dayAbsences.map(a => {
                            const u = allProfiles.find(p => p.id === a.user_id);
                            if (a.start_date !== a.end_date) {
                              return (
                                <div key={a.id} className="text-[8px] font-bold truncate bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md tracking-tight leading-tight w-full">
                                  🌴 {u ? getFirstName(u.full_name) : 'Urlaub'}
                                </div>
                              );
                            }
                            return null;
                          })}

                          <div className="flex flex-wrap gap-1 mt-0.5 items-center px-0.5">
                            {dayEvents.map(e => (
                              <span key={e.id} className={`h-2 w-2 rounded-full inline-block ${e.event_type === 'Auftritt' ? 'bg-purple-500 shadow-sm shadow-purple-500' : e.event_type === 'Band-Event' ? 'bg-orange-500' : 'bg-blue-400'}`} title={e.title} />
                            ))}
                            {dayAbsences.map(a => {
                              if (a.start_date === a.end_date) {
                                return <span key={a.id} className="h-2 w-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400 inline-block" title={`Abwesenheit: ${a.category}`} />;
                              }
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleAddAbsence} className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">🛑 Abwesenheit eintragen</h3>
                
                <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" id="allDayToggle" checked={absenceIsAllDay} onChange={(e) => setAbsenceIsAllDay(e.target.checked)} className="w-4 h-4 accent-amber-500 bg-gray-800 border-gray-700 rounded" />
                  <label htmlFor="allDayToggle" className="text-xs font-bold text-gray-300 cursor-pointer">Ganztägig abwesend</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Start-Datum</label>
                    <input type="date" value={absenceStartDate} onChange={(e) => setAbsenceStartDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">End-Datum</label>
                    <input type="date" value={absenceEndDate} onChange={(e) => setAbsenceEndDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required />
                  </div>
                </div>

                {!absenceIsAllDay && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Startzeit</label>
                      <input type="time" value={absenceStartTime} onChange={(e) => setAbsenceStartTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required={!absenceIsAllDay} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Endzeit</label>
                      <input type="time" value={absenceEndTime} onChange={(e) => setAbsenceEndTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" required={!absenceIsAllDay} />
                    </div>
                  </div>
                )}

                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold px-4 py-2 rounded-xl transition-colors">Eintragen & Speichern</button>
              </form>

              <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider">📋 Meine eingetragenen Abwesenheiten</h3>
                {myOwnAbsences.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Du hast aktuell keine Abwesenheiten eingetragen.</p>
                ) : (
                  <div className="space-y-2">
                    {myOwnAbsences.map((a) => {
                      const start = new Date(a.start_date).toLocaleDateString('de-DE');
                      const end = new Date(a.end_date).toLocaleDateString('de-DE');
                      const timeStr = !a.is_all_day && a.start_time && a.end_time 
                        ? ` (${a.start_time.substring(0, 5)} - ${a.end_time.substring(0, 5)} Uhr)` 
                        : ' (Ganztägig)';
                        
                      return (
                        <div key={a.id} className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-gray-200">
                              {start === end ? start : `${start} bis ${end}`}
                            </span>
                            <span className="text-gray-400 ml-1">{timeStr}</span>
                          </div>
                          <button onClick={() => handleDeleteAbsence(a.id)} className="bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 font-bold px-3 py-1.5 rounded-lg transition-colors">
                            Löschen 🗑️
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'verwaltung' && myProfile.is_admin && (
            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl shadow-sm">
              <h2 className="text-lg font-bold text-amber-500 mb-4">🛡️ Admin-Zentrale</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs uppercase text-gray-400">
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Instrument</th>
                      <th className="pb-3">Rechte</th>
                      <th className="pb-3 text-right">Zugang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {allProfiles.map((p) => {
                      const isMe = p.id === session.user.id;
                      return (
                        <tr key={p.id} className={isMe ? "bg-amber-500/[0.02]" : ""}>
                          <td className="py-4 font-medium">
                            {p.full_name} {isMe && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-1 font-bold">Du</span>}
                          </td>
                          <td className="py-4">🎵 {p.instrument || 'Nicht zugewiesen'}</td>
                          <td className="py-4">
                            {p.is_admin ? (
                              <span className="text-xs px-2 py-1 rounded-md border bg-purple-500/10 text-purple-400 border-purple-500/30 font-bold">👑 Haupt-Admin</span>
                            ) : (
                              <button onClick={() => togglePermission(p.id, 'can_manage_events', p.can_manage_events)} className={`text-xs px-2 py-1 rounded-md border ${p.can_manage_events ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-transparent text-gray-400 border-gray-800'}`}>
                                {p.can_manage_events ? '🟢 Admin (Events)' : '🔴 Standard'}
                              </button>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            {isMe || p.is_admin ? (
                              <span className="text-xs px-2.5 py-1.5 text-emerald-400 font-bold bg-emerald-500/10 rounded-lg border border-emerald-500/20">Aktiv</span>
                            ) : (
                              <button onClick={() => toggleApprove(p.id, p.is_approved)} className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${p.is_approved ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                                {p.is_approved ? 'Sperren' : 'Freischalten'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentView === 'bandkasse' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-300">💰 Bandkasse</h2>

              <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center">
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-3">Aktueller Kassenstand</p>
                <div className="bg-gray-950 border border-gray-800 px-8 py-6 rounded-2xl shadow-inner min-w-[200px]">
                  <p className="text-4xl font-black text-emerald-500 tracking-tight">
                    {fundBalance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>

              {myProfile.is_admin && (
                <form onSubmit={handleUpdateFundBalance} className="bg-gray-900/90 border border-amber-500/20 p-6 rounded-2xl space-y-4 shadow-lg max-w-sm mx-auto">
                  <h3 className="text-xs font-bold uppercase text-amber-500 tracking-wider text-center mb-2">⚙️ Kassenstand anpassen</h3>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-bold uppercase mb-1">Neuer Betrag (in Euro)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newBalanceInput}
                      onChange={(e) => setNewBalanceInput(e.target.value)}
                      placeholder="z.B. 150.50"
                      className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 text-center font-mono text-lg"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl py-3 transition-colors uppercase tracking-wider">
                    Speichern
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] w-full bg-gray-950 text-gray-100 flex flex-col justify-between p-6 font-sans m-0">
      <div className="flex flex-col items-center mt-8">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg"><span className="text-xl font-black text-gray-950">BB</span></div>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Burnin' Bugs Portal</h1>
      </div>
      <div className="w-full max-w-sm mx-auto bg-gray-900/40 border border-gray-800/60 rounded-3xl p-6 backdrop-blur-md">
        {message.text && <div className={`mb-4 p-3 rounded-xl text-xs text-center ${message.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{message.text}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1">Vorname</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" required />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-1">Nachname</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mustermann" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" required />
                </div>
              </div>
              <div><label className="block text-xs text-gray-400 uppercase mb-1">Geburtsdatum</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" required /></div>
            </>
          )}
          <div><label className="block text-xs text-gray-400 uppercase mb-1">E-Mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@band.de" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" required /></div>
          <div><label className="block text-xs text-gray-400 uppercase mb-1">Passwort</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500" required /></div>
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 font-bold text-sm rounded-xl py-3.5 transition-all active:scale-95">{isRegister ? 'Registrieren' : 'Anmelden'}</button>
        </form>
        <div className="text-center mt-6"><button type="button" onClick={() => setIsRegister(!isRegister)} className="text-xs text-gray-400 hover:text-amber-500 underline">{isRegister ? 'Bereits registriert? Login' : 'Konto erstellen'}</button></div>
      </div>
      <div className="text-center text-[10px] text-gray-600">&copy; {new Date().getFullYear()} Burnin' Bugs.</div>
    </div>
  );
}