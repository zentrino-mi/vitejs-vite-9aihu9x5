import { createClient } from '@supabase/supabase-js';

// Hier kommen gleich deine echten Zugangsdaten rein!
const supabaseUrl = 'https://lovmpltidcuuybpjzygh.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvdm1wbHRpZGN1dXlicGp6eWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTYxNjMsImV4cCI6MjEwMDIzMjE2M30.-QF86cPzfFLE33ODNIPwUiPTBuhM3BzlohvdoSTYFDE';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
