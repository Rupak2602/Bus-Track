// ==========================================
// SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://mjjklwjjnedhpykgigaf.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qamtsd2pqbmVkaHB5a2dpZ2FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyODc2NDIsImV4cCI6MjEwNjg2MzY0Mn0.FJ5hilpG-p7z8MKiSa2e1JjFo_0o6J-MT7hZcsw1evg";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);