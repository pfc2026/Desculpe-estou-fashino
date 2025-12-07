import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = 'https://jvmbegvrxquvyojhfkpq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bWJlZ3ZyeHF1dnlvamhma3BxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwNzg0MDksImV4cCI6MjA4MDY1NDQwOX0.aRrJGZSciK_Amef-ys0MlxZ-aDLu-PnD7QW3isU2Mxg'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data, error } = await supabase.rpc("get_current_user");

console.log({ data, error });
