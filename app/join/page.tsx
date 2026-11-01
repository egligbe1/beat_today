import {redirect} from 'next/navigation'
import {getCachedAuthContext} from '@/lib/auth'
import {collectiveDestination} from '@/lib/studio/directory'
export default async function JoinCollective(){const {user,profile}=await getCachedAuthContext();redirect(collectiveDestination(!!user,profile?.role))}
