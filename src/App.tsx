import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { jsPDF } from "jspdf"; 
import Cropper from 'react-easy-crop';

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getCroppedImg = async (imageSrc: string, pixelCrop: any, fileName: string): Promise<File> => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas is empty'));
      resolve(new File([blob], fileName, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  });
};

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
  const [veranstalter, setVeranstalter] = useState<any[]>([]);
  const [ansprechpartner, setAnsprechpartner] = useState<any[]>([]);
  const [crmSearch, setCrmSearch] = useState('');
  const [expandedVeranstalter, setExpandedVeranstalter] = useState<string | null>(null);
  const [isAddingVeranstalter, setIsAddingVeranstalter] = useState(false);
  const [newVeranstalterName, setNewVeranstalterName] = useState('');
  
  const [addingKontaktFor, setAddingKontaktFor] = useState<string | null>(null);
  const [newKontaktName, setNewKontaktName] = useState('');
  const [newKontaktKategorie, setNewKontaktKategorie] = useState('Allgemein');
  const [newKontaktTelefon, setNewKontaktTelefon] = useState('');
  const [newKontaktEmail, setNewKontaktEmail] = useState('');
  const [editingVeranstalterId, setEditingVeranstalterId] = useState<string | null>(null);
  const [editingKontaktId, setEditingKontaktId] = useState<string | null>(null);
  const [editKontaktName, setEditKontaktName] = useState('');
  const [editKontaktKategorie, setEditKontaktKategorie] = useState('');
  const [editKontaktTelefon, setEditKontaktTelefon] = useState('');
  const [editKontaktEmail, setEditKontaktEmail] = useState('');
  const handleSaveVeranstalter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVeranstalterName.trim()) return;
    const { error } = await supabase.from('veranstalter').insert([{ name: newVeranstalterName }]);
    if (error) alert('Fehler: ' + error.message);
    else { setNewVeranstalterName(''); setIsAddingVeranstalter(false); fetchCrmData(); }
  };

  const handleSaveKontakt = async (e: React.FormEvent, vId: string) => {
    e.preventDefault();
    if (!newKontaktName.trim()) return;
    const { error } = await supabase.from('ansprechpartner').insert([{
      veranstalter_id: vId, name: newKontaktName, kategorie: newKontaktKategorie, telefon: newKontaktTelefon, email: newKontaktEmail
    }]);
    if (error) alert('Fehler: ' + error.message);
    else {
      setNewKontaktName(''); setNewKontaktKategorie('Allgemein'); setNewKontaktTelefon(''); setNewKontaktEmail('');
      setAddingKontaktFor(null); fetchCrmData();
    }
  };
  const handleUpdateVeranstalter = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!newVeranstalterName.trim()) return;
    const { error } = await supabase.from('veranstalter').update({ name: newVeranstalterName }).eq('id', id);
    if (error) alert('Fehler: ' + error.message);
    else { setEditingVeranstalterId(null); setNewVeranstalterName(''); fetchCrmData(); }
  };

  const handleDeleteVeranstalter = async (id: string) => {
    if (confirm('Achtung: Soll dieser Veranstalter und ALLE dazugehörigen Kontakte wirklich gelöscht werden?')) {
      await supabase.from('veranstalter').delete().eq('id', id);
      fetchCrmData();
    }
  };

  const startEditKontakt = (kontakt: any) => {
    setEditingKontaktId(kontakt.id);
    setEditKontaktName(kontakt.name);
    setEditKontaktKategorie(kontakt.kategorie || 'Allgemein');
    setEditKontaktTelefon(kontakt.telefon || '');
    setEditKontaktEmail(kontakt.email || '');
  };

  const handleUpdateKontakt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKontaktName.trim() || !editingKontaktId) return;
    const { error } = await supabase.from('ansprechpartner').update({
      name: editKontaktName, kategorie: editKontaktKategorie, telefon: editKontaktTelefon, email: editKontaktEmail
    }).eq('id', editingKontaktId);
    if (error) alert('Fehler: ' + error.message);
    else { setEditingKontaktId(null); fetchCrmData(); }
  };
  const fetchCrmData = async () => {
    const { data: vData } = await supabase.from('veranstalter').select('*').order('name');
    if (vData) setVeranstalter(vData);
    const { data: aData } = await supabase.from('ansprechpartner').select('*').order('name');
    if (aData) setAnsprechpartner(aData);
  };
  const [myProfile, setMyProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);

  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'default'>('default');

  const [currentView, setCurrentView] = useState<'dashboard' | 'termine' | 'kalender' | 'verwaltung' | 'bandkasse' | 'songs' | 'setlisten' | 'dateien' | 'kontakte' | 'fotos'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'Probe' | 'Auftritt' | 'Band-Event'>('all');

  const [events, setEvents] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [selectedSetlistImage, setSelectedSetlistImage] = useState<string | null>(null); 
  
  const [showPastEvents, setShowPastEvents] = useState(false);
  
  const getTodayString = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return (new Date(today.getTime() - tzOffset)).toISOString().split('T')[0];
  };

  const [absences, setAbsences] = useState<any[]>([]);
  const [absenceStartDate, setAbsenceStartDate] = useState('');
  const [absenceEndDate, setAbsenceEndDate] = useState('');
  const [absenceStartTime, setAbsenceStartTime] = useState('00:00');
  const [absenceEndTime, setAbsenceEndTime] = useState('23:59');
  const [absenceIsAllDay, setAbsenceIsAllDay] = useState(true);
  const [absenceCategory, setAbsenceCategory] = useState<'Urlaub' | 'Termin' | 'Arbeit' | 'Schule'>('Urlaub');
  const [absenceNotes, setAbsenceNotes] = useState('');

  const [songs, setSongs] = useState<any[]>([]);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<any | null>(null);
  const [isAddingSong, setIsAddingSong] = useState(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null); 
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songDuration, setSongDuration] = useState(''); 
  const [songBpm, setSongBpm] = useState(''); 
  const [songKey, setSongKey] = useState(''); 
  const [songLyrics, setSongLyrics] = useState('');
  const [songTabLink, setSongTabLink] = useState('');
  const [songCover, setSongCover] = useState('');
  const [songStatus, setSongStatus] = useState('Vorschläge');
  const [songFilter, setSongFilter] = useState('Alle');
  const [isFetchingSongData, setIsFetchingSongData] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const autoFillSongData = async () => {
    if (!songTitle.trim() || !songArtist.trim()) {
      return alert('Bitte gib zuerst einen Titel UND einen Interpreten ein, damit die Suche funktioniert!');
    }
    
    setIsFetchingSongData(true);

    try {
      // 1. Spotify Token holen
      const clientId = '7b33a0f8a3244958bcba885902b66059';
      const clientSecret = '5548ad7065f543eb8667e0c60c5cd82f';
      const authResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
        },
        body: 'grant_type=client_credentials'
      });
      const authData = await authResponse.json();
      const token = authData.access_token;

      // 2. Song bei Spotify suchen
      const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=track:${encodeURIComponent(songTitle)}%20artist:${encodeURIComponent(songArtist)}&type=track&limit=1`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const searchData = await searchResponse.json();

      if (searchData.tracks && searchData.tracks.items.length > 0) {
        const track = searchData.tracks.items[0];
        const totalSeconds = Math.floor(track.duration_ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        // Dauer immer überschreiben
        setSongDuration(`${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
        
        // Das Album-Cover NUR hinzufügen, wenn noch keins existiert!
        if (track.album && track.album.images.length > 0) {
          if (!songCover) {
            setSongCover(track.album.images[0].url);
          }
        }

        // 🌟 NEU: Spotify nach den musikalischen Eigenschaften (BPM & Tonart) fragen!
        const featuresResponse = await fetch(`https://api.spotify.com/v1/audio-features/${track.id}`, {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        const featuresData = await featuresResponse.json();

        // Strenge Prüfung: Nur verarbeiten, wenn Spotify keinen Fehler wirft
        if (featuresData && !featuresData.error) {
          // BPM ausfüllen (nur wenn Feld leer ist und ein Tempo existiert)
          if (!songBpm && featuresData.tempo) {
            setSongBpm(Math.round(featuresData.tempo).toString());
          }
          
          // Tonart ausfüllen (nur wenn Feld leer ist und Spotify eine GÜLTIGE Zahl liefert)
          if (!songKey && typeof featuresData.key === 'number' && featuresData.key >= 0 && featuresData.key <= 11) {
            const tonarten = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
            const tonartName = tonarten[featuresData.key];
            const mode = featuresData.mode === 1 ? 'Dur' : 'moll';
            setSongKey(`${tonartName}-${mode}`);
          }
        }
      }

      // 3. Songtext über LRCLIB holen
      try {
        const lyricsResponse = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(songTitle)}&artist_name=${encodeURIComponent(songArtist)}`);
        const lyricsData = await lyricsResponse.json();
        
        if (lyricsData && lyricsData.length > 0 && lyricsData[0].plainLyrics) {
          // Den Songtext IMMER gnadenlos überschreiben
          setSongLyrics(lyricsData[0].plainLyrics);
        } else {
          console.log('LRCLIB hat für diesen speziellen Song keinen Text gefunden.');
        }
      } catch (lyricErr) {
        console.log('Fehler beim Songtext-Abruf:', lyricErr);
      }

    } catch (error: any) {
      alert('Fehler bei der API-Abfrage: ' + error.message);
    }
    
    setIsFetchingSongData(false);
  };
  const bulkUpdateAllSongs = async () => {
    if (!confirm('Sollen jetzt alle Songs im Hintergrund aktualisiert werden? Das dauert einen Moment...')) return;
    setIsFetchingSongData(true);

    try {
      // 1. Spotify Token (einmalig für den ganzen Durchlauf holen)
      const authResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + btoa('7b33a0f8a3244958bcba885902b66059:5548ad7065f543eb8667e0c60c5cd82f') },
        body: 'grant_type=client_credentials'
      });
      const authData = await authResponse.json();
      const token = authData.access_token;

      // 2. Jeden Song durchgehen
      for (const s of songs) {
        if (!s.title || !s.artist) continue;

        let updatedCover = s.cover_url;
        let updatedLyrics = s.lyrics;
        let updatedDuration = s.duration;

        // Spotify Abfrage
        const searchRes = await fetch(`https://api.spotify.com/v1/search?q=track:${encodeURIComponent(s.title)}%20artist:${encodeURIComponent(s.artist)}&type=track&limit=1`, { headers: { 'Authorization': 'Bearer ' + token } });
        const searchData = await searchRes.json();
        
        if (searchData.tracks && searchData.tracks.items.length > 0) {
          const track = searchData.tracks.items[0];
          const totalSecs = Math.floor(track.duration_ms / 1000);
          const mins = Math.floor(totalSecs / 60);
          const secs = totalSecs % 60;
          updatedDuration = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
          if (track.album && track.album.images.length > 0 && !s.cover_url) updatedCover = track.album.images[0].url;
        }

        // LRCLIB Abfrage
        try {
          const lyricRes = await fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(s.title)}&artist_name=${encodeURIComponent(s.artist)}`);
          const lyricData = await lyricRes.json();
          if (lyricData && lyricData.length > 0 && lyricData[0].plainLyrics) updatedLyrics = lyricData[0].plainLyrics;
        } catch (e) {}

        // In Supabase speichern
        await supabase.from('songs').update({ duration: updatedDuration, cover_url: updatedCover, lyrics: updatedLyrics }).eq('id', s.id);

        // 800 Millisekunden Pause, damit Spotify uns nicht wegen Spam blockiert!
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      alert('✅ Alle Songs erfolgreich aktualisiert!');
      fetchSongs();
    } catch (error: any) {
      alert('Fehler beim Massen-Update: ' + error.message);
    }
    setIsFetchingSongData(false);
  };
  const handleTapTempo = () => {
    const now = Date.now();
    // Behalte nur Klicks, die nicht länger als 3 Sekunden her sind (sonst fängt er bei Pausen falsch an zu rechnen)
    const newTaps = [...tapTimes, now].filter(t => now - t < 3000);
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      // Berechne die Abstände zwischen den Klicks
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      
      // Durchschnittlichen Abstand nehmen und in BPM umrechnen (60.000 Millisekunden = 1 Minute)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      
      // Das Ergebnis direkt in das BPM-Feld schreiben
      setSongBpm(calculatedBpm.toString());
    }
  };
  const toggleSongStatus = async (songId: string, currentStatus: string) => {
    // Bestimme den nächsten Status
    const nextStatus = currentStatus === 'Vorschläge' ? 'am Proben' : currentStatus === 'am Proben' ? 'Fertig' : 'Vorschläge';
    
    // UI sofort updaten, damit es sich blitzschnell anfühlt
    setSongs(songs.map(s => s.id === songId ? { ...s, status: nextStatus } : s));
    if (selectedSong && selectedSong.id === songId) setSelectedSong({ ...selectedSong, status: nextStatus });

    // Datenbank im Hintergrund speichern
    await supabase.from('songs').update({ status: nextStatus }).eq('id', songId);
  };
  const [fundBalance, setFundBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transAmount, setTransAmount] = useState('');
  const [transReason, setTransReason] = useState('');
  const [transType, setTransType] = useState<'+' | '-'>('+');
  const [isSubmittingTrans, setIsSubmittingTrans] = useState(false);

  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDayDetails, setSelectedDayDetails] = useState<{ dayLabel: string; events: any[]; absences: any[] } | null>(null);

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventMapsLink, setEventMapsLink] = useState(''); 
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState<'Probe' | 'Auftritt' | 'Band-Event'>('Probe');
  
  const [eventGigStatus, setEventGigStatus] = useState<'Angebot' | 'Steht fest' | 'Abgesagt'>('Steht fest');
  const [setlistOverviewSearchQuery, setSetlistOverviewSearchQuery] = useState('');
  const [liveSetlistMode, setLiveSetlistMode] = useState(false);
  const [liveSetlistSongs, setLiveSetlistSongs] = useState<any[]>([]);
  const [liveSongIndex, setLiveSongIndex] = useState(0);
  const [eventGage, setEventGage] = useState('');
  const [eventPlayTime, setEventPlayTime] = useState('');
  const [eventPlayTimeStart, setEventPlayTimeStart] = useState('');
  const [eventPlayTimeEnd, setEventPlayTimeEnd] = useState('');
  const [eventSoundcheck, setEventSoundcheck] = useState('');

  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const [eventSetlistImage, setEventSetlistImage] = useState(''); 
  const [setlistFile, setSetlistFile] = useState<File | null>(null); 

  const [savedSetlists, setSavedSetlists] = useState<any[]>([]); 
  const [planningSetlistEvent, setPlanningSetlistEvent] = useState<any | null>(null); 
  const [planningSetlistTemplate, setPlanningSetlistTemplate] = useState<any | null>(null); 
  
  const [setlistData, setSetlistData] = useState<any[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [setlistSearchQuery, setSetlistSearchQuery] = useState('');

  const [bandFiles, setBandFiles] = useState<any[]>([]);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadFileTitle, setUploadFileTitle] = useState('');
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);

  const [instruments, setInstruments] = useState<string[]>(['Drums', 'Bass', 'Lead Gitarre', 'Gesang', 'Piano']);

  const [songNotes, setSongNotes] = useState<Record<string, string>>({});
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [isEditingMyProfile, setIsEditingMyProfile] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextTickRef = useRef<number>(0);

  useEffect(() => {
    let interval: any;
    if (isScrolling && isLiveMode) {
      interval = setInterval(() => {
        const container = document.getElementById('live-mode-container');
        if (container) container.scrollBy(0, 1);
      }, 40); 
    }
    return () => clearInterval(interval);
  }, [isScrolling, isLiveMode]);

  useEffect(() => {
    if (!selectedSong && !isLiveMode) {
      setIsMetronomePlaying(false);
      window.clearTimeout(nextTickRef.current);
      setIsScrolling(false);
    }
  }, [selectedSong, isLiveMode]);

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service Worker Fehler:', err));
    }

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
        setSavedSetlists([]);
        setBandFiles([]);
        setTransactions([]);
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
      fetchSetlists(), 
      fetchBandFiles(), 
      fetchFotoData(),
      fetchFundBalance(),
      fetchTransactions(),
      fetchMyNotes(),
      fetchCrmData()
    ]);
  };

  const fetchMyNotes = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('song_notes').select('*').eq('user_id', session.user.id);
    if (data) {
      const map = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.song_id]: curr.note_text }), {});
      setSongNotes(map);
    }
  };

  const handleSaveNote = async (songId: string, text: string) => {
    setSongNotes(prev => ({ ...prev, [songId]: text }));
    const { data } = await supabase.from('song_notes').select('id').eq('song_id', songId).eq('user_id', session.user.id).single();
    if (data) {
       await supabase.from('song_notes').update({ note_text: text, updated_at: new Date() }).eq('id', data.id);
    } else {
       await supabase.from('song_notes').insert([{ song_id: songId, user_id: session.user.id, note_text: text }]);
    }
  };

  const playClick = () => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05);
  };

  const toggleMetronome = (bpmStr: string) => {
    const bpm = parseInt(bpmStr);
    if (!bpm || isNaN(bpm)) return alert('Kein gültiger BPM Wert hinterlegt!');
    if (isMetronomePlaying) {
      setIsMetronomePlaying(false); window.clearTimeout(nextTickRef.current);
    } else {
      setIsMetronomePlaying(true);
      const interval = 60000 / bpm;
      const loop = () => { playClick(); nextTickRef.current = window.setTimeout(loop, interval); };
      loop();
    }
  };
  const startSetlistLiveMode = (template: any) => {
    if (!confirm(`Möchtest du den Live-Modus für "${template.title}" starten?`)) return;
    const flattenedSongs: any[] = [];
    template.setlist_data?.forEach((set: any) => {
      set.songs?.forEach((songData: any) => {
        const fullSong = songs.find(s => s.id === songData.id) || songData;
        flattenedSongs.push(fullSong);
      });
    });
    if (flattenedSongs.length === 0) return alert('Diese Setlist enthält noch keine Songs!');
    setLiveSetlistSongs(flattenedSongs); setLiveSongIndex(0); setSelectedSong(flattenedSongs[0]); setLiveSetlistMode(true); setIsLiveMode(true);
  };

  const nextLiveSong = () => {
    if (liveSongIndex < liveSetlistSongs.length - 1) {
      setIsMetronomePlaying(false); window.clearTimeout(nextTickRef.current); setIsScrolling(false);
      const newIndex = liveSongIndex + 1; setLiveSongIndex(newIndex); setSelectedSong(liveSetlistSongs[newIndex]);
    }
  };

  const prevLiveSong = () => {
    if (liveSongIndex > 0) {
      setIsMetronomePlaying(false); window.clearTimeout(nextTickRef.current); setIsScrolling(false);
      const newIndex = liveSongIndex - 1; setLiveSongIndex(newIndex); setSelectedSong(liveSetlistSongs[newIndex]);
    }
  };
  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      if (!data.is_approved && !data.is_admin) {
        await supabase.auth.signOut();
        setMessage({ text: 'Dein Account wurde noch nicht vom Admin freigeschaltet.', isError: true });
        setMyProfile(null);
        setSession(null);
        return;
      }
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
  const handleUpdateProfile = async (userId: string, newBio: string, newInstrument: string) => {
    // Sicherheitsabfrage vor dem Hochladen
    if (!confirm('🌐 ACHTUNG: Diese Daten (inklusive Foto) werden nach dem Speichern DIREKT auf eurer öffentlichen Band-Homepage sichtbar sein!\n\nMöchtest du dein Profil jetzt online stellen?')) return;

    const { error } = await supabase.from('profiles').update({ 
      bio: newBio, 
      instrument: newInstrument 
    }).eq('id', userId);
    
    if (error) alert('Fehler beim Speichern: ' + error.message);
    else {
      // Erfolgsmeldung und zurück in den Steckbrief-Modus wechseln
      alert('✅ Profil Erfolgreich Hochgeladen!');
      fetchAllProfiles();
      if (userId === session?.user?.id) {
        fetchProfile(userId);
        setIsEditingMyProfile(false);
      }
    }
  };

  // --- NEUE CROPPER STATES ---
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [targetUserIdForCrop, setTargetUserIdForCrop] = useState<string | null>(null);

  // 1. Wird aufgerufen, wenn jemand ein Bild vom Handy/PC auswählt
  const handleSelectFileForCrop = (e: React.ChangeEvent<HTMLInputElement>, userId: string) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || null));
      reader.readAsDataURL(e.target.files[0]);
      setTargetUserIdForCrop(userId);
    }
    e.target.value = ''; // Input zurücksetzen
  };

  // 2. Wird aufgerufen, wenn man im Cropper auf "Zuschneiden & Speichern" klickt
  const handleSaveCroppedImage = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !targetUserIdForCrop) return;
    try {
      // Bild zuschneiden
      const croppedFile = await getCroppedImg(cropImageSrc, croppedAreaPixels, 'avatar.jpg');
      // Hochladen
      await uploadAvatarFile(croppedFile, targetUserIdForCrop);
      // Cropper schließen
      setCropImageSrc(null); 
    } catch (e) {
      console.error('Fehler beim Zuschneiden:', e);
    }
  };

  // 3. Der eigentliche Upload-Vorgang zu Supabase
  const uploadAvatarFile = async (file: File, userId: string) => {
    const targetProfile = allProfiles.find(p => p.id === userId) || myProfile;
    const fullName = targetProfile?.full_name || 'Unbekannt';
    const safeName = fullName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const newFileName = `${safeName}.jpg`;

    if (targetProfile.avatar_url) {
      try {
        const oldUrl = new URL(targetProfile.avatar_url);
        const pathParts = oldUrl.pathname.split('/');
        const oldFileName = pathParts[pathParts.length - 1]; 
        if (oldFileName) await supabase.storage.from('avatars').remove([oldFileName]);
      } catch (err) {}
    }

    const { error: uploadError } = await supabase.storage.from('avatars').upload(newFileName, file, { upsert: true });
    if (uploadError) return alert('Fehler beim Bild-Upload: ' + uploadError.message);

    const { data } = supabase.storage.from('avatars').getPublicUrl(newFileName);
    const cacheBusterUrl = `${data.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: cacheBusterUrl }).eq('id', userId);
    fetchAllProfiles();
    if (userId === session?.user?.id) fetchProfile(userId);
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

  const fetchSetlists = async () => {
    const { data } = await supabase.from('setlists').select('*').order('title', { ascending: true });
    if (data) setSavedSetlists(data);
  };

  const fetchBandFiles = async () => {
    const { data } = await supabase.from('band_files').select('*').order('created_at', { ascending: false });
    if (data) setBandFiles(data);
  };

  const [fotoAlben, setFotoAlben] = useState<any[]>([]);
  const [bandFotos, setBandFotos] = useState<any[]>([]);
  const [fotoTags, setFotoTags] = useState<any[]>([]);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);

  const fetchFotoData = async () => {
    const { data: alben } = await supabase.from('foto_alben').select('*').order('event_date', { ascending: false });
    if (alben) setFotoAlben(alben);
    const { data: fotos } = await supabase.from('band_fotos').select('*');
    if (fotos) setBandFotos(fotos);
    const { data: tags } = await supabase.from('foto_tags').select('*');
    if (tags) setFotoTags(tags);
  };

  const [isAddingFotoAlbum, setIsAddingFotoAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDate, setNewAlbumDate] = useState(getTodayString());

  const handleCreateFotoAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle.trim() || !newAlbumDate) return;
    await supabase.from('foto_alben').insert([{ title: newAlbumTitle, event_date: newAlbumDate }]);
    setIsAddingFotoAlbum(false);
    setNewAlbumTitle('');
    setNewAlbumDate(getTodayString());
    fetchFotoData();
  };

  const handleFotoUploadForAlbum = async (e: React.ChangeEvent<HTMLInputElement>, albumId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage.from('band_fotos').upload(fileName, file);
    if (error) return alert('Fehler: ' + error.message);
    const { data } = supabase.storage.from('band_fotos').getPublicUrl(fileName);
    await supabase.from('band_fotos').insert([{ album_id: albumId, file_url: data.publicUrl, file_name: fileName }]);
    fetchFotoData();
  };

  const handleTagUser = async (fotoId: string, userId: string) => {
    if (!userId) return;
    const existing = fotoTags.find(t => t.foto_id === fotoId && t.user_id === userId);
    if (existing) return alert('Person ist schon auf dem Bild markiert!');
    await supabase.from('foto_tags').insert([{ foto_id: fotoId, user_id: userId, status: 'offen' }]);
    fetchFotoData();
  };

  const handleSetTagStatus = async (tagId: string, status: 'freigegeben' | 'abgelehnt') => {
    await supabase.from('foto_tags').update({ status }).eq('id', tagId);
    fetchFotoData();
  };

  const handleDeleteFoto = async (fotoId: string, fileName: string) => {
    if (!confirm('Foto wirklich löschen? Alle Markierungen verschwinden mit.')) return;
    await supabase.storage.from('band_fotos').remove([fileName]);
    await supabase.from('foto_tags').delete().eq('foto_id', fotoId);
    await supabase.from('band_fotos').delete().eq('id', fotoId);
    fetchFotoData();
  };

  const fetchFundBalance = async () => {
    const { data, error } = await supabase.from('band_fund').select('balance').eq('id', 1).single();
    if (data && !error) {
      setFundBalance(data.balance);
    }
  };

  const fetchTransactions = async () => {
    const { data } = await supabase.from('band_fund_transactions').select('*').order('created_at', { ascending: false });
    if (data) setTransactions(data);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile.is_admin) return;

    const numValue = parseFloat(transAmount.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) {
      alert('Bitte einen gültigen Betrag größer als 0 eingeben.');
      return;
    }

    setIsSubmittingTrans(true);
    const actualAmount = transType === '+' ? numValue : -numValue;
    const newBalance = fundBalance + actualAmount;

    const { error: balanceError } = await supabase.from('band_fund').update({ balance: newBalance }).eq('id', 1);

    if (!balanceError) {
      const { error: transError } = await supabase.from('band_fund_transactions').insert([
        { amount: numValue, reason: transReason, transaction_type: transType, created_by: session.user.id }
      ]);
      
      if (!transError) {
        setFundBalance(newBalance);
        setTransAmount('');
        setTransReason('');
        fetchTransactions(); 
      } else {
        alert('Fehler beim Speichern des Verlaufs: ' + transError.message);
      }
    } else {
      alert('Fehler beim Aktualisieren des Kassenstands: ' + balanceError.message);
    }
    
    setIsSubmittingTrans(false);
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
  const handleFixedFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fixedName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fileExt = file.name.split('.').pop();
    const exactFileName = `${fixedName}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('band_files')
      .upload(exactFileName, file, { upsert: true });

    if (uploadError) return alert('Fehler beim Upload: ' + uploadError.message);

    const { data } = supabase.storage.from('band_files').getPublicUrl(exactFileName);
    const cacheBusterUrl = `${data.publicUrl}?t=${Date.now()}`;

    const displayTitle = fixedName.replace('_', ' ');
    const { data: existingData } = await supabase.from('band_files').select('id').eq('title', displayTitle).single();

    if (existingData) {
      await supabase.from('band_files').update({ file_name: exactFileName, file_url: cacheBusterUrl }).eq('id', existingData.id);
    } else {
      await supabase.from('band_files').insert([{
        title: displayTitle,
        file_name: exactFileName,
        file_url: cacheBusterUrl,
        created_by: session.user.id
      }]);
    }
    
    fetchBandFiles();
    e.target.value = '';
  };
  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileObj || !uploadFileTitle) return;

    const fileExt = uploadFileObj.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('band_files')
      .upload(fileName, uploadFileObj);

    if (uploadError) {
      alert('Fehler beim Datei-Upload: ' + uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('band_files').getPublicUrl(fileName);
    
    const { error: dbError } = await supabase.from('band_files').insert([{
      title: uploadFileTitle,
      file_name: uploadFileObj.name,
      file_url: publicUrlData.publicUrl,
      created_by: session.user.id
    }]);

    if (dbError) {
      alert('Fehler beim Speichern in der Datenbank: ' + dbError.message);
    } else {
      setUploadFileTitle('');
      setUploadFileObj(null);
      setIsUploadingFile(false);
      fetchBandFiles();
    }
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    if (!confirm('Bist du sicher, dass du diese Datei komplett löschen willst?')) return;
    
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    await supabase.storage.from('band_files').remove([fileName]);

    const { error } = await supabase.from('band_files').delete().eq('id', fileId);
    if (!error) {
      setBandFiles(prev => prev.filter(f => f.id !== fileId));
    } else {
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  const downloadLyricsPdf = (song: any) => {
    if (!song.lyrics) return;
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(`${song.title}`, 10, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`${song.artist || 'Unbekannter Interpret'}`, 10, 30);
    
    if (song.bpm || song.tonart || song.duration) {
      doc.setFontSize(10);
      doc.text(`BPM: ${song.bpm || '-'} | Tonart: ${song.tonart || '-'} | Dauer: ${song.duration || '-'}`, 10, 38);
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    const splitLyrics = doc.splitTextToSize(song.lyrics, 180); 
    doc.text(splitLyrics, 10, 50);
    
    doc.save(`${song.title.replace(/\s+/g, '_')}_Lyrics.pdf`);
  };

  const parseDuration = (dur: string) => {
    if (!dur) return 0;
    const parts = dur.split(':');
    return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  };

  const formatDuration = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatDecimalHours = (val: any) => {
    if (!val) return '';
    const num = parseFloat(val);
    if (isNaN(num)) return '';
    const h = Math.floor(num);
    const m = Math.round((num - h) * 60);
    return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
  };

  const handleAddSong = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const songDataObj = {
      title: songTitle,
      artist: songArtist,
      duration: songDuration, 
      bpm: songBpm,
      tonart: songKey,
      lyrics: songLyrics,
      tab_link: songTabLink,
      cover_url: songCover,
      status: songStatus
    };

    if (editingSongId) {
      const { error } = await supabase.from('songs').update(songDataObj).eq('id', editingSongId);
      if (error) {
        alert('Fehler beim Bearbeiten: ' + error.message);
      } else {
        resetSongForm();
        fetchSongs();
      }
    } else {
      const { error } = await supabase.from('songs').insert([
        { ...songDataObj, created_by: session.user.id }
      ]);
      if (error) {
        alert('Fehler beim Speichern des Songs: ' + error.message);
      } else {
        resetSongForm();
        fetchSongs();
      }
    }
  };

  const startEditSong = (s: any) => {
    setEditingSongId(s.id); 
    setSongCover(s.cover_url || '');
    setSongTitle(s.title); 
    setSongArtist(s.artist || ''); 
    setSongDuration(s.duration || '');
    setSongBpm(s.bpm || '');
    setSongKey(s.tonart || '');
    setSongLyrics(s.lyrics || ''); 
    setSongTabLink(s.tab_link || ''); 
    setIsAddingSong(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedSong(null);
  };

  const resetSongForm = () => {
    setEditingSongId(null); 
    setSongCover('');
    setSongTitle(''); 
    setSongArtist(''); 
    setSongDuration(''); 
    setSongBpm('');
    setSongKey('');
    setSongLyrics(''); 
    setSongTabLink(''); 
    setIsAddingSong(false);
  };

  const handleDeleteSong = async (songId: string) => {
    if (!myProfile.can_manage_events && !myProfile.is_admin) return;
    if (confirm('Bist du sicher, dass du diesen Song löschen möchtest?')) {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (!error) {
        setSongs(prev => prev.filter(s => s.id !== songId));
        if (selectedSong?.id === songId) {
          setSelectedSong(null);
        }
      }
    }
  };

  const openSetlistPlannerForEvent = (ev: any) => {
    setPlanningSetlistEvent(ev);
    setPlanningSetlistTemplate(null);
    const existingData = ev.setlist_data || [{ id: 'set-1', name: 'Set 1', songs: [] }];
    setSetlistData(existingData);
    setActiveSetId(existingData[0].id);
  };

  const openSetlistPlannerForTemplate = (template: any) => {
    setPlanningSetlistTemplate(template);
    setPlanningSetlistEvent(null);
    const existingData = template.setlist_data || [{ id: 'set-1', name: 'Set 1', songs: [] }];
    setSetlistData(existingData);
    setActiveSetId(existingData[0].id);
  };

  const closeSetlistPlanner = () => { 
    setPlanningSetlistEvent(null); 
    setPlanningSetlistTemplate(null);
    setSetlistData([]); 
  };

  const handleSaveSetlist = async () => {
    if (planningSetlistEvent) {
      const { error } = await supabase.from('events').update({ setlist_data: setlistData }).eq('id', planningSetlistEvent.id);
      if (error) alert('Fehler beim Speichern der Setlist: ' + error.message);
      else { alert('Setlist gespeichert!'); fetchEvents(); }
    } else if (planningSetlistTemplate) {
      const { error } = await supabase.from('setlists').update({ setlist_data: setlistData }).eq('id', planningSetlistTemplate.id);
      if (error) alert('Fehler beim Speichern der Vorlage: ' + error.message);
      else { alert('Vorlage gespeichert!'); fetchSetlists(); }
    }
  };
  const toggleSetlistStatus = async (templateId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Final' ? 'In Bearbeitung' : 'Final';
    const { error } = await supabase.from('setlists').update({ status: newStatus }).eq('id', templateId);
    if (error) alert('Fehler beim Status ändern: ' + error.message);
    else fetchSetlists();
  };

  const exportTemplatePdfDirectly = (template: any) => {
    if (!template.setlist_data || template.setlist_data.length === 0) return alert('Setlist ist leer.');
    const doc = new jsPDF();
    doc.setFontSize(22); doc.setTextColor(0, 0, 0);
    doc.text(`Setlist: ${template.title}`, 10, 20);
    let y = 35; let totalSecs = 0;

    template.setlist_data.forEach((set: any) => {
      doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(set.name, 10, y); y += 10;
      let setSecs = 0; doc.setFont("helvetica", "normal");
      
      set.songs.forEach((s: any, idx: number) => {
        doc.setFontSize(14); doc.text(`${idx + 1}. ${s.title} ${s.artist ? `(${s.artist})` : ''}`, 15, y);
        if (s.duration) { doc.text(s.duration, 180, y, { align: 'right' }); setSecs += parseDuration(s.duration); }
        y += 8;
      });
      totalSecs += setSecs; doc.setFontSize(12); doc.setFont("helvetica", "italic"); doc.text(`Dauer ${set.name}: ${formatDuration(setSecs)} Min.`, 15, y + 2);
      y += 15; if (y > 270) { doc.addPage(); y = 20; }
    });
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text(`Gesamte Spielzeit: ${formatDuration(totalSecs)} Min.`, 10, y + 10);
    doc.save(`${template.title.replace(/\s+/g, '_')}.pdf`);
  };
  const handleCreateTemplate = async () => {
    const title = window.prompt('Name der Setlist-Vorlage (z.B. "Standard 2h Programm"):');
    if (!title || title.trim() === '') return;
    
    const { data, error } = await supabase.from('setlists').insert([
      { title: title.trim(), setlist_data: [{ id: 'set-1', name: 'Set 1', songs: [] }], created_by: session.user.id }
    ]).select();
    
    if (!error && data) {
      fetchSetlists();
      openSetlistPlannerForTemplate(data[0]); 
    } else {
      alert('Fehler beim Erstellen der Vorlage: ' + error?.message);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Bist du sicher, dass du diese Vorlage löschen möchtest?')) {
      await supabase.from('setlists').delete().eq('id', id);
      fetchSetlists();
    }
  };

  const loadTemplateIntoEvent = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    if (!templateId) return;
    if (confirm('Achtung: Dies überschreibt die aktuelle Setlist in diesem Event komplett. Fortfahren?')) {
      const template = savedSetlists.find(s => s.id === templateId);
      if (template && template.setlist_data) {
        setSetlistData(template.setlist_data);
        if (template.setlist_data.length > 0) setActiveSetId(template.setlist_data[0].id);
      }
    }
    e.target.value = ''; 
  };

  const addNewSet = () => {
    const newId = `set-${Date.now()}`;
    const newName = window.prompt('Wie soll das Set heißen? (z.B. Zugabe)');
    if (newName && newName.trim() !== '') {
      setSetlistData([...setlistData, { id: newId, name: newName, songs: [] }]);
      setActiveSetId(newId);
    }
  };

  const deleteSet = (setId: string) => {
    if (confirm('Soll dieses Set wirklich gelöscht werden?')) {
      const newData = setlistData.filter(s => s.id !== setId);
      setSetlistData(newData);
      if (activeSetId === setId && newData.length > 0) setActiveSetId(newData[0].id);
    }
  };

  const addSongToActiveSet = (song: any) => {
    if (!activeSetId) return alert('Bitte lege zuerst ein Set an oder wähle eins aus!');
    const setIndex = setlistData.findIndex(s => s.id === activeSetId);
    const newData = [...setlistData];
    newData[setIndex].songs.push({ id: song.id, title: song.title, artist: song.artist, duration: song.duration });
    setSetlistData(newData);
  };

  const removeSongFromSet = (setId: string, songIndex: number) => {
    const setIndex = setlistData.findIndex(s => s.id === setId);
    const newData = [...setlistData];
    newData[setIndex].songs.splice(songIndex, 1);
    setSetlistData(newData);
  };

  const moveSongInSet = (setId: string, songIndex: number, direction: 'up' | 'down') => {
    const setIndex = setlistData.findIndex(s => s.id === setId);
    const newData = [...setlistData];
    const songsList = newData[setIndex].songs;
    
    if (direction === 'up' && songIndex > 0) {
      [songsList[songIndex - 1], songsList[songIndex]] = [songsList[songIndex], songsList[songIndex - 1]];
    } else if (direction === 'down' && songIndex < songsList.length - 1) {
      [songsList[songIndex + 1], songsList[songIndex]] = [songsList[songIndex], songsList[songIndex + 1]];
    }
    setSetlistData(newData);
  };

  const exportSetlistPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    const title = planningSetlistEvent ? `Setlist: ${planningSetlistEvent.title}` : `Setlist: ${planningSetlistTemplate?.title}`;
    doc.text(title, 10, 20);
    
    let y = 35;
    let totalSecs = 0;

    setlistData.forEach(set => {
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(set.name, 10, y);
      y += 10;
      
      let setSecs = 0;
      doc.setFont("helvetica", "normal");
      
      set.songs.forEach((s: any, idx: number) => {
        doc.setFontSize(14);
        doc.text(`${idx + 1}. ${s.title} ${s.artist ? `(${s.artist})` : ''}`, 15, y);
        
        if (s.duration) {
          doc.text(s.duration, 180, y, { align: 'right' });
          setSecs += parseDuration(s.duration);
        }
        y += 8;
      });

      totalSecs += setSecs;
      doc.setFontSize(12);
      doc.setFont("helvetica", "italic");
      doc.text(`Dauer ${set.name}: ${formatDuration(setSecs)} Min.`, 15, y + 2);
      y += 15;

      if (y > 270) { doc.addPage(); y = 20; }
    });

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Gesamte Spielzeit: ${formatDuration(totalSecs)} Min.`, 10, y + 10);
    
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  };

  const calculateTemplateDuration = (data: any[]) => {
    if (!data) return 0;
    return data.reduce((acc, set) => acc + set.songs.reduce((a:number, s:any) => a + parseDuration(s.duration), 0), 0);
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
        alert('Fehler beim Datei-Upload: ' + uploadError.message);
      }
    }

    const eventData = {
      title: eventTitle,
      event_date: eventDate,
      event_time: eventTime,
      location: eventLocation,
      maps_link: eventMapsLink, 
      description: eventDescription,
      event_type: eventType,
      setlist_image: eventType === 'Auftritt' ? finalImageUrl : null, 
      gig_status: eventType === 'Auftritt' ? eventGigStatus : null,
      gage: eventType === 'Auftritt' && eventGage ? parseFloat(eventGage.replace(',', '.')) : null,
      play_time_hours: eventType === 'Auftritt' && eventPlayTime ? parseFloat(eventPlayTime.replace(',', '.')) : null,
      play_time_start: eventType === 'Auftritt' ? eventPlayTimeStart : null,
      play_time_end: eventType === 'Auftritt' ? eventPlayTimeEnd : null,
      soundcheck_time: eventType === 'Auftritt' ? eventSoundcheck : null,
    };

    let savedEventId = editingEventId;

    if (editingEventId) {
      const { error } = await supabase.from('events').update(eventData).eq('id', editingEventId);
      if (error) {
        alert('Fehler beim Bearbeiten: ' + error.message);
        return;
      }
    } else {
      const { data, error } = await supabase.from('events').insert([{ ...eventData, created_by: session.user.id }]).select();
      if (error || !data) {
        alert('Fehler beim Speichern: ' + error?.message);
        return;
      }
      savedEventId = data[0].id;
    }

    if (saveAsDefault) {
      localStorage.setItem('bandPortalDefaults', JSON.stringify({
        eventType,
        eventTime,
        eventLocation
      }));
    } else {
      localStorage.removeItem('bandPortalDefaults'); 
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

    setEditingEventId(null); 
    setIsAddingEvent(false); 
    resetForm(); 
    loadData();
  };

  const handleDeleteEvent = async (eventId: string) => {
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
    setEventMapsLink(ev.maps_link || '');
    setEventDescription(ev.description || ''); 
    setEventType(ev.event_type || 'Probe');
    setEventGigStatus(ev.gig_status || 'Steht fest');
    setEventSetlistImage(ev.setlist_image || '');
    setSetlistFile(null);
    setEventGage(ev.gage ? ev.gage.toString() : '');
    setEventPlayTime(ev.play_time_hours ? ev.play_time_hours.toString() : '');
    setEventPlayTimeStart(ev.play_time_start || '');
    setEventPlayTimeEnd(ev.play_time_end || '');
    setEventSoundcheck(ev.soundcheck_time || '');
    setSaveAsDefault(false);
    setIsAddingEvent(true); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadDefaultsAndOpenForm = () => {
    const defaults = localStorage.getItem('bandPortalDefaults');
    if (defaults) {
      try {
        const parsed = JSON.parse(defaults);
        setEventType(parsed.eventType || 'Probe');
        setEventTime(parsed.eventTime || '');
        setEventLocation(parsed.eventLocation || '');
        setSaveAsDefault(true); 
      } catch(e) {
        setEventType('Probe'); setEventTime(''); setEventLocation(''); setSaveAsDefault(false);
      }
    } else {
      setEventType('Probe');
      setEventTime('');
      setEventLocation('');
      setSaveAsDefault(false);
    }
    setEventTitle('');
    setEventDate(getTodayString()); 
    setEventMapsLink('');
    setEventDescription('');
    setEventGigStatus('Steht fest');
    setEventSetlistImage('');
    setEventGage('');
    setEventPlayTime('');
    setEventPlayTimeStart('');
    setEventPlayTimeEnd('');
    setEventSoundcheck('');
    setSetlistFile(null);
    setEditingEventId(null);
    setIsAddingEvent(true); 
  };

  const loadAbsenceFormDefaults = () => {
    setAbsenceStartDate(getTodayString());
    setAbsenceEndDate(getTodayString());
  }

  const resetForm = () => {
    setEventTitle(''); setEventDate(''); setEventTime(''); setEventLocation(''); setEventMapsLink(''); setEventDescription('');
    setEventType('Probe'); setEventGigStatus('Steht fest'); setEventSetlistImage(''); setSetlistFile(null); setEditingEventId(null); setSaveAsDefault(false);
    setEventGage(''); setEventPlayTime(''); setEventPlayTimeStart(''); setEventPlayTimeEnd(''); setEventSoundcheck('');
    setIsAddingEvent(false); 
  };
  const pokePendingUsers = (eventId: string, pendingCount: number) => {
    if (pendingCount === 0) return alert('Alle haben bereits abgestimmt!');
    // Hier klinkt man später die Supabase Edge Function für echte Push-Mails ein
    alert(`🔔 *BZZZT* Erinnerung erfolgreich an ${pendingCount} noch offene Bandmitglieder versendet!`);
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
    const { error } = await supabase.from('profiles').update({ is_approved: !currentStatus }).eq('id', id);
    if (error) {
      alert('Fehler beim Verifizieren:\n\nDie Datenbank blockiert diese Aktion (' + error.message + ').');
    } else {
      fetchAllProfiles();
    }
  };

  const togglePermission = async (id: string, columnName: string, currentStatus: boolean) => {
    const { error } = await supabase.from('profiles').update({ [columnName]: !currentStatus }).eq('id', id);
    if (error) {
      alert('Fehler beim Ändern der Rechte:\n\n' + error.message);
    } else {
      fetchAllProfiles();
    }
  };

  const handleInstrumentChange = async (userId: string, value: string) => {
    let newInstrument = value === '' ? null : value;
    
    if (value === 'NEW') {
      const input = window.prompt('Welches neue Instrument soll hinzugefügt werden? (z.B. Saxophon)');
      if (!input || input.trim() === '') return; 
      newInstrument = input.trim();
    }

    const { error } = await supabase.from('profiles').update({ instrument: newInstrument }).eq('id', userId);
    if (error) alert('Fehler beim Ändern des Instruments:\n\n' + error.message);
    else fetchAllProfiles(); 
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return alert('Dein Gerät oder Browser unterstützt leider keine Web-Push-Mitteilungen.');
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') alert('Perfekt! Das Handy hat die Erlaubnis gespeichert. Die App kann dir jetzt echte Mitteilungen senden.');
      else alert('Die Berechtigung wurde blockiert oder abgelehnt.');
    } catch (error) {
      console.error('Fehler bei der Berechtigungsanfrage:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', isError: false });
    
    if (isRegister) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setMessage({ text: error.message, isError: true });
      if (data?.user) {
        const combinedName = `${firstName.trim()} ${lastName.trim()}`;
        const { error: profileError } = await supabase.from('profiles').upsert([
          { id: data.user.id, full_name: combinedName, birth_date: birthDate, is_approved: false }
        ]);
        
        if (profileError) return setMessage({ text: profileError.message, isError: true });
        await supabase.auth.signOut();
        setMessage({ text: 'Registrierung erfolgreich! Bitte warte auf die Admin-Freischaltung.', isError: false });
        setIsRegister(false);
        setFirstName(''); setLastName(''); setBirthDate('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMessage({ text: error.message, isError: true });
    }
  };

  const handleLogout = () => { setIsMenuOpen(false); supabase.auth.signOut(); };
  const navigateTo = (view: typeof currentView) => { setCurrentView(view); setIsMenuOpen(false); };

  const getDisplayName = (fullName: string) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    }
    return parts[0];
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

  const isPastEvent = (dateStr: string) => {
    return dateStr < getTodayString();
  };

  const getGroupedEventsByMonth = (eventsToGroup: any[]) => {
    const groups: { [key: string]: any[] } = {};
    eventsToGroup.forEach(ev => {
      const d = new Date(ev.event_date);
      const key = d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return groups;
  };

  const getParsedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
    const months = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];
    return { dayNum: d.getDate(), dayName: days[d.getDay()], monthName: months[d.getMonth()] };
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

  const typeFilteredEvents = events.filter(ev => {
    if (myProfile?.app_rolle === 'Techniker' && ev.event_type !== 'Auftritt') return false;
    return activeFilter === 'all' || ev.event_type === activeFilter;
  });
  const upcomingEventsList = typeFilteredEvents.filter(ev => !isPastEvent(ev.event_date));
  const pastEventsList = typeFilteredEvents.filter(ev => isPastEvent(ev.event_date));
  
  const displayEvents = showPastEvents ? typeFilteredEvents : upcomingEventsList;
  const groupedDisplayEvents = getGroupedEventsByMonth(displayEvents);
  const myPendingEvents = upcomingEventsList.filter(ev => {
    if (ev.event_type === 'Probe' && myProfile?.full_name?.toLowerCase().includes('jonas')) return false;
    return !responses.some(r => r.event_id === ev.id && r.user_id === session?.user?.id);
  });
  const activeMembersCount = allProfiles.filter(p => p.is_approved || p.is_admin).length;
  
  const filteredSongs = songs.filter(s => 
    (s.title || '').toLowerCase().includes((songSearchQuery || '').toLowerCase()) || 
    (s.artist || '').toLowerCase().includes((songSearchQuery || '').toLowerCase())
  );

  const setlistPlannerSongs = songs.filter(s => 
    (s.title || '').toLowerCase().includes((setlistSearchQuery || '').toLowerCase()) || 
    (s.artist || '').toLowerCase().includes((setlistSearchQuery || '').toLowerCase())
  );

  const myOwnAbsences = absences.filter(a => a.user_id === session?.user?.id);
  const pendingRequests = allProfiles.filter(p => !p.is_approved && !p.is_admin);
  const pendingCount = pendingRequests.length;

  const uniqueTitles = Array.from(new Set(events.map(e => e.title).filter(Boolean)));
  const uniqueLocations = Array.from(new Set(events.map(e => e.location).filter(Boolean)));

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] w-full m-0 p-0 bg-gray-950 text-gray-100 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-[16px] text-gray-400 font-bold tracking-wider uppercase animate-pulse">Lade Band-Portal...</p>
        </div>
      </div>
    );
  }

  const calendarGrid = getDaysInMonthGrid();
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  if (session && myProfile) {
    return (
      <div className="h-[100dvh] w-full bg-gray-950 text-gray-100 font-sans relative overflow-x-hidden overflow-y-auto selection:bg-amber-500 selection:text-black m-0 p-0">
        
        {/* --- BILD-ZUSCHNEIDEN OVERLAY --- */}
        {cropImageSrc && (
          <div className="fixed inset-0 bg-black/95 z-[999] flex flex-col items-center justify-center p-4 sm:p-6 backdrop-blur-sm">
            <div className="w-full max-w-xl mb-4 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-white">📸 Profilbild anpassen</h3>
                <p className="text-sm text-gray-400">Verschiebe und zoome das Bild so, wie du es haben willst.</p>
              </div>
            </div>
            
            <div className="relative w-full max-w-xl h-[50vh] sm:h-[60vh] bg-gray-900 rounded-2xl overflow-hidden mb-6 border border-gray-800 shadow-2xl">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1} 
                cropShape="rect"
                showGrid={true}
                onCropChange={setCrop}
                onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="w-full max-w-xl bg-gray-900 p-5 rounded-2xl border border-gray-800 flex flex-col gap-5 shadow-2xl">
               <div>
                 <label className="text-gray-400 text-[12px] font-bold uppercase mb-3 flex justify-between">
                   <span>🔍 Zoomen</span>
                   <span className="text-amber-500">{Math.round(zoom * 100)}%</span>
                 </label>
                 <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-amber-500 h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer" />
               </div>
               <div className="flex gap-3 pt-2">
                  <button onClick={() => { setCropImageSrc(null); setZoom(1); }} className="w-1/3 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl transition-colors text-sm sm:text-[16px]">Abbrechen</button>
                  <button onClick={handleSaveCroppedImage} className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-600/20 text-sm sm:text-[16px]">
                    ✂️ Zuschneiden & Hochladen
                  </button>
               </div>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
          
          <div className="flex justify-between items-center border-b border-gray-900 pb-4 mb-6">
            <div>
              <h1 className="text-xl font-black bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent tracking-tight">Burnin' Bugs</h1>
              <p className="text-sm text-gray-500">Hi, {getDisplayName(myProfile.full_name)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleLogout} className="bg-gray-900 border border-gray-800 text-gray-400 hover:text-white text-sm px-3 py-1.5 rounded-xl transition-colors">Abmelden</button>
              {(myProfile.is_approved || myProfile.is_admin) && (
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-gray-900 border border-gray-800 rounded-xl hover:bg-gray-800 transition-colors z-50 relative flex flex-col justify-center items-center gap-1 w-9 h-9">
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-transform duration-300 ${isMenuOpen ? 'rotate-45 translate-y-1' : ''}`}></span>
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-opacity duration-300 ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                  <span className={`h-0.5 w-4 bg-gray-200 rounded transition-transform duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}></span>
                  
                  {myProfile.is_admin && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse">{pendingCount}</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {isMenuOpen && (
            <div className="fixed inset-0 bg-gray-950/98 backdrop-blur-xl z-40 flex flex-col items-center justify-center p-6 overflow-y-auto">
              <div className="w-full max-w-sm space-y-2">
                {pushPermission !== 'granted' && (
                  <button onClick={requestNotificationPermission} className="w-full text-[16px] font-bold text-emerald-400 bg-emerald-500/10 px-5 py-3 rounded-2xl border border-emerald-500/30 animate-pulse active:scale-95 transition-transform mb-4">
                    🔔 Push-Mitteilungen erlauben
                  </button>
                )}

                <button onClick={() => navigateTo('dashboard')} className={`w-full text-left px-4 py-3 rounded-xl text-xl font-bold transition-colors ${currentView === 'dashboard' ? 'bg-gray-800 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}>🏠 Startseite</button>
                
                {/* Nur für Musiker/Admin/Techniker sichtbar */}
                {myProfile?.app_rolle !== 'Media' && (
                  <>
                    <details className="group bg-gray-900/50 rounded-xl border border-gray-800">
                      <summary className="px-4 py-3 text-xl font-bold text-gray-300 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800 rounded-xl transition-colors">
                        📅 Termine & Orga <span className="text-sm group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="flex flex-col gap-1 p-2 pt-0">
                        <button onClick={() => navigateTo('termine')} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'termine' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Terminübersicht</button>
                        {myProfile?.app_rolle !== 'Techniker' && <button onClick={() => { navigateTo('kalender'); loadAbsenceFormDefaults(); }} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'kalender' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Kalender / Urlaub</button>}
                        {(myProfile?.is_admin || myProfile?.can_view_contacts) && <button onClick={() => { navigateTo('kontakte'); fetchCrmData(); }} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'kontakte' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Kontakte & CRM</button>}
                      </div>
                    </details>

                    {myProfile?.app_rolle !== 'Techniker' && (
                      <details className="group bg-gray-900/50 rounded-xl border border-gray-800">
                        <summary className="px-4 py-3 text-xl font-bold text-gray-300 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800 rounded-xl transition-colors">
                          🎵 Musik & Show <span className="text-sm group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <div className="flex flex-col gap-1 p-2 pt-0">
                          <button onClick={() => navigateTo('songs')} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'songs' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Songs</button>
                          <button onClick={() => navigateTo('setlisten')} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'setlisten' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Setlisten</button>
                        </div>
                      </details>
                    )}

                    <details className="group bg-gray-900/50 rounded-xl border border-gray-800">
                      <summary className="px-4 py-3 text-xl font-bold text-gray-300 cursor-pointer list-none flex justify-between items-center hover:bg-gray-800 rounded-xl transition-colors">
                        📁 Dokumente & Kasse <span className="text-sm group-open:rotate-180 transition-transform">▼</span>
                      </summary>
                      <div className="flex flex-col gap-1 p-2 pt-0">
                        <button onClick={() => navigateTo('dateien')} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'dateien' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Dateien</button>
                        {myProfile?.app_rolle !== 'Techniker' && <button onClick={() => navigateTo('bandkasse')} className={`text-left px-4 py-2 rounded-lg text-lg font-bold ${currentView === 'bandkasse' ? 'text-amber-500 bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Bandkasse</button>}
                      </div>
                    </details>
                  </>
                )}

                {/* Neu: Fotofreigaben (Sichtbar für alle, Media sieht NUR das) */}
                <button onClick={() => navigateTo('fotos')} className={`w-full text-left px-4 py-3 rounded-xl text-xl font-bold transition-colors ${currentView === 'fotos' ? 'bg-gray-800 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}>📸 Fotos & Social Media</button>

                {/* Immer sichtbar */}
                <button onClick={() => navigateTo('profil')} className={`w-full text-left px-4 py-3 rounded-xl text-xl font-bold transition-colors ${currentView === 'profil' ? 'bg-gray-800 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}>👤 Mein Profil</button>
                
                {myProfile.is_admin && (
                  <button onClick={() => navigateTo('verwaltung')} className={`w-full text-left px-4 py-3 rounded-xl text-xl font-bold transition-colors flex justify-between items-center ${currentView === 'verwaltung' ? 'bg-gray-800 text-amber-500' : 'text-gray-300 hover:bg-gray-800'}`}>
                    <span>🛡️ Verwaltung</span>
                    {pendingCount > 0 && <span className="bg-red-500 text-white text-sm px-2.5 py-0.5 rounded-full shadow-lg">{pendingCount} Neu</span>}
                  </button>
                )}
              </div>
            </div>
          )}

          {(planningSetlistEvent || planningSetlistTemplate) && (
            <div className="fixed inset-0 bg-gray-950 z-50 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shrink-0 flex-wrap gap-3">
                <div>
                  <h2 className="font-black text-amber-500 text-lg sm:text-xl">
                    {planningSetlistEvent ? `Setlist: ${planningSetlistEvent.title}` : `Vorlage: ${planningSetlistTemplate?.title}`}
                  </h2>
                  <p className="text-[12px] text-gray-400">Drag & Drop per Pfeil-Buttons</p>
                </div>
                
                <div className="flex gap-2 items-center">
                  {planningSetlistEvent && savedSetlists.length > 0 && (
                    <select onChange={loadTemplateIntoEvent} className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-2 py-2 focus:outline-none cursor-pointer">
                      <option value="">Vorlagen laden...</option>
                      {savedSetlists.map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={handleSaveSetlist} className="bg-emerald-600 font-bold text-white px-4 py-2 rounded-lg text-sm transition-colors hover:bg-emerald-700">💾 Speichern</button>
                  <button onClick={closeSetlistPlanner} className="bg-gray-800 text-gray-300 font-bold px-4 py-2 rounded-lg text-sm border border-gray-700 hover:bg-gray-700">X</button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                <div className="w-full md:w-1/3 bg-gray-900/50 border-r border-gray-800 flex flex-col h-1/2 md:h-full">
                  <div className="p-4 border-b border-gray-800 shrink-0">
                    <input type="text" value={setlistSearchQuery} onChange={(e) => setSetlistSearchQuery(e.target.value)} placeholder="🔍 Song suchen..." className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white" />
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {setlistPlannerSongs.map(song => (
                      <div key={song.id} className="bg-gray-950 border border-gray-800 p-2 rounded-lg flex justify-between items-center group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-200 truncate">{song.title}</p>
                          <p className="text-[10px] text-gray-500">{song.duration ? `⏱ ${song.duration}` : 'Keine Zeit'}</p>
                        </div>
                        <button onClick={() => addSongToActiveSet(song)} className="ml-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[12px] font-bold shrink-0 hover:bg-amber-500 hover:text-gray-950 transition-colors">
                          + Hinzufügen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full md:w-2/3 flex-1 overflow-y-auto p-4 bg-gray-950 space-y-6 h-1/2 md:h-full">
                  <div className="flex gap-2 flex-wrap mb-4">
                    <button onClick={addNewSet} className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-bold border border-gray-700 hover:bg-gray-700 transition-colors">+ Neues Set</button>
                    <button onClick={exportSetlistPdf} className="bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-blue-500/30 hover:bg-blue-500/20 transition-colors">📄 PDF Export</button>
                  </div>

                  {setlistData.map(set => {
                    const isActive = activeSetId === set.id;
                    const setTotalSecs = set.songs.reduce((acc: number, s: any) => acc + parseDuration(s.duration), 0);

                    return (
                      <div key={set.id} onClick={() => setActiveSetId(set.id)} className={`p-4 rounded-xl border-2 transition-colors ${isActive ? 'border-amber-500 bg-amber-500/[0.02]' : 'border-gray-800 bg-gray-900/40 cursor-pointer'}`}>
                        <div className="flex justify-between items-center mb-4 border-b border-gray-800/50 pb-2">
                          <h3 className="font-black text-lg text-white flex items-center gap-2">
                            {isActive && <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>}
                            {set.name}
                          </h3>
                          <div className="flex gap-3 items-center">
                            <span className="text-sm font-bold text-gray-400">Dauer: <span className="text-amber-400">{formatDuration(setTotalSecs)} Min</span></span>
                            <button onClick={(e) => { e.stopPropagation(); deleteSet(set.id); }} className="text-red-400 text-[12px] bg-red-500/10 px-2 py-1 rounded hover:bg-red-500/20 transition-colors">Löschen</button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {set.songs.length === 0 && <p className="text-sm text-gray-600 italic pb-2">Set ist leer. Wähle links einen Song aus (+).</p>}
                          {set.songs.map((song: any, index: number) => (
                            <div key={`${song.id}-${index}`} className="flex items-center gap-2 bg-gray-950 border border-gray-800 p-2 rounded-lg group">
                              <span className="text-gray-500 font-black text-sm w-5 text-right shrink-0">{index + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-200 truncate">{song.title}</p>
                              </div>
                              <span className="text-[12px] font-mono text-gray-400 mx-2 shrink-0">{song.duration || '--:--'}</span>
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveSongInSet(set.id, index, 'up'); }} className="text-gray-400 hover:text-white disabled:opacity-30 p-0.5 leading-none transition-colors">▲</button>
                                <button disabled={index === set.songs.length - 1} onClick={(e) => { e.stopPropagation(); moveSongInSet(set.id, index, 'down'); }} className="text-gray-400 hover:text-white disabled:opacity-30 p-0.5 leading-none transition-colors">▼</button>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); removeSongFromSet(set.id, index); }} className="text-red-500 font-black ml-2 px-2 hover:scale-110 transition-transform shrink-0">✕</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-4 mt-4 border-t border-gray-800 text-right pb-10 md:pb-0">
                    <p className="font-black text-gray-300">Gesamte Spielzeit: <span className="text-amber-500 text-xl">{formatDuration(setlistData.reduce((acc, set) => acc + set.songs.reduce((a:number, s:any) => a + parseDuration(s.duration), 0), 0))} Min</span></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedSetlistImage && (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-3xl max-h-[90dvh] max-w-[95vw] rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-center border-b border-gray-800 pb-3 mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">📜 Anhang Vorschau</h3>
                  <button onClick={() => setSelectedSetlistImage(null)} className="p-1 bg-gray-950 border border-gray-800 rounded-lg text-sm font-bold px-3 py-1.5 text-gray-400 hover:text-white">Schließen</button>
                </div>
                <div className="overflow-y-auto flex-1 flex items-center justify-center">
                  {selectedSetlistImage.toLowerCase().endsWith('.pdf') ? (
                    <iframe src={selectedSetlistImage} width="100%" height="500px" className="border border-gray-700 rounded-xl bg-white w-full" title="PDF Vorschau" />
                  ) : (
                    <img src={selectedSetlistImage} alt="Anhang" className="max-w-full h-auto object-contain rounded-xl border border-gray-800 shadow-inner" />
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedSong && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl max-h-[90dvh] max-w-[95vw] rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex justify-between items-start border-b border-gray-800 pb-3 mb-4 shrink-0">
                  <div className="flex gap-4 items-center">
                    {selectedSong.cover_url && (
                      <img src={selectedSong.cover_url} alt="Cover" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shadow-lg object-cover" />
                    )}
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-white">{selectedSong.title}</h3>
                      <p className="text-sm text-amber-500 font-semibold">{selectedSong.artist || 'Unbekannter Interpret'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSong(null)} className="p-1 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm font-bold px-3 py-1.5 shrink-0">Schließen</button>
                </div>

                <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                  
                  <div className="flex gap-2 flex-wrap text-sm font-bold">
                    {selectedSong.duration && <span className="bg-gray-950 border border-gray-800 text-gray-300 px-3 py-1.5 rounded-lg font-mono">⏱ {selectedSong.duration}</span>}
                    
                    {/* METRONOM BUTTON */}
                    {selectedSong.bpm && (
                      <button onClick={() => toggleMetronome(selectedSong.bpm)} className={`px-3 py-1.5 rounded-lg font-mono transition-colors ${isMetronomePlaying ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'}`}>
                        {isMetronomePlaying ? '⏹ Metronom Stop' : `▶️ ${selectedSong.bpm} BPM`}
                      </button>
                    )}

                    {selectedSong.tonart && <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg">{selectedSong.tonart}</span>}
                  </div>

                  {/* LIVE BÜHNENMODUS BUTTON */}
                  <button onClick={() => setIsLiveMode(true)} className="bg-amber-500 text-gray-950 px-4 py-3 rounded-xl font-black text-[16px] hover:bg-amber-600 transition-colors w-full flex items-center justify-center gap-2 shadow-lg mt-4 mb-4">
                    🎤 Live-Bühnenmodus starten
                  </button>

                  {/* PRIVATE NOTIZEN */}
                  <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl mb-4">
                    <h4 className="text-[12px] font-black text-amber-500 uppercase tracking-widest mb-2">🔒 Meine privaten Notizen</h4>
                    <textarea value={songNotes[selectedSong.id] || ''} onChange={(e) => handleSaveNote(selectedSong.id, e.target.value)} placeholder="Einsätze, Effekte, Erinnerungen... (nur für dich sichtbar)" rows={3} className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-amber-500 resize-none" />
                  </div>

                  {selectedSong.tab_link && (
                    <div className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-300">Gitarren Tabs:</span>
                      <a href={selectedSong.tab_link} target="_blank" rel="noopener noreferrer" className="text-sm bg-amber-500 text-gray-950 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors">🌐 Tab öffnen</a>
                    </div>
                  )}

                  <div className="bg-gray-950 border border-gray-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-[12px] font-black text-gray-400 uppercase tracking-widest">📜 Songtext</h4>
                      {selectedSong.lyrics && (
                        <button type="button" onClick={() => downloadLyricsPdf(selectedSong)} className="bg-gray-800 border border-gray-700 text-gray-200 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-1.5">⬇️ Text als PDF laden</button>
                      )}
                    </div>
                    <p className="text-[16px] text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{selectedSong.lyrics || 'Kein Songtext hinterlegt.'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedDayDetails && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 border border-gray-800 w-full max-w-md max-h-[90dvh] max-w-[95vw] rounded-2xl p-6 shadow-2xl flex flex-col overflow-hidden">
                <div className="flex justify-between items-start border-b border-gray-800 pb-3 mb-4 shrink-0">
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Tagesdetails</h3>
                    <p className="text-[16px] font-black text-white mt-0.5">{selectedDayDetails.dayLabel}</p>
                  </div>
                  <button onClick={() => setSelectedDayDetails(null)} className="p-1 bg-gray-950 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm font-bold px-2.5 py-1 shrink-0">Schließen</button>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                  <div>
                    <h4 className="text-[12px] font-black text-blue-400 uppercase tracking-widest mb-1.5">🎵 Termine & Gigs</h4>
                    {selectedDayDetails.events.length === 0 ? (
                      <p className="text-sm text-gray-600 italic">Keine Termine an diesem Tag.</p>
                    ) : (
                      selectedDayDetails.events.map(e => (
                        <div key={e.id} className="bg-gray-950 border border-gray-850 p-2.5 rounded-xl text-sm space-y-1 mb-2">
                          <div className="flex justify-between font-bold text-gray-200">
                            <span>{e.title}</span>
                            <span className="text-blue-400 uppercase text-[10px] border border-blue-500/20 bg-blue-500/5 px-1.5 rounded">{e.event_type}</span>
                          </div>
                          <div className="text-gray-400 text-[12px]">🕒 Uhrzeit: {e.event_time.substring(0,5)} Uhr</div>
                          {e.location && <div className="text-gray-500 text-[12px]">📍 Ort: {e.location}</div>}
                          <div className="pt-1.5 border-t border-gray-800/60 mt-2">
                            <button type="button" onClick={() => handleDeleteEvent(e.id)} className="text-[12px] text-red-400 hover:underline">🗑️ Aus diesem Tag löschen</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentView === 'dateien' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-300">📁 Dateien & Dokumente</h2>
                <button onClick={() => setIsUploadingFile(!isUploadingFile)} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-bold px-3 py-2 rounded-xl transition-transform active:scale-95">
                  {isUploadingFile ? 'Schließen' : '+ Datei hochladen'}
                </button>
              </div>

              {isUploadingFile && (
                <form onSubmit={handleFileUploadSubmit} className="bg-gray-900/90 border border-amber-500/20 p-5 rounded-2xl space-y-4 shadow-lg">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Bezeichnung / Titel</label>
                      <input type="text" value={uploadFileTitle} onChange={(e) => setUploadFileTitle(e.target.value)} placeholder="z.B. Band Logos (ZIP)" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Datei auswählen</label>
                      <input type="file" onChange={(e) => setUploadFileObj(e.target.files?.[0] || null)} className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 cursor-pointer" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[16px] rounded-xl py-2.5 transition-colors">Hochladen & Speichern</button>
                </form>
              )}
{/* --- VIP BEREICH FÜR FESTE DATEIEN --- */}
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                
                {/* Kachel: Tech Rider */}
                <div className="bg-purple-950/20 border border-purple-500/30 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                  <div>
                    <h3 className="text-[16px] font-black text-purple-400 uppercase tracking-wider mb-1">Tech Rider</h3>
                    <p className="text-[12px] text-gray-400">Fester Link für Veranstalter</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {bandFiles.find(f => f.title === 'Tech Rider') ? (
                      <a href={bandFiles.find(f => f.title === 'Tech Rider')?.file_url} target="_blank" rel="noopener noreferrer" className="bg-purple-500/10 text-purple-400 border border-purple-500/30 px-3 py-2 rounded-xl text-sm font-bold hover:bg-purple-500/20 text-center flex-1">Ansehen</a>
                    ) : (
                      <span className="text-gray-600 italic text-sm flex-1 py-2 text-center border border-dashed border-gray-800 rounded-xl">Fehlt noch</span>
                    )}
                    <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors border border-gray-700 text-center">
                      🔄 Update
                      <input type="file" accept=".pdf" className="hidden" onChange={(e) => handleFixedFileUpload(e, 'Tech_Rider')} />
                    </label>
                  </div>
                </div>

                {/* Kachel: Presse Kit */}
                <div className="bg-blue-950/20 border border-blue-500/30 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                  <div>
                    <h3 className="text-[16px] font-black text-blue-400 uppercase tracking-wider mb-1">Presse Kit</h3>
                    <p className="text-[12px] text-gray-400">Fotos & Bio für Veranstalter</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {bandFiles.find(f => f.title === 'Presse Kit') ? (
                      <a href={bandFiles.find(f => f.title === 'Presse Kit')?.file_url} target="_blank" rel="noopener noreferrer" className="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-xl text-sm font-bold hover:bg-blue-500/20 text-center flex-1">Laden</a>
                    ) : (
                      <span className="text-gray-600 italic text-sm flex-1 py-2 text-center border border-dashed border-gray-800 rounded-xl">Fehlt noch</span>
                    )}
                    <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors border border-gray-700 text-center">
                      🔄 Update
                      <input type="file" accept=".zip,.pdf,.jpg,.png" className="hidden" onChange={(e) => handleFixedFileUpload(e, 'Presse_Kit')} />
                    </label>
                  </div>
                </div>

                {/* Kachel: Band Logos */}
                <div className="bg-amber-950/20 border border-amber-500/30 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                  <div>
                    <h3 className="text-[16px] font-black text-amber-500 uppercase tracking-wider mb-1">Band Logos</h3>
                    <p className="text-[12px] text-gray-400">Festes Archiv für Plakate</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {bandFiles.find(f => f.title === 'Band Logos') ? (
                      <a href={bandFiles.find(f => f.title === 'Band Logos')?.file_url} target="_blank" rel="noopener noreferrer" className="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-2 rounded-xl text-sm font-bold hover:bg-amber-500/20 text-center flex-1">Laden</a>
                    ) : (
                      <span className="text-gray-600 italic text-sm flex-1 py-2 text-center border border-dashed border-gray-800 rounded-xl">Fehlt noch</span>
                    )}
                    <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors border border-gray-700 text-center">
                      🔄 Update
                      <input type="file" accept=".zip,.png,.jpg,.pdf" className="hidden" onChange={(e) => handleFixedFileUpload(e, 'Band_Logos')} />
                    </label>
                  </div>
                </div>
                
              </div>
              <div className="relative">
                <input type="text" value={fileSearchQuery} onChange={(e) => setFileSearchQuery(e.target.value)} placeholder="🔍 Nach Dateititel suchen..." className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bandFiles.filter(f => f.title.toLowerCase().includes(fileSearchQuery.toLowerCase())).length === 0 ? (
                  <p className="text-sm text-gray-500 italic col-span-2">Keine Dateien gefunden.</p>
                ) : (
                  bandFiles.filter(f => f.title.toLowerCase().includes(fileSearchQuery.toLowerCase())).map(file => (
                    <div key={file.id} className="bg-gray-900/40 border border-gray-800 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                      <div className="mb-3">
                        <h3 className="text-[16px] font-bold text-gray-100">{file.title}</h3>
                        <p className="text-[10px] text-gray-500 font-mono mt-1 truncate">{file.file_name}</p>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-800/60">
                        <a href={file.file_url} target="_blank" rel="noopener noreferrer" download className="text-[12px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors font-bold">⬇️ Herunterladen</a>
                        
                        {(myProfile.can_manage_events || myProfile.is_admin || file.created_by === session.user.id) && (
                          <button onClick={() => handleDeleteFile(file.id, file.file_url)} className="text-[12px] bg-red-500/10 text-red-400 px-2.5 py-1.5 rounded hover:bg-red-500/20 transition-colors">🗑️ Löschen</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {currentView === 'setlisten' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-300">📋 Setlist-Vorlagen</h2>
                <button onClick={handleCreateTemplate} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-bold px-3 py-2 rounded-xl transition-transform active:scale-95">
                  + Neue Vorlage
                </button>
              </div>

              <div className="relative mb-4">
                <input type="text" value={setlistOverviewSearchQuery} onChange={(e) => setSetlistOverviewSearchQuery(e.target.value)} placeholder="🔍 Nach Setlist-Name suchen..." className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-sm" />
              </div>

              {savedSetlists.length === 0 ? (
                <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl text-center">
                  <p className="text-gray-400 mb-2">Ihr habt noch keine Vorlagen erstellt.</p>
                  <p className="text-sm text-gray-500">Erstelle eine Standard-Setlist, um sie später bei Auftritten mit einem Klick zu laden!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {savedSetlists.filter(s => s.title.toLowerCase().includes(setlistOverviewSearchQuery.toLowerCase())).map(template => {
                    const totalSecs = calculateTemplateDuration(template.setlist_data);
                    
                    return (
                      <div key={template.id} className="bg-gray-900/40 border border-gray-800 p-4 rounded-xl flex flex-col justify-between shadow-sm">
                        <div className="mb-4 border-b border-gray-800 pb-3">
                          <div className="flex justify-between items-start mb-2 gap-2">
                            <h3 className="text-[16px] font-bold text-gray-100">{template.title}</h3>
                            <button 
                              onClick={() => myProfile?.app_rolle !== 'Techniker' && toggleSetlistStatus(template.id, template.status)} 
                              className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border shrink-0 transition-colors ${template.status === 'Final' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'} ${myProfile?.app_rolle === 'Techniker' ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {template.status === 'Final' ? '🟢 Final' : '🟡 In Bearbeitung'}
                            </button>
                          </div>
                          <div className="flex gap-3 text-[12px] text-gray-400">
                            <span className="bg-gray-800 px-2 py-0.5 rounded">Sets: {template.setlist_data?.length || 0}</span>
                            <span className="bg-gray-800 px-2 py-0.5 rounded text-amber-500 font-mono">Dauer: {formatDuration(totalSecs)} Min</span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button onClick={() => exportTemplatePdfDirectly(template)} className="text-[12px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors font-bold">📄 PDF</button>
                          <button onClick={() => startSetlistLiveMode(template)} className="text-[12px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors font-bold">🎤 Live</button>
                          
                          {myProfile?.app_rolle !== 'Techniker' && (
                            <>
                              <button onClick={() => openSetlistPlannerForTemplate(template)} className="text-[12px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors font-bold">✏️ Bearbeiten</button>
                              <button onClick={() => handleDeleteTemplate(template.id)} className="text-[12px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">🗑️ Löschen</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

{currentView === 'songs' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-300">🎵 Song-Repertoire ({songs.length})</h2>
                <div className="flex gap-2">
                  {(myProfile?.is_admin || myProfile?.can_mass_update) && (
                    <button 
                      onClick={bulkUpdateAllSongs} 
                      disabled={isFetchingSongData}
                      className="bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 text-sm font-bold px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {isFetchingSongData ? '⏳ Aktualisiere...' : '✨ Alle Songs updaten'}
                    </button>
                  )}
                  <button onClick={() => { if(isAddingSong) resetSongForm(); else setIsAddingSong(true); }} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-bold px-3 py-2 rounded-xl transition-transform active:scale-95">
                    {isAddingSong ? 'Schließen' : '+ Song hinzufügen'}
                  </button>
                </div>
              </div>

              {isAddingSong && (
                <form onSubmit={handleAddSong} className="bg-gray-900/90 border border-amber-500/20 p-5 rounded-2xl space-y-4 shadow-lg">
                  <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                    <h3 className="font-bold text-amber-500 text-sm uppercase">{editingSongId ? '✏️ Song bearbeiten' : '➕ Neuen Song anlegen'}</h3>
                    <button 
                      type="button" 
                      onClick={autoFillSongData}
                      disabled={isFetchingSongData}
                      className="bg-[#1DB954]/20 border border-[#1DB954]/50 text-[#1DB954] hover:bg-[#1DB954]/30 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isFetchingSongData ? '⏳ Suche läuft...' : '✨ Spotify Autofill'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Songtitel</label>
                      <input type="text" value={songTitle} onChange={(e) => setSongTitle(e.target.value)} placeholder="z.B. Knockin' on Heaven's Door" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Interpret</label>
                      <input type="text" value={songArtist} onChange={(e) => setSongArtist(e.target.value)} placeholder="z.B. Bob Dylan" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Dauer (MM:SS)</label>
                      <input type="text" value={songDuration} onChange={(e) => setSongDuration(e.target.value)} placeholder="03:25" pattern="[0-9]{1,2}:[0-5][0-9]" title="Bitte im Format MM:SS eingeben (z.B. 03:25)" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">BPM</label>
                      <div className="flex gap-2">
                        <input type="text" value={songBpm} onChange={(e) => setSongBpm(e.target.value)} placeholder="120" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500 font-mono" />
                        <button type="button" onClick={handleTapTempo} className="bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 px-3 py-2 rounded-xl font-bold transition-colors shrink-0 shadow-sm active:scale-95" title="Klicke hier mehrmals im Takt">
                          👆 Tap
                        </button>
                      </div>
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Tonart</label>
                      <input type="text" value={songKey} onChange={(e) => setSongKey(e.target.value)} placeholder="z.B. C-Dur / Am" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Link für Gitarren Tabs</label>
                      <input type="url" value={songTabLink} onChange={(e) => setSongTabLink(e.target.value)} placeholder="https://www.ultimate-guitar.com/..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Songtext (Lyrics)</label>
                      <textarea value={songLyrics} onChange={(e) => setSongLyrics(e.target.value)} placeholder="Strophe 1..." rows={6} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500 resize-none" />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[16px] rounded-xl py-2.5 transition-colors">{editingSongId ? 'Änderungen speichern' : 'Song speichern'}</button>
                </form>
              )}

<div className="relative mb-6">
                <input type="text" value={songSearchQuery} onChange={(e) => setSongSearchQuery(e.target.value)} placeholder="🔍 Nach Songtitel oder Interpret suchen..." className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-sm" />
              </div>

              {/* SCHLICHTE SLIDER-NAVIGATION WIE BEI DEN TERMINEN */}
              <div className="relative bg-gray-900/80 p-1 rounded-xl flex border border-gray-800/60 max-w-xl mb-6">
                <div className="absolute top-1 bottom-1 bg-gray-800 border border-gray-700/50 rounded-lg shadow transition-all duration-300" style={{ left: songFilter === 'Alle' ? '4px' : songFilter === 'Vorschläge' ? '25%' : songFilter === 'am Proben' ? '50%' : '75%', width: 'calc(25% - 6px)' }} />
                <button onClick={() => setSongFilter('Alle')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${songFilter === 'Alle' ? 'text-white' : 'text-gray-400'}`}>Alle</button>
                <button onClick={() => setSongFilter('Vorschläge')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${songFilter === 'Vorschläge' ? 'text-white' : 'text-gray-400'}`}>Vorschläge</button>
                <button onClick={() => setSongFilter('am Proben')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${songFilter === 'am Proben' ? 'text-white' : 'text-gray-400'}`}>Am Proben</button>
                <button onClick={() => setSongFilter('Fertig')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${songFilter === 'Fertig' ? 'text-white' : 'text-gray-400'}`}>Fertig</button>
              </div>
                
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredSongs.filter(s => songFilter === 'Alle' || (s.status || 'Vorschläge') === songFilter).length === 0 ? (
                  <p className="text-sm text-gray-500 italic col-span-2 bg-gray-900/50 border border-dashed border-gray-800 p-6 rounded-xl text-center">In dieser Kategorie gibt es noch keine Songs.</p>
                ) : (
                  
                  filteredSongs.filter(s => songFilter === 'Alle' || (s.status || 'Vorschläge') === songFilter).map(song => (
                    <div key={song.id} className="bg-gray-900/40 border border-gray-800 hover:border-gray-700 p-4 rounded-xl transition-all shadow-sm flex flex-col justify-between group">
                      <div onClick={() => setSelectedSong(song)} className="cursor-pointer flex gap-3">
                        {song.cover_url ? (
                          <img src={song.cover_url} alt="Cover" className="w-12 h-12 rounded-lg object-cover shadow-sm shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center text-xl shrink-0">🎵</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <h3 className="text-[16px] font-bold text-gray-100 group-hover:text-amber-400 transition-colors truncate">{song.title}</h3>
                            <div className="flex gap-1 text-[10px] font-bold flex-wrap justify-end shrink-0 pl-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleSongStatus(song.id, song.status || 'Vorschläge'); }} 
                                className="hover:scale-105 transition-transform cursor-pointer"
                                title="Klicken, um den Status zu ändern"
                              >
                                {(!song.status || song.status === 'Vorschläge') && <span className="bg-gray-800 text-gray-300 border border-gray-700 px-1.5 py-0.5 rounded block">💡 Vorschlag</span>}
                                {song.status === 'am Proben' && <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded block">🚧 Proben</span>}
                                {song.status === 'Fertig' && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded block">✅ Fertig</span>}
                              </button>
                              
                              {song.duration && <span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-mono">⏱ {song.duration}</span>}
                              {song.bpm && <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono">{song.bpm} BPM</span>}
                            </div>
                          </div>
                          <p className="text-sm text-gray-400 mt-0.5">{song.artist || 'Unbekannter Interpret'}</p>
                        </div>
                      </div>
                      
                      {(myProfile.can_manage_events || myProfile.is_admin) && (
                         <div className="mt-3 pt-2 border-t border-gray-800/60 flex justify-end gap-2">
                           <button onClick={() => startEditSong(song)} className="text-[12px] bg-gray-800 text-gray-300 px-2.5 py-1 rounded hover:bg-gray-700 transition-colors">✏️ Bearbeiten</button>
                           <button onClick={() => handleDeleteSong(song.id)} className="text-[12px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded hover:bg-red-500/20 transition-colors">🗑️ Löschen</button>
                         </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* VIEW: CRM / KONTAKTE */}
          {currentView === 'kontakte' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-black text-white">Veranstalter & Kontakte</h2>
                <button 
                  onClick={() => setIsAddingVeranstalter(!isAddingVeranstalter)} 
                  className="bg-amber-500 hover:bg-amber-600 text-gray-950 px-4 py-2 rounded-xl font-bold transition-colors active:scale-95"
                >
                  {isAddingVeranstalter ? 'Schließen' : '+ Veranstalter'}
                </button>
              </div>

              {/* Veranstalter Form */}
              {isAddingVeranstalter && (
                <form onSubmit={handleSaveVeranstalter} className="bg-gray-900/90 border border-amber-500/20 p-5 rounded-2xl space-y-4 shadow-lg">
                  <h3 className="font-bold text-amber-500 text-sm uppercase mb-2">🏢 Neuen Veranstalter anlegen</h3>
                  <div>
                    <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Name des Veranstalters</label>
                    <input type="text" value={newVeranstalterName} onChange={(e) => setNewVeranstalterName(e.target.value)} placeholder="z.B. Stadtfest Köln" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[16px] rounded-xl py-2.5 transition-colors">Speichern</button>
                </form>
              )}

              <input 
                type="text" 
                value={crmSearch} 
                onChange={(e) => setCrmSearch(e.target.value)} 
                placeholder="🔍 Nach Veranstalter suchen..." 
                className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-white focus:border-amber-500 outline-none transition-colors" 
              />

              <div className="space-y-4">
                {veranstalter.filter(v => v.name.toLowerCase().includes(crmSearch.toLowerCase())).map(v => (
                  <div key={v.id} className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 hover:bg-gray-800/50 transition-colors border-b border-gray-800/50">
                      {editingVeranstalterId === v.id ? (
                        <form onSubmit={(e) => handleUpdateVeranstalter(e, v.id)} className="flex-1 flex gap-2">
                          <input type="text" value={newVeranstalterName} onChange={(e) => setNewVeranstalterName(e.target.value)} className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500" autoFocus />
                          <button type="submit" className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold">OK</button>
                          <button type="button" onClick={() => setEditingVeranstalterId(null)} className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-bold">X</button>
                        </form>
                      ) : (
                        <>
                          <div className="flex-1 flex justify-between items-center cursor-pointer" onClick={() => setExpandedVeranstalter(expandedVeranstalter === v.id ? null : v.id)}>
                            <h3 className="text-lg font-bold text-gray-100">{v.name}</h3>
                            <span className="text-gray-500 sm:hidden">{expandedVeranstalter === v.id ? '▼' : '▶'}</span>
                          </div>
                          
                          {myProfile?.is_admin && expandedVeranstalter === v.id && (
                            <div className="flex gap-2 shrink-0">
                              <button onClick={() => { setEditingVeranstalterId(v.id); setNewVeranstalterName(v.name); }} className="text-[12px] bg-gray-800 text-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">✏️ Edit</button>
                              <button onClick={() => handleDeleteVeranstalter(v.id)} className="text-[12px] bg-red-500/10 text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors">🗑️ Löschen</button>
                            </div>
                          )}
                          <span className="text-gray-500 hidden sm:block cursor-pointer" onClick={() => setExpandedVeranstalter(expandedVeranstalter === v.id ? null : v.id)}>{expandedVeranstalter === v.id ? '▼' : '▶'}</span>
                        </>
                      )}
                    </div>

                    {expandedVeranstalter === v.id && (
                      <div className="p-4 border-t border-gray-800 bg-gray-950/50">
                        
                        <div className="flex justify-end mb-4">
                          <button 
                            onClick={() => setAddingKontaktFor(addingKontaktFor === v.id ? null : v.id)} 
                            className="text-[12px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-500/20 transition-colors"
                          >
                            {addingKontaktFor === v.id ? 'Abbrechen' : '+ Kontakt hinzufügen'}
                          </button>
                        </div>

                        {addingKontaktFor === v.id && (
                          <form onSubmit={(e) => handleSaveKontakt(e, v.id)} className="bg-gray-900/90 border border-emerald-500/20 p-4 rounded-xl space-y-4 mb-4 shadow-lg">
                             <h4 className="font-bold text-emerald-500 text-sm uppercase">👤 Neuen Kontakt eintragen</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                               <div>
                                
                                 <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Name</label>
                                 <input type="text" value={newKontaktName} onChange={(e) => setNewKontaktName(e.target.value)} placeholder="Max Mustermann" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[14px] text-white focus:outline-none focus:border-emerald-500" required />
                               </div>
                               <div>
                                 <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Kategorie / Rolle</label>
                                 <input type="text" value={newKontaktKategorie} onChange={(e) => setNewKontaktKategorie(e.target.value)} placeholder="z.B. Booking, Technik..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[14px] text-white focus:outline-none focus:border-emerald-500" required />
                               </div>
                               <div>
                                 <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Telefon</label>
                                 <input type="tel" value={newKontaktTelefon} onChange={(e) => setNewKontaktTelefon(e.target.value)} placeholder="+49..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[14px] text-white focus:outline-none focus:border-emerald-500" />
                               </div>
                               <div>
                                 <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">E-Mail</label>
                                 <input type="email" value={newKontaktEmail} onChange={(e) => setNewKontaktEmail(e.target.value)} placeholder="mail@..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[14px] text-white focus:outline-none focus:border-emerald-500" />
                               </div>
                             </div>
                             <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl py-2.5 transition-colors">Kontakt speichern</button>
                          </form>
                        )}

<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ansprechpartner.filter(a => a.veranstalter_id === v.id).map(a => (
                            <div key={a.id} className="bg-gray-900 border border-gray-800 p-3 rounded-lg flex flex-col gap-2 shadow-inner min-h-[100px]">
                              {editingKontaktId === a.id ? (
                                <form onSubmit={handleUpdateKontakt} className="space-y-2 flex flex-col h-full justify-between">
                                   <div>
                                     <input type="text" value={editKontaktName} onChange={(e) => setEditKontaktName(e.target.value)} placeholder="Name" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-amber-500 mb-1" required />
                                     <input type="text" value={editKontaktKategorie} onChange={(e) => setEditKontaktKategorie(e.target.value)} placeholder="Kategorie" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-amber-500 mb-1" required />
                                     <input type="tel" value={editKontaktTelefon} onChange={(e) => setEditKontaktTelefon(e.target.value)} placeholder="Telefon" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-amber-500 mb-1" />
                                     <input type="email" value={editKontaktEmail} onChange={(e) => setEditKontaktEmail(e.target.value)} placeholder="E-Mail" className="w-full bg-gray-950 border border-gray-700 rounded px-2 py-1 text-sm text-white focus:border-amber-500" />
                                   </div>
                                   <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-gray-800/60">
                                     <button type="button" onClick={() => setEditingKontaktId(null)} className="text-[12px] bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-700">Abbrechen</button>
                                     <button type="submit" className="text-[12px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold">Speichern</button>
                                   </div>
                                </form>
                              ) : (
                                <>
                                  <div className="flex justify-between items-start">
                                    <span className="font-bold text-white text-md">{a.name}</span>
                                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase border border-blue-500/30">{a.kategorie}</span>
                                  </div>
                                  <div className="flex flex-col gap-1 mt-1 flex-1">
                                    {a.telefon && <a href={`tel:${a.telefon}`} className="text-sm text-gray-400 hover:text-amber-500 transition-colors">📞 {a.telefon}</a>}
                                    {a.email && <a href={`mailto:${a.email}`} className="text-sm text-gray-400 hover:text-amber-500 transition-colors">✉️ {a.email}</a>}
                                  </div>
                                  {myProfile?.is_admin && (
                                    <div className="flex gap-2 justify-end mt-2 pt-2 border-t border-gray-800/60 shrink-0">
                                      <button onClick={() => startEditKontakt(a)} className="text-[10px] bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700 transition-colors">✏️ Edit</button>
                                      <button 
                                        onClick={async () => {
                                          if(confirm('Möchtest du diesen Kontakt wirklich löschen?')) {
                                            await supabase.from('ansprechpartner').delete().eq('id', a.id);
                                            fetchCrmData();
                                          }
                                        }} 
                                        className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors"
                                      >
                                        🗑️ Löschen
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                          {ansprechpartner.filter(a => a.veranstalter_id === v.id).length === 0 && (
                            <p className="text-sm text-gray-600 italic border border-dashed border-gray-800 p-4 rounded-lg text-center">Noch keine Kontakte für diesen Veranstalter hinterlegt.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {veranstalter.length === 0 && (
                  <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl text-center">
                    <p className="text-gray-400">Noch keine Veranstalter angelegt.</p>
                  </div>
                )}
              </div>
            </div>
          )}
{/* VIEW: DASHBOARD */}
          {currentView === 'dashboard' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-white mb-6">Willkommen zurück! 🤘</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Karte 1: Nächster Termin */}
                <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/30 p-5 rounded-2xl shadow-lg">
                  <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-3">Nächster Termin</h3>
                  {upcomingEventsList.length > 0 ? (
                    <div>
                      <div className="flex gap-2 items-center mb-1">
                        <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase border border-amber-500/30">{upcomingEventsList[0].event_type}</span>
                      </div>
                      <p className="text-xl font-black text-white truncate">{upcomingEventsList[0].title}</p>
                      <p className="text-gray-300 text-sm mt-2">📅 {new Date(upcomingEventsList[0].event_date).toLocaleDateString('de-DE')} • 🕒 {upcomingEventsList[0].event_time.substring(0, 5)} Uhr</p>
                      {upcomingEventsList[0].location && <p className="text-gray-400 text-xs mt-1 truncate">📍 {upcomingEventsList[0].location}</p>}
                      <button onClick={() => navigateTo('termine')} className="mt-4 w-full text-sm bg-amber-500 text-gray-950 font-bold px-4 py-2 rounded-xl hover:bg-amber-400 transition-colors">Zum Kalender</button>
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">Aktuell keine Termine in Sicht.</p>
                  )}
                </div>

                {/* Karte 2: Offene Abstimmungen (Für Techniker versteckt) */}
                {myProfile?.app_rolle !== 'Techniker' && (
                  <div className={`border p-5 rounded-2xl shadow-lg ${myPendingEvents.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${myPendingEvents.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>Deine Abstimmungen</h3>
                    {myPendingEvents.length > 0 ? (
                      <div className="flex flex-col h-full justify-between">
                        <div>
                          <p className="text-lg font-bold text-white">Du hast <span className="text-red-400 text-xl font-black">{myPendingEvents.length}</span> offene Termine!</p>
                          <p className="text-gray-400 text-sm mt-1">Bitte trage dich zeitnah ein, damit geplant werden kann.</p>
                        </div>
                        <button onClick={() => navigateTo('termine')} className="mt-4 w-full text-sm bg-red-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-red-400 transition-colors">Jetzt abstimmen</button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-lg font-bold text-white">Alles erledigt! ✅</p>
                        <p className="text-gray-400 text-sm mt-1">Du hast bei allen anstehenden Terminen abgestimmt.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Karte 3: Letzte Aktivitäten */}
              <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl mt-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Letzte Aktivitäten</h3>
                <div className="space-y-3">
                  {bandFiles.length > 0 && (
                    <div className="flex justify-between items-center bg-gray-950 p-3 rounded-xl border border-gray-800">
                      <div className="min-w-0 pr-3">
                        <p className="text-sm font-bold text-gray-200 truncate">Neue Datei: {bandFiles[0].title}</p>
                        <p className="text-[10px] text-gray-500">{new Date(bandFiles[0].created_at).toLocaleDateString('de-DE')}</p>
                      </div>
                      <button onClick={() => navigateTo('dateien')} className="text-[12px] bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-700">Ansehen</button>
                    </div>
                  )}
                  {pendingCount > 0 && myProfile.is_admin && (
                    <div className="flex justify-between items-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <p className="text-sm font-bold text-red-400">{pendingCount} neue Mitgliedsanfrage(n)</p>
                      <button onClick={() => navigateTo('verwaltung')} className="text-[12px] bg-red-500 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-red-400">Prüfen</button>
                    </div>
                  )}
                  {bandFiles.length === 0 && pendingCount === 0 && (
                     <p className="text-sm text-gray-500 italic">Keine neuen Aktivitäten.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {currentView === 'termine' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-300">Terminübersicht</h2>
                <button onClick={loadDefaultsAndOpenForm} className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-bold px-3 py-2 rounded-xl transition-transform active:scale-95 shadow-lg">
                  + Termin planen
                </button>
              </div>

              {isAddingEvent && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-gray-900 border border-amber-500/30 w-full max-w-2xl max-h-[90dvh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    
                    <div className="flex justify-between items-center border-b border-gray-800 p-4 sm:p-5 shrink-0 bg-gray-950">
                      <h3 className="text-lg sm:text-xl font-black text-amber-500 uppercase tracking-wider">
                        {editingEventId ? '✏️ Termin bearbeiten' : '➕ Termin planen'}
                      </h3>
                      <button type="button" onClick={resetForm} className="p-1.5 bg-gray-900 border border-gray-800 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-sm font-bold px-3 py-1.5 shrink-0">
                        Schließen
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                      <form onSubmit={handleSaveEvent} className="space-y-5">
                        <datalist id="saved-titles">
                          {uniqueTitles.map((title, idx) => <option key={idx} value={title as string} />)}
                        </datalist>
                        <datalist id="saved-locations">
                          {uniqueLocations.map((loc, idx) => <option key={idx} value={loc as string} />)}
                        </datalist>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Typ</label>
                            <select value={eventType} onChange={(e: any) => setEventType(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner">
                              <option value="Probe">🎵 Probe</option>
                              <option value="Auftritt">🎤 Auftritt</option>
                              <option value="Band-Event">🎸 Band-Event</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Titel / Name</label>
                            <input type="text" list="saved-titles" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="z.B. Probe im Bunker" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" required />
                          </div>
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Datum</label>
                            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" required />
                          </div>
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Uhrzeit Beginn</label>
                            <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" required />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Location</label>
                            <input type="text" list="saved-locations" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Adresse oder Location-Name" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                          </div>
                          <div>
                            <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Google Maps Link (optional)</label>
                            <input type="url" value={eventMapsLink} onChange={(e) => setEventMapsLink(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                          </div>
                        </div>

                        {eventType === 'Auftritt' && (
                          <div className="bg-purple-950/20 border border-purple-900/30 p-5 rounded-2xl space-y-5">
                            <h4 className="text-[12px] font-black text-purple-400 uppercase tracking-widest border-b border-purple-900/30 pb-2">🎤 Auftritts-Details</h4>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Status</label>
                                <select value={eventGigStatus} onChange={(e: any) => setEventGigStatus(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner">
                                  <option value="Steht fest">🟢 Steht fest / Gebucht</option>
                                  <option value="Angebot">🟡 Nur Angebot / Angefragt</option>
                                  <option value="Abgesagt">🔴 Abgesagt</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Gage (€)</label>
                                <input type="number" step="0.01" value={eventGage} onChange={(e) => setEventGage(e.target.value)} placeholder="z.B. 500" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 font-mono shadow-inner" />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Spielzeit (Stunden, z.B. 2.5)</label>
                                <input type="number" step="0.1" value={eventPlayTime} onChange={(e) => setEventPlayTime(e.target.value)} placeholder="z.B. 2.5" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 font-mono shadow-inner" />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Soundcheck</label>
                                <input type="time" value={eventSoundcheck} onChange={(e) => setEventSoundcheck(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                              </div>
                              <div>
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Spielbeginn</label>
                                <input type="time" value={eventPlayTimeStart} onChange={(e) => setEventPlayTimeStart(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                              </div>
                              <div>
                                <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Spielende</label>
                                <input type="time" value={eventPlayTimeEnd} onChange={(e) => setEventPlayTimeEnd(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                              </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-purple-900/30">
                              <label className="block text-[12px] text-amber-400 font-bold uppercase mb-1">📜 Anhang für den Auftritt (Bild oder PDF)</label>
                              <div className="flex gap-2 items-center flex-wrap">
                                <input type="file" accept="image/*,application/pdf" onChange={handleSetlistImageUpload} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-amber-500 file:text-gray-950 hover:file:bg-amber-600 cursor-pointer transition-colors" />
                              </div>
                              {eventSetlistImage && (
                                <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800 w-fit mt-2">
                                  <span className="text-xs text-amber-400 font-bold truncate max-w-[200px]">Datei hinterlegt</span>
                                  <button type="button" onClick={() => { setEventSetlistImage(''); setSetlistFile(null); }} className="text-red-400 text-xs font-bold hover:text-red-300 transition-colors">Löschen</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Zusätzliche Infos</label>
                          <textarea value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} placeholder="Infos für die Band..." rows={3} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 resize-none shadow-inner" />
                        </div>
                        
                        <div className="flex items-center gap-3 bg-gray-950 p-4 rounded-xl border border-gray-800">
                          <input type="checkbox" id="saveDefaultToggle" checked={saveAsDefault} onChange={(e) => setSaveAsDefault(e.target.checked)} className="w-5 h-5 accent-amber-500 bg-gray-800 border-gray-700 rounded cursor-pointer" />
                          <label htmlFor="saveDefaultToggle" className="text-sm font-bold text-gray-300 cursor-pointer select-none">Ort, Uhrzeit & Typ als Standard für neue Termine merken</label>
                        </div>

                        <div className="pt-4 sticky bottom-0 bg-gray-900 pb-2">
                          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg rounded-xl py-3.5 transition-colors shadow-lg shadow-emerald-600/20">
                            {editingEventId ? '💾 Änderungen speichern' : '🚀 Termin live veröffentlichen'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative bg-gray-900/80 p-1 rounded-xl flex border border-gray-800/60 max-w-xl">
                <div className="absolute top-1 bottom-1 bg-gray-800 border border-gray-700/50 rounded-lg shadow transition-all duration-300" style={{ left: activeFilter === 'all' ? '4px' : activeFilter === 'Probe' ? '25%' : activeFilter === 'Auftritt' ? '50%' : '75%', width: 'calc(25% - 6px)' }} />
                <button onClick={() => setActiveFilter('all')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${activeFilter === 'all' ? 'text-white' : 'text-gray-400'}`}>Alle</button>
                <button onClick={() => setActiveFilter('Probe')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${activeFilter === 'Probe' ? 'text-white' : 'text-gray-400'}`}>Proben</button>
                <button onClick={() => setActiveFilter('Auftritt')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${activeFilter === 'Auftritt' ? 'text-white' : 'text-gray-400'}`}>Auftritte</button>
                <button onClick={() => setActiveFilter('Band-Event')} className={`relative z-10 w-1/4 py-1.5 text-sm font-bold transition-colors text-center ${activeFilter === 'Band-Event' ? 'text-white' : 'text-gray-400'}`}>Events</button>
              </div>

              <div className="space-y-6">
                {Object.keys(groupedDisplayEvents).length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-6">
                    {showPastEvents ? "Keine Termine für diesen Filter vorhanden." : "Aktuell stehen keine zukünftigen Termine an."}
                  </p>
                ) : (
                  Object.keys(groupedDisplayEvents).map(monthYearKey => (
                    <div key={monthYearKey} className="space-y-3">
                      <h3 className="text-sm font-black text-amber-500 tracking-wider uppercase border-b border-gray-900 pb-1">{monthYearKey}</h3>
                      
                      <div className="space-y-3">
                        {groupedDisplayEvents[monthYearKey].map(ev => {
                          const { dayNum, dayName, monthName } = getParsedDate(ev.event_date);
                          const eventVotes = responses.filter(r => r.event_id === ev.id);
                          
                          // Jonas wird bei Proben komplett ignoriert
                          const relevantProfiles = allProfiles.filter(p => {
                            if (ev.event_type === 'Probe' && p.full_name?.toLowerCase().includes('jonas')) return false;
                            return true;
                          });

                          const goingUsers = relevantProfiles.filter(p => eventVotes.some(v => v.user_id === p.id && v.status === 'ja'));
                          const decliningUsers = relevantProfiles.filter(p => eventVotes.some(v => v.user_id === p.id && v.status === 'nein'));
                          const pendingUsers = relevantProfiles.filter(p => p.is_approved && !eventVotes.some(v => v.user_id === p.id));
                          const myVote = eventVotes.find(v => v.user_id === session.user.id)?.status;
                          const isExpanded = expandedEventId === ev.id;
                          const isAllGoing = goingUsers.length === activeMembersCount && activeMembersCount > 0;
                          
                          const isPast = isPastEvent(ev.event_date);

                          return (
                            <div key={ev.id} className={`relative overflow-hidden bg-gray-900/40 border rounded-2xl p-4 transition-all shadow-sm ${isAllGoing ? 'border-emerald-500/50 bg-emerald-500/[0.03] shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'border-gray-800 hover:border-gray-700/70'} ${isPast ? 'opacity-60 grayscale-[30%]' : ''}`}>
                              
                              {isAllGoing && !isPast && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-gray-950 text-[10px] font-black px-3 py-1 rounded-bl-xl z-20 shadow-md uppercase tracking-wider">
                                  🔥 Alle dabei!
                                </div>
                              )}

                              <div className="flex items-start gap-4 relative z-10 mt-2">
                                <div className={`flex flex-col items-center justify-center bg-gray-950 border rounded-xl min-w-[64px] h-[72px] text-center p-2 shadow-inner ${isAllGoing && !isPast ? 'border-emerald-500/30' : 'border-gray-800'}`}>
                                  <span className={`text-[10px] font-black tracking-wider uppercase leading-none ${isAllGoing && !isPast ? 'text-emerald-400' : 'text-amber-500'}`}>{dayName}</span>
                                  <span className="text-2xl font-black text-white my-0.5 leading-none">{dayNum}</span>
                                  <span className="text-[10px] font-bold text-gray-400 tracking-wide uppercase leading-none">{monthName}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="text-[16px] font-bold text-gray-100 tracking-tight truncate">{ev.title}</h3>
                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${ev.event_type === 'Auftritt' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' : ev.event_type === 'Band-Event' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{ev.event_type}</span>
                                    
                                    {ev.event_type === 'Auftritt' && ev.gig_status === 'Angebot' && (
                                       <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded uppercase ml-2 border border-amber-500/30">🟡 Angebot</span>
                                    )}
                                    {ev.event_type === 'Auftritt' && ev.gig_status === 'Steht fest' && (
                                       <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase ml-2 border border-emerald-500/30">🟢 Fest</span>
                                    )}
                                    {ev.event_type === 'Auftritt' && ev.gig_status === 'Abgesagt' && (
                                       <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase ml-2 border border-red-500/30 line-through">🔴 Abgesagt</span>
                                    )}

                                    {isPast && <span className="text-[10px] font-bold bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded uppercase ml-2">⏳ Vergangen</span>}
                                  </div>
                                  <div className="space-y-1 text-sm text-gray-400 mt-1">
                                    <div className="flex items-center gap-1.5"><span className="text-amber-500/80">🕒</span><span className="font-medium text-gray-300">{ev.event_time.substring(0, 5)} Uhr</span></div>
                                    {ev.location && (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-amber-500/80">📍</span>
                                        <span className="text-gray-400">{ev.location}</span>
                                        {ev.maps_link && (
                                          <a href={ev.maps_link} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-bold hover:bg-blue-500/20 ml-1 transition-colors">
                                            🗺️ Karte
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-2.5 flex gap-2 flex-wrap">
                                  {myProfile?.app_rolle !== 'Techniker' && (
                                      <button type="button" onClick={() => startEditEvent(ev)} className="text-[12px] text-gray-400 hover:text-white bg-gray-950 border border-gray-800 px-2.5 py-1 rounded-lg transition-colors">✏️ Bearbeiten</button>
                                    )}
                                    
                                    {ev.event_type === 'Auftritt' && myProfile?.app_rolle !== 'Techniker' && (
                                      <button type="button" onClick={() => openSetlistPlannerForEvent(ev)} className="text-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-2.5 py-1 rounded-lg hover:bg-amber-500/20 transition-colors">
                                        📋 Setlist planen
                                      </button>
                                    )}

                                    {myProfile?.app_rolle !== 'Techniker' && (
                                      <button type="button" onClick={() => handleDeleteEvent(ev.id)} className="text-[12px] text-red-400 hover:text-red-350 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg transition-colors">🗑️ Löschen</button>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5 bg-gray-950/60 border border-gray-800/80 p-1.5 rounded-xl min-w-[90px]">
                                  <button onClick={() => handleVote(ev.id, 'ja')} className={`px-2.5 py-1 rounded-lg text-[12px] font-bold transition-all ${myVote === 'ja' ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40' : 'bg-transparent text-emerald-400/70 hover:bg-emerald-500/10'}`}>👍 Zusage</button>
                                  <button onClick={() => handleVote(ev.id, 'nein')} className={`px-2.5 py-1 rounded-lg text-[12px] font-bold transition-all ${myVote === 'nein' ? 'bg-red-500/25 text-red-400 border border-red-500/40' : 'bg-transparent text-red-400/70 hover:bg-red-500/10'}`}>👎 Absage</button>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-gray-800/60 flex items-center justify-between flex-wrap gap-2 text-[12px] relative z-10">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">🟢 {goingUsers.length}</span>
                                  <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-semibold">🔴 {decliningUsers.length}</span>
                                  <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-semibold">🟡 {pendingUsers.length} offen</span>
                                </div>
                                <button onClick={() => setExpandedEventId(isExpanded ? null : ev.id)} className="text-sm font-bold text-amber-500/90 hover:text-amber-400 flex items-center gap-1 transition-colors">
                                  {isExpanded ? 'Details verbergen 🔼' : 'Details & wer kommt? 🔽'}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="mt-4 p-4 bg-gray-950 border border-gray-800 rounded-xl space-y-4 text-sm relative z-10">
                                  
                                  {ev.event_type === 'Auftritt' && (
                                    <div className="bg-purple-950/20 border border-purple-900/30 p-3 rounded-xl mb-3 space-y-2">
                                      <h4 className="font-bold text-purple-400 uppercase tracking-wider text-[12px] mb-1 flex justify-between items-center">
                                        <span>🎤 Auftritts-Details</span>
                                        {myProfile?.app_rolle !== 'Techniker' && ev.gage && (
                                          <span className="text-emerald-400 font-mono text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                            Gage: {ev.gage} €
                                          </span>
                                        )}
                                      </h4>
                                      
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                        {ev.soundcheck_time && (
                                          <div className="bg-gray-950 border border-gray-800 p-2 rounded-lg">
                                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Soundcheck</span>
                                            <span className="text-gray-200 font-mono">{ev.soundcheck_time} Uhr</span>
                                          </div>
                                        )}
                                        {(ev.play_time_start || ev.play_time_end) && (
                                          <div className="bg-gray-950 border border-gray-800 p-2 rounded-lg">
                                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Showtime</span>
                                            <span className="text-gray-200 font-mono">{ev.play_time_start || '?'} - {ev.play_time_end || '?'} Uhr</span>
                                          </div>
                                        )}
                                        {ev.play_time_hours && (
                                          <div className="bg-gray-950 border border-gray-800 p-2 rounded-lg">
                                            <span className="block text-[10px] text-gray-500 uppercase font-bold">Spielzeit gesamt</span>
                                            <span className="text-gray-200">{formatDecimalHours(ev.play_time_hours)}</span>
                                          </div>
                                        )}
                                      </div>

                                      {ev.setlist_image && (
                                        <div className="mt-3 pt-3 border-t border-purple-900/30 flex items-center justify-between">
                                          <span className="font-bold text-purple-400 text-sm">📜 Anhang (Setlist/Plan)</span>
                                          <button onClick={() => setSelectedSetlistImage(ev.setlist_image)} className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg text-sm transition-colors">Öffnen</button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {ev.description && (
                                    <div>
                                      <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[12px] mb-1">ℹ️ Notizen & Infos:</h4>
                                      <p className="text-gray-300 bg-gray-900/40 p-3 rounded-lg border border-gray-800 italic whitespace-pre-wrap">{ev.description}</p>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="font-bold text-gray-400 uppercase tracking-wider text-[12px] mb-2">📋 Anmeldestatus:</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <div className="bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-lg space-y-1">
                                        <span className="font-bold text-emerald-400 block border-b border-emerald-900/40 pb-1 mb-1">Dabei ({goingUsers.length})</span>
                                        {goingUsers.length === 0 ? <span className="text-gray-600 italic block">Niemand</span> : goingUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-emerald-300/90 font-medium py-0.5">✓ {getDisplayName(u.full_name)}</span>)}
                                      </div>
                                      <div className="bg-red-950/20 border border-red-900/30 p-2 rounded-lg space-y-1">
                                        <span className="font-bold text-red-400 block border-b border-red-900/40 pb-1 mb-1">Abgesagt ({decliningUsers.length})</span>
                                        {decliningUsers.length === 0 ? <span className="text-gray-600 italic block">Niemand</span> : decliningUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-red-300/90 font-medium py-0.5">✕ {getDisplayName(u.full_name)}</span>)}
                                      </div>
                                      <div className="bg-amber-950/20 border border-amber-900/30 p-2 rounded-lg space-y-1">
                                        <div className="flex justify-between items-center border-b border-amber-900/40 pb-1 mb-1">
                                          <span className="font-bold text-amber-400">Offen ({pendingUsers.length})</span>
                                          {(myProfile.is_admin || myProfile.can_manage_events) && pendingUsers.length > 0 && (
                                            <button onClick={() => pokePendingUsers(ev.id, pendingUsers.length)} className="text-[10px] bg-amber-500 text-gray-950 px-2 py-0.5 rounded font-bold hover:bg-amber-400 transition-colors">🔔 Anstupsen</button>
                                          )}
                                        </div>
                                        {pendingUsers.length === 0 ? <span className="text-gray-600 italic block">Alle abgestimmt</span> : pendingUsers.map(u => <span key={u.id} className="flex items-center gap-1 text-amber-300/80 py-0.5">❓ {getDisplayName(u.full_name)}</span>)}
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
              
              {pastEventsList.length > 0 && (
                <div className="flex justify-center pt-8 border-t border-gray-900">
                  <button onClick={() => setShowPastEvents(!showPastEvents)} className="bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white text-sm font-bold px-5 py-2.5 rounded-full transition-all">
                    {showPastEvents ? '🔼 Vergangene Termine ausblenden' : `👀 ${pastEventsList.length} vergangene Termine einblenden`}
                  </button>
                </div>
              )}
              
            </div>
          )}
{/* VIEW: FOTOS & SOCIAL MEDIA */}
{currentView === 'fotos' && !planningSetlistEvent && !planningSetlistTemplate && (() => {
            const isMediaOrAdmin = myProfile?.app_rolle === 'Media' || myProfile?.is_admin;
            
            return (
              <div className="space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <h2 className="text-xl font-black text-white">📸 Social Media Freigaben</h2>
                    <p className="text-sm text-gray-400">{isMediaOrAdmin ? 'Shooting-Alben verwalten & Leute markieren.' : 'Gib Bilder frei, auf denen du zu sehen bist.'}</p>
                  </div>
                  {isMediaOrAdmin && (
                    <button onClick={() => { setIsAddingFotoAlbum(!isAddingFotoAlbum); setNewAlbumDate(getTodayString()); }} className="bg-pink-600 hover:bg-pink-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg transition-colors">
                      {isAddingFotoAlbum ? 'Abbrechen' : '+ Neues Album anlegen'}
                    </button>
                  )}
                </div>

                {isAddingFotoAlbum && isMediaOrAdmin && (
                  <form onSubmit={handleCreateFotoAlbum} className="bg-gray-900/90 border border-pink-500/30 p-5 rounded-2xl space-y-4 shadow-lg mb-6">
                    <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider mb-2">📸 Neues Foto-Album erstellen</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Name des Termins/Shootings</label>
                        <input type="text" value={newAlbumTitle} onChange={(e) => setNewAlbumTitle(e.target.value)} placeholder="z.B. Stadtfest Gig" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-pink-500 shadow-inner" required />
                      </div>
                      <div>
                        <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Datum</label>
                        <input type="date" value={newAlbumDate} onChange={(e) => setNewAlbumDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-pink-500 shadow-inner" required />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[16px] rounded-xl py-3 mt-2 transition-colors">
                      Album speichern
                    </button>
                  </form>
                )}

                {fotoAlben.length === 0 ? (
                  <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl text-center">
                    <p className="text-gray-400">Es wurden noch keine Foto-Termine/Alben angelegt.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fotoAlben.map(album => {
                      const albumFotos = bandFotos.filter(f => f.album_id === album.id);
                      
                      // Filtere die Fotos: Admins/Media sehen alle im Album, Musiker nur die, wo sie getaggt sind
                      const visibleFotos = isMediaOrAdmin 
                        ? albumFotos 
                        : albumFotos.filter(f => fotoTags.some(t => t.foto_id === f.id && t.user_id === session.user.id));
                      
                      // Wenn ein normaler Musiker im Album 0 getaggte Fotos hat, zeige das Album gar nicht erst an
                      if (!isMediaOrAdmin && visibleFotos.length === 0) return null;

                      const isExpanded = expandedAlbumId === album.id;

                      return (
                        <div key={album.id} className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                          <div onClick={() => setExpandedAlbumId(isExpanded ? null : album.id)} className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-800/50 transition-colors">
                            <div>
                              <h3 className="text-[16px] font-bold text-gray-100">{album.title}</h3>
                              <p className="text-[12px] text-pink-400 font-bold tracking-wider mt-0.5 uppercase">📅 {new Date(album.event_date).toLocaleDateString('de-DE')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold text-gray-400 bg-gray-950 px-3 py-1 rounded-lg border border-gray-800">{visibleFotos.length} Fotos</span>
                              <span className="text-gray-500 font-bold">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 border-t border-gray-800 bg-gray-950/30">
                              {isMediaOrAdmin && (
                                <div className="mb-4">
                                  <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors border border-gray-700 inline-block">
                                    📸 + Foto hier hochladen
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFotoUploadForAlbum(e, album.id)} />
                                  </label>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {visibleFotos.map(foto => {
                                  const tagsOnFoto = fotoTags.filter(t => t.foto_id === foto.id);
                                  const myTag = tagsOnFoto.find(t => t.user_id === session.user.id);

                                  return (
                                    <div key={foto.id} className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden shadow flex flex-col">
                                      <a href={foto.file_url} target="_blank" rel="noopener noreferrer" className="block h-40 bg-black relative group">
                                        <img src={foto.file_url} alt="Band Foto" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold backdrop-blur-sm">
                                          🔍 Vollbild
                                        </div>
                                      </a>
                                      
                                      <div className="p-3 flex flex-col flex-1">
                                        
                                        {/* Status für Musiker */}
                                        {!isMediaOrAdmin && myTag && (
                                          <div className="mb-3 space-y-2">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center mb-1">Deine Freigabe:</p>
                                            <div className="flex gap-2">
                                              <button onClick={() => handleSetTagStatus(myTag.id, 'freigegeben')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${myTag.status === 'freigegeben' ? 'bg-emerald-500 text-gray-950' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'}`}>👍 Ja</button>
                                              <button onClick={() => handleSetTagStatus(myTag.id, 'abgelehnt')} className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${myTag.status === 'abgelehnt' ? 'bg-red-500 text-gray-950' : 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'}`}>👎 Nein</button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Ansicht für Media/Admin */}
                                        {isMediaOrAdmin && (
                                          <div className="flex-1 flex flex-col">
                                            <div className="flex-1">
                                              <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 border-b border-gray-800 pb-1">Markierte Personen</h4>
                                              {tagsOnFoto.length === 0 ? (
                                                <p className="text-[12px] text-gray-600 italic">Niemand markiert.</p>
                                              ) : (
                                                <div className="space-y-1 mb-3">
                                                  {tagsOnFoto.map(t => {
                                                    const u = allProfiles.find(p => p.id === t.user_id);
                                                    return (
                                                      <div key={t.id} className="flex items-center justify-between bg-gray-900 px-2 py-1 rounded text-[12px]">
                                                        <span className="text-gray-300 font-bold">{u ? getDisplayName(u.full_name) : 'User'}</span>
                                                        <span>
                                                          {t.status === 'freigegeben' && <span className="text-emerald-400 font-bold">🟢 OK</span>}
                                                          {t.status === 'abgelehnt' && <span className="text-red-400 font-bold">🔴 Nein</span>}
                                                          {t.status === 'offen' && <span className="text-amber-400 font-bold">🟡 Wartet</span>}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                            
                                            <select onChange={(e) => { handleTagUser(foto.id, e.target.value); e.target.value = ''; }} defaultValue="" className="w-full bg-gray-900 border border-gray-700 text-gray-300 text-[12px] font-bold rounded-lg px-2 py-1.5 focus:outline-none mb-2">
                                              <option value="" disabled>+ Person markieren...</option>
                                              {allProfiles.filter(p => !tagsOnFoto.some(t => t.user_id === p.id)).map(p => (
                                                <option key={p.id} value={p.id}>{p.full_name}</option>
                                              ))}
                                            </select>

                                            <button onClick={() => handleDeleteFoto(foto.id, foto.file_name)} className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-1.5 rounded-lg text-[12px] font-bold hover:bg-red-500/20 transition-colors">
                                              🗑️ Foto löschen
                                            </button>
                                          </div>
                                        )}

                                      </div>
                                    </div>
                                  );
                                })}
                                {visibleFotos.length === 0 && isMediaOrAdmin && (
                                  <p className="text-sm text-gray-500 italic">In diesem Album sind noch keine Fotos.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* VIEW: KALENDER */}
          {currentView === 'kalender' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-sm">
                <button onClick={() => changeMonth(-1)} className="p-2 bg-gray-950 hover:bg-gray-800 rounded-xl text-amber-500 font-bold text-[16px] border border-gray-800 transition-colors">&lt; Zurück</button>
                <h2 className="text-[16px] font-black text-gray-100 uppercase tracking-wider">
                  {currentCalendarDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={() => changeMonth(1)} className="p-2 bg-gray-950 hover:bg-gray-800 rounded-xl text-amber-500 font-bold text-[16px] border border-gray-800 transition-colors">Weiter &gt;</button>
              </div>

              <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-sm">
                <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  {weekDays.map(day => <div key={day} className="py-1">{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {calendarGrid.map((dayData, index) => {
                    if (!dayData) return <div key={`empty-${index}`} className="bg-gray-950/20 rounded-lg min-h-[75px]" />;

                    const dayEvents = events.filter(e => e.event_date === dayData.dateString);
                    const dayAbsences = absences.filter(a => isUserAbsentOnDate(a, dayData.dateString));

                    return (
                      <div key={dayData.dateString} onClick={() => handleDayClick(dayData.dateString, dayData.day, dayEvents, dayAbsences)} className="bg-gray-950 border border-gray-850 p-1.5 rounded-xl min-h-[75px] flex flex-col justify-between hover:border-amber-500/50 cursor-pointer transition-all group">
                        <span className="text-[12px] font-bold text-gray-400 group-hover:text-white transition-colors ml-0.5">{dayData.day}</span>
                        
                        <div className="space-y-1 mt-1 flex-1 flex flex-col justify-end overflow-hidden pb-0.5">
                          {dayAbsences.map(a => {
                            const u = allProfiles.find(p => p.id === a.user_id);
                            if (a.start_date !== a.end_date) {
                              return (
                                <div key={a.id} className="text-[10px] font-bold truncate bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md tracking-tight leading-tight w-full">
                                  🌴 {u ? getDisplayName(u.full_name) : 'Urlaub'}
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
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">🛑 Abwesenheit eintragen</h3>
                
                <div className="flex items-center gap-3 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <input type="checkbox" id="allDayToggle" checked={absenceIsAllDay} onChange={(e) => setAbsenceIsAllDay(e.target.checked)} className="w-4 h-4 accent-amber-500 bg-gray-800 border-gray-700 rounded" />
                  <label htmlFor="allDayToggle" className="text-sm font-bold text-gray-300 cursor-pointer">Ganztägig abwesend</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Start-Datum</label>
                    <input type="date" value={absenceStartDate} onChange={(e) => setAbsenceStartDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                  </div>
                  <div>
                    <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">End-Datum</label>
                    <input type="date" value={absenceEndDate} onChange={(e) => setAbsenceEndDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                  </div>
                </div>

                {!absenceIsAllDay && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Startzeit</label>
                      <input type="time" value={absenceStartTime} onChange={(e) => setAbsenceStartTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required={!absenceIsAllDay} />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Endzeit</label>
                      <input type="time" value={absenceEndTime} onChange={(e) => setAbsenceEndTime(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-[16px] text-white focus:outline-none focus:border-amber-500" required={!absenceIsAllDay} />
                    </div>
                  </div>
                )}

                <button type="submit" className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-[16px] font-bold px-4 py-2 rounded-xl transition-colors">Eintragen & Speichern</button>
              </form>

              <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">📋 Meine eingetragenen Abwesenheiten</h3>
                {myOwnAbsences.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Du hast aktuell keine Abwesenheiten eingetragen.</p>
                ) : (
                  <div className="space-y-2">
                    {myOwnAbsences.map((a) => {
                      const start = new Date(a.start_date).toLocaleDateString('de-DE');
                      const end = new Date(a.end_date).toLocaleDateString('de-DE');
                      const timeStr = !a.is_all_day && a.start_time && a.end_time 
                        ? ` (${a.start_time.substring(0, 5)} - ${a.end_time.substring(0, 5)} Uhr)` 
                        : ' (Ganztägig)';
                        
                      return (
                        <div key={a.id} className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex justify-between items-center text-sm">
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

          {/* VIEW: VERWALTUNG */}
          {currentView === 'verwaltung' && myProfile.is_admin && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="bg-gray-900/60 border border-gray-800 p-6 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-amber-500">🛡️ Admin-Zentrale</h2>
                {pendingCount > 0 && <span className="bg-red-500 text-white text-[12px] font-bold px-3 py-1 rounded-full animate-pulse">{pendingCount} neue Anfragen</span>}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-[12px] uppercase text-gray-400">
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Instrument</th>
                      <th className="pb-3">Rechte</th>
                      <th className="pb-3 text-right">Zugang</th>
                    </tr>
                  </thead>S
                  <tbody className="divide-y divide-gray-800/40">
                    {allProfiles.map((p) => {
                      const isMe = p.id === session.user.id;
                      const isPending = !p.is_approved && !p.is_admin;
                      
                      return (
                        <tr key={p.id} className={`${isPending ? 'bg-red-500/[0.05] border-l-2 border-red-500' : isMe ? 'bg-amber-500/[0.02]' : ''}`}>
                          <td className="py-4 pl-3 font-medium">
                            {p.full_name} 
                            {isMe && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded ml-2 font-bold">Du</span>}
                            {isPending && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded ml-2 font-bold uppercase tracking-wider">Wartet</span>}
                          </td>
                          <td className="py-4">
                            <select
                              value={p.instrument || ''}
                              onChange={(e) => handleInstrumentChange(p.id, e.target.value)}
                              className="bg-gray-950 border border-gray-800 text-emerald-400 font-medium text-[12px] rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              <option value="" className="text-gray-500">Ohne Instrument</option>
                              {instruments.map(inst => (
                                <option key={inst} value={inst} className="text-gray-300">{inst}</option>
                              ))}
                              <option value="NEW" className="text-amber-500 font-bold">+ Neu...</option>
                            </select>
                          </td>
                          <td className="py-4">
                          <select
                              value={p.app_rolle || 'Musiker'}
                              onChange={async (e) => {
                                await supabase.from('profiles').update({ app_rolle: e.target.value, is_admin: e.target.value === 'Admin' }).eq('id', p.id);
                                fetchAllProfiles();
                              }}
                              className={`text-[12px] font-bold px-2 py-1 rounded-md border focus:outline-none cursor-pointer ${p.app_rolle === 'Admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : p.app_rolle === 'Techniker' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : p.app_rolle === 'Media' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}
                            >
                              <option value="Admin">👑 Admin</option>
                              <option value="Musiker">🎸 Musiker</option>
                              <option value="Techniker">🎛️ Techniker</option>
                              <option value="Media">📸 Social Media</option>
                            </select>
                            <label className="flex items-center gap-2 mt-2 text-[12px] text-gray-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={p.can_view_contacts || false}
                                onChange={async (e) => {
                                  await supabase.from('profiles').update({ can_view_contacts: e.target.checked }).eq('id', p.id);
                                  fetchAllProfiles();
                                }}
                                className="rounded bg-gray-900 border-gray-700 text-amber-500"
                              />
                              📇 CRM-Zugriff
                            </label>
                            <label className="flex items-center gap-2 mt-1 text-[12px] text-gray-300 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={p.can_mass_update || false}
                                onChange={async (e) => {
                                  await supabase.from('profiles').update({ can_mass_update: e.target.checked }).eq('id', p.id);
                                  fetchAllProfiles();
                                }}
                                className="rounded bg-gray-900 border-gray-700 text-amber-500"
                              />
                              ✨ Massen-Update
                            </label>
                          </td>
                          <td className="py-4 text-right">
                            {isMe || p.is_admin ? (
                              <span className="text-[12px] px-2.5 py-1.5 text-emerald-400 font-bold bg-emerald-500/10 rounded-lg border border-emerald-500/20">Aktiv</span>
                            ) : (
                              <button onClick={() => toggleApprove(p.id, p.is_approved)} className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-all ${p.is_approved ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-black border-transparent shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-pulse'}`}>
                                {p.is_approved ? 'Sperren' : '✓ Verifizieren'}
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
{/* VIEW: PROFIL (Für Band-Webseite) */}
{currentView === 'profil' && (
            <div className="space-y-8">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">👤 Mein Band-Profil</h2>
                  <p className="text-sm text-gray-400 mt-1">Diese Daten werden direkt auf unserer öffentlichen Band-Webseite angezeigt.</p>
                </div>
                {!isEditingMyProfile && (
                  <button onClick={() => setIsEditingMyProfile(true)} className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold px-4 py-2 rounded-xl transition-transform active:scale-95 shrink-0 shadow-lg">
                    ✏️ Bearbeiten
                  </button>
                )}
              </div>

              {/* EIGENES PROFIL */}
              <div className="bg-gray-900/60 border border-gray-800 rounded-3xl shadow-lg overflow-hidden relative">
                {/* Banner Header */}
                <div className="h-32 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-800 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500 via-transparent to-transparent"></div>
                </div>

                {!isEditingMyProfile ? (
                  /* ANSICHT: STECKBRIEF */
                  <div className="p-6 sm:p-8 relative">
                    <div className="absolute -top-16 left-6 sm:left-8 w-32 h-32 rounded-2xl bg-gray-950 border-4 border-gray-900 overflow-hidden shadow-2xl">
                      {myProfile.avatar_url ? (
                        <img src={myProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-4xl bg-gray-900">📸</span>
                      )}
                    </div>
                    
                    <div className="mt-16 pt-2">
                      <h3 className="text-3xl font-black text-white">{myProfile.full_name}</h3>
                      <p className="text-lg text-amber-500 font-bold uppercase tracking-widest mt-1">{myProfile.instrument || 'Instrument nicht angegeben'}</p>
                      
                      <div className="mt-8 bg-gray-950/50 border border-gray-800 p-6 rounded-2xl">
                        <h4 className="text-[12px] font-black text-gray-500 uppercase tracking-widest mb-3">Über mich</h4>
                        <p className="text-gray-200 leading-relaxed whitespace-pre-wrap font-sans text-[16px]">
                          {myProfile.bio ? myProfile.bio : <span className="italic text-gray-600">Noch kein Text für die Homepage hinterlegt. Klicke oben auf "Bearbeiten", um dich vorzustellen!</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ANSICHT: BEARBEITEN FORMULAR */
                  <div className="p-6 sm:p-8 relative">
                    <div className="absolute -top-16 left-6 sm:left-8 w-32 h-32 rounded-2xl bg-gray-950 border-4 border-gray-900 overflow-hidden shadow-xl group">
                      {myProfile.avatar_url ? (
                        <img src={myProfile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center text-4xl bg-gray-900">📸</span>
                      )}
                      <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[12px] font-bold text-white uppercase tracking-wider text-center p-2">
                        <span className="text-2xl mb-1">⬆️</span>
                        Foto ändern
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSelectFileForCrop(e, myProfile.id)} />
                      </label>
                    </div>

                    <form onSubmit={(e) => { e.preventDefault(); handleUpdateProfile(myProfile.id, myProfile.bio, myProfile.instrument); }} className="mt-16 pt-2 space-y-5">
                      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6">
                        <p className="text-sm font-bold text-amber-500">Du bist im Bearbeitungsmodus.</p>
                        <p className="text-[12px] text-gray-400 mt-1">Änderungen am Foto werden sofort gespeichert. Text-Änderungen erst beim Klick auf "Online stellen".</p>
                      </div>
                      
                      <div>
                        <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Dein Instrument / Rolle</label>
                        <input type="text" value={myProfile.instrument || ''} onChange={(e) => setMyProfile({...myProfile, instrument: e.target.value})} placeholder="z.B. Lead Gitarre & Vocals" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Über dich (Bio für die Webseite)</label>
                        <textarea value={myProfile.bio || ''} onChange={(e) => setMyProfile({...myProfile, bio: e.target.value})} placeholder="Schreib ein paar coole Sätze über dich, dein Gear oder deine musikalischen Einflüsse..." rows={6} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 resize-none shadow-inner" />
                      </div>
                      <div className="flex gap-3 pt-4 border-t border-gray-800">
                        <button type="button" onClick={() => setIsEditingMyProfile(false)} className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-6 py-3 rounded-xl transition-colors">Abbrechen</button>
                        <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-colors shadow-lg shadow-emerald-600/20">💾 Online stellen</button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              {/* ADMIN BEREICH: ANDERE PROFILE */}
              {myProfile.is_admin && (
                <div className="pt-8 border-t border-gray-900 mt-8">
                  <h3 className="text-lg font-bold text-amber-500 mb-4">🛡️ Admin: Alle Bandmitglieder bearbeiten</h3>
                  <div className="space-y-3">
                    {allProfiles.filter(p => p.id !== session.user.id).map(p => (
                      <details key={p.id} className="bg-gray-900/40 border border-gray-800 rounded-xl group overflow-hidden">
                        <summary className="p-4 font-bold text-gray-200 cursor-pointer hover:bg-gray-800/50 transition-colors list-none flex justify-between items-center">
                          <span className="flex items-center gap-3">
                            {p.avatar_url ? <img src={p.avatar_url} className="w-8 h-8 rounded-full object-cover object-center border border-gray-700" alt="" /> : <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[10px]">📸</span>}
                            {p.full_name}
                          </span>
                          <span className="text-gray-500 text-sm group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        
                        <div className="p-6 border-t border-gray-800 bg-gray-950/30 flex flex-col sm:flex-row gap-6">
                           <div className="w-24 h-24 rounded-2xl bg-gray-950 border border-gray-800 overflow-hidden relative group/avatar shrink-0">
                              {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover object-center" /> : <span className="w-full h-full flex items-center justify-center text-2xl">📸</span>}
                              <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer text-[10px] font-bold text-white uppercase text-center p-1">
                                Bild<br/>ändern
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleSelectFileForCrop(e, p.id)} />
                              </label>
                           </div>
                           <form onSubmit={(e) => { 
                             e.preventDefault(); 
                             const form = e.target as HTMLFormElement;
                             handleUpdateProfile(p.id, form.bio.value, form.instrument.value); 
                           }} className="flex-1 space-y-3">
                              <input name="instrument" defaultValue={p.instrument || ''} placeholder="Instrument..." className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500" />
                              <textarea name="bio" defaultValue={p.bio || ''} placeholder="Bio Text..." rows={3} className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 resize-none" />
                              <button type="submit" className="bg-gray-800 hover:bg-gray-700 text-white text-[12px] font-bold px-4 py-2 rounded-lg transition-colors">Für {p.full_name.split(' ')[0]} online stellen</button>
                           </form>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: BANDKASSE */}
          {currentView === 'bandkasse' && !planningSetlistEvent && !planningSetlistTemplate && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-300">💰 Bandkasse</h2>

              <div className="bg-gray-900/60 border border-gray-800 p-8 rounded-2xl shadow-sm text-center flex flex-col items-center justify-center">
                <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest mb-3">Aktueller Kassenstand</p>
                <div className="bg-gray-950 border border-gray-800 px-8 py-6 rounded-2xl shadow-inner min-w-[200px]">
                  <p className="text-4xl font-black text-emerald-500 tracking-tight">
                    {fundBalance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                </div>
              </div>

              {myProfile.is_admin && (
                <form onSubmit={handleAddTransaction} className="bg-gray-900/90 border border-amber-500/20 p-6 rounded-2xl space-y-4 shadow-lg">
                  <h3 className="text-sm font-bold uppercase text-amber-500 tracking-wider mb-2">⚙️ Neue Buchung eintragen</h3>
                  
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setTransType('+')} className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${transType === '+' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-gray-950 border-gray-800 text-gray-500'}`}>+ Einnahme</button>
                    <button type="button" onClick={() => setTransType('-')} className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${transType === '-' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-gray-950 border-gray-800 text-gray-500'}`}>- Ausgabe</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Betrag (€)</label>
                      <input type="number" step="0.01" value={transAmount} onChange={(e) => setTransAmount(e.target.value)} placeholder="z.B. 150.00" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500 font-mono" required />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-400 font-bold uppercase mb-1">Grund / Verwendungszweck</label>
                      <input type="text" value={transReason} onChange={(e) => setTransReason(e.target.value)} placeholder="z.B. Gage Stadtfest" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmittingTrans} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[16px] rounded-xl py-3 transition-colors uppercase tracking-wider">
                    {isSubmittingTrans ? 'Speichere...' : 'Buchen'}
                  </button>
                </form>
              )}

              <div className="bg-gray-900/60 border border-gray-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">📜 Transaktionsverlauf</h3>
                
                {transactions.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">Bisher keine Buchungen vorhanden.</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(t => {
                      const isIncome = t.transaction_type === '+';
                      const dateObj = new Date(t.created_at);
                      const formattedDate = dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      const creator = allProfiles.find(p => p.id === t.created_by);
                      
                      return (
                        <div key={t.id} className="bg-gray-950 border border-gray-800 p-3.5 rounded-xl flex justify-between items-center group shadow-sm">
                          <div className="min-w-0 flex-1 pr-4">
                            <p className="text-[16px] font-bold text-gray-200 truncate">{t.reason}</p>
                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                              {formattedDate} • von {creator ? getDisplayName(creator.full_name) : 'Admin'}
                            </p>
                          </div>
                          <div className={`text-[16px] font-black shrink-0 font-mono ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isIncome ? '+' : '-'}{t.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    );
  }

  // ==========================================
  // LOGIN / REGISTRIEREN ANSICHT (NICHT EINGELOGGT)
  // ==========================================
  return (
    <div className="min-h-[100dvh] w-full bg-gray-950 text-gray-100 flex flex-col justify-between p-6 font-sans m-0">
      <div className="flex flex-col items-center mt-8">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg"><span className="text-xl font-black text-gray-950">BB</span></div>
        <h1 className="text-2xl font-bold tracking-tight mt-4">Burnin' Bugs Portal</h1>
      </div>
      <div className="w-full max-w-sm mx-auto bg-gray-900/40 border border-gray-800/60 rounded-3xl p-6 backdrop-blur-md">
        {message.text && <div className={`mb-4 p-3 rounded-xl text-sm text-center ${message.isError ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>{message.text}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] text-gray-400 uppercase mb-1">Vorname</label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                </div>
                <div>
                  <label className="block text-[12px] text-gray-400 uppercase mb-1">Nachname</label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mustermann" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required />
                </div>
              </div>
              <div><label className="block text-[12px] text-gray-400 uppercase mb-1">Geburtsdatum</label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required /></div>
            </>
          )}
          <div><label className="block text-[12px] text-gray-400 uppercase mb-1">E-Mail</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@band.de" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required /></div>
          <div><label className="block text-[12px] text-gray-400 uppercase mb-1">Passwort</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-[16px] text-white focus:outline-none focus:border-amber-500" required /></div>
          <button type="submit" className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-gray-950 font-bold text-[16px] rounded-xl py-3.5 transition-all active:scale-95">{isRegister ? 'Registrieren' : 'Anmelden'}</button>
        </form>
        <div className="text-center mt-6"><button type="button" onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-400 hover:text-amber-500 underline">{isRegister ? 'Bereits registriert? Login' : 'Konto erstellen'}</button></div>
      </div>
      <div className="text-center text-[12px] text-gray-600">&copy; {new Date().getFullYear()} Burnin' Bugs.</div>
    </div>
  );
}