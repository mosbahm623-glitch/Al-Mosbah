import { supabase } from '../../lib/supabase'

export const fetchSummaries = () => supabase.rpc('project_summaries')
