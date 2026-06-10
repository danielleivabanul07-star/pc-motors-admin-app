import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mznbhkrvcygmotneucdf.supabase.co'

const supabaseKey = 'sb_publishable_kgBeOwddpM6mwVGkg4Mi_A_9vl4x2qk'

export const supabase = createClient(supabaseUrl, supabaseKey)