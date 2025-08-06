import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ajlikjcbrzratqpcxaqv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqbGlramNicnpyYXRxcGN4YXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNzkyMDgsImV4cCI6MjA2OTg1NTIwOH0.xiQGXZLl5bYd5_6iUCZWQOfwUo501tF_QmhA9OL5GAU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
