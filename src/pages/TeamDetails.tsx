import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { SaintFrame } from '../components/ui/SaintFrame';
import { Empty, ErrorNote, Skeleton } from '../components/ui/States';
import { usePublicTeams } from '../hooks/useTournament';
import { supabase } from '../lib/supabase';

export default function TeamDetails() {
  const { id } = useParams();
  const team = usePublicTeams().data?.find((t) => t.id === id);
  const roster = useQuery({ queryKey: ['roster', id], enabled: !!supabase && !!id,
    queryFn: async () => { const { data, error } = await supabase!.from('public_team_players').select('id, full_name_ar').eq('team_id', id!); if (error) throw error; return data; } });
  return (<div className="mx-auto max-w-3xl">
    <Link to="/teams" className="text-gold hover:underline">→ الفرق المشاركة</Link>
    {!team ? <div className="mt-6">{roster.isError ? <ErrorNote /> : <Skeleton />}</div> : (<div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <SaintFrame name={team.saint_name_ar} path={team.portrait_path} className="w-40" />
      <div className="w-full"><h1 className="mb-4 text-3xl font-bold">{team.saint_name_ar}</h1><h2 className="mb-2 text-lg text-gold">اللاعبون</h2>
        {roster.isLoading ? <Skeleton className="h-32" /> : roster.data?.length ? <ul className="space-y-2">{roster.data.map((p) => <li key={p.id} className="card !p-3">{p.full_name_ar}</li>)}</ul> : <Empty>لا يوجد لاعبون لعرضهم.</Empty>}</div></div>)}
  </div>);
}
